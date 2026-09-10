import { createHash } from 'node:crypto';
import { getToolInventoryDao, getUserDao } from '../dao/DaoFactory.js';
import { Tool } from '../types/index.js';
import { resolveAccountFlags } from '../utils/userAccount.js';

export interface ToolFingerprintInput {
  name: string;
  description?: string;
  inputSchema?: unknown;
  outputSchema?: unknown;
  _meta?: unknown;
}

export interface ToolChangeImpact {
  username: string;
  reason: 'grant' | 'admin';
}

export interface ToolChangeRow {
  server: string;
  added: string[];
  removed: string[];
  changed: string[];
  impactedUsers: ToolChangeImpact[];
}

const shortName = (serverName: string, toolName: string): string => {
  const prefix = `${serverName}-`;
  return toolName.startsWith(prefix) ? toolName.slice(prefix.length) : toolName;
};

export const fingerprintTool = (tool: ToolFingerprintInput): string => {
  const payload = JSON.stringify({
    name: tool.name,
    description: tool.description || '',
    inputSchema: tool.inputSchema ?? null,
    outputSchema: tool.outputSchema ?? null,
    meta: tool._meta ?? null,
  });
  return createHash('sha256').update(payload).digest('hex');
};

export const snapshotFromServers = (
  servers: Array<{ name: string; tools?: Tool[] }>,
): Record<string, Record<string, string>> => {
  const snapshot: Record<string, Record<string, string>> = {};
  for (const server of servers) {
    const tools: Record<string, string> = {};
    for (const tool of server.tools || []) {
      const name = shortName(server.name, tool.name);
      tools[name] = fingerprintTool({
        name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        _meta: tool._meta,
      });
    }
    snapshot[server.name] = tools;
  }
  return snapshot;
};

export const diffToolSnapshots = (
  previous: Record<string, Record<string, string>>,
  current: Record<string, Record<string, string>>,
): Array<Omit<ToolChangeRow, 'impactedUsers'>> => {
  if (Object.keys(previous).length === 0) {
    return [];
  }
  const names = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const changes: Array<Omit<ToolChangeRow, 'impactedUsers'>> = [];
  for (const server of names) {
    const before = previous[server] || {};
    const after = current[server] || {};
    const toolNames = new Set([...Object.keys(before), ...Object.keys(after)]);
    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];
    for (const tool of toolNames) {
      if (!(tool in before)) {
        added.push(tool);
      } else if (!(tool in after)) {
        removed.push(tool);
      } else if (before[tool] !== after[tool]) {
        changed.push(tool);
      }
    }
    if (added.length || removed.length || changed.length) {
      changes.push({ server, added, removed, changed });
    }
  }
  return changes;
};

const userTouchesTool = (
  grants: Array<{ name: string; tools?: string[] | 'all' }> | null | undefined,
  server: string,
  tools: string[],
  isAdmin: boolean,
): 'grant' | 'admin' | null => {
  if (isAdmin) {
    return 'admin';
  }
  const grant = (grants || []).find((row) => row.name === server);
  if (!grant) {
    return null;
  }
  if (!grant.tools || grant.tools === 'all') {
    return 'grant';
  }
  return tools.some((tool) => grant.tools?.includes(tool)) ? 'grant' : null;
};

export const listToolChanges = async (
  servers: Array<{ name: string; tools?: Tool[] }>,
): Promise<ToolChangeRow[]> => {
  const dao = getToolInventoryDao();
  if (!dao) {
    return [];
  }
  const baseline = await dao.getBaseline();
  const current = snapshotFromServers(servers);
  const diff = diffToolSnapshots(baseline?.snapshot || {}, current);
  if (diff.length === 0) {
    return [];
  }
  const users = (await getUserDao().findAll()).filter((user) => resolveAccountFlags(user).mcpEnabled);
  return diff.map((row) => {
    const tools = [...row.added, ...row.removed, ...row.changed];
    const impactedUsers: ToolChangeImpact[] = [];
    for (const user of users) {
      const reason = userTouchesTool(
        user.grants,
        row.server,
        tools,
        Boolean(resolveAccountFlags(user).isAdmin),
      );
      if (reason) {
        impactedUsers.push({ username: user.username, reason });
      }
    }
    return { ...row, impactedUsers };
  });
};

export const acknowledgeToolChanges = async (
  servers: Array<{ name: string; tools?: Tool[] }>,
  updatedBy?: string,
): Promise<void> => {
  const dao = getToolInventoryDao();
  if (!dao) {
    throw new Error('Tool inventory is only available in database mode');
  }
  await dao.saveBaseline(snapshotFromServers(servers), updatedBy);
};

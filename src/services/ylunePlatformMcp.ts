/**
 * In-process read-only platform MCP named `ylune`.
 * No stdio child. No env, URLs, tokens, credentials, or commands in tool output.
 */
import { getNameSeparator } from '../config/index.js';
import {
  YLUNE_PLATFORM_REMARK,
  YLUNE_PLATFORM_RESERVED_MESSAGE,
  YLUNE_PLATFORM_SERVER_NAME,
  isYlunePlatformServerName,
} from '../constants/ylunePlatform.js';
import { getActivityDao, getUserDao } from '../dao/index.js';
import { IUser, ServerInfo, Tool } from '../types/index.js';
import { resolveAccountFlags } from '../utils/userAccount.js';
import { UserContextService } from './userContextService.js';

export {
  YLUNE_PLATFORM_REMARK,
  YLUNE_PLATFORM_RESERVED_MESSAGE,
  YLUNE_PLATFORM_SERVER_NAME,
  isYlunePlatformServerName,
};

export const YLUNE_PLATFORM_TOOL_NAMES = [
  'list_servers',
  'list_tools',
  'usage_summary',
  'recent_failures',
] as const;

export type YlunePlatformToolName = (typeof YLUNE_PLATFORM_TOOL_NAMES)[number];

const YLUNE_CREATED_AT = Date.now();

const emptyObjectSchema = {
  type: 'object',
  properties: {},
} as const;

const YLUNE_PLATFORM_TOOLS: Tool[] = [
  {
    name: 'list_servers',
    description:
      'List MCP servers known to this hub: name, status, enabled, type, tool count, and error. Does not return commands, URLs, env, headers, or tokens.',
    inputSchema: emptyObjectSchema,
    enabled: true,
  },
  {
    name: 'list_tools',
    description:
      'List tools advertised by connected servers. Optional server name filter. Returns name, description, enabled, and server. Does not return input or output payloads.',
    inputSchema: {
      type: 'object',
      properties: {
        server: {
          type: 'string',
          description: 'Optional server name. When set, only tools from that server are returned.',
        },
      },
    },
    enabled: true,
  },
  {
    name: 'usage_summary',
    description:
      'Call volume for the last N days: per-day counts, top tools, and top users. Does not return request or response bodies.',
    inputSchema: {
      type: 'object',
      properties: {
        days: {
          type: 'integer',
          minimum: 1,
          maximum: 90,
          default: 7,
          description: 'Number of days to include (1-90, default 7).',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Max buckets for tools and users (1-50, default 10).',
        },
      },
    },
    enabled: true,
  },
  {
    name: 'recent_failures',
    description:
      'Recent failed tool calls: timestamp, tool, username, and error message. Does not return input or output payloads.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          default: 10,
          description: 'Max failures to return (1-50, default 10).',
        },
      },
    },
    enabled: true,
  },
];

export const canAccessYlunePlatform = (user?: IUser | null): boolean => {
  if (!user?.username || user.demo) {
    return false;
  }
  const flags = resolveAccountFlags(user);
  return flags.isAdmin && flags.mcpEnabled;
};

export const canSeeYlunePlatformCard = (
  user?: Pick<IUser, 'isAdmin' | 'demo'> | null,
): boolean => Boolean(user?.isAdmin || user?.demo);

const loadPersistedUser = async (username: string): Promise<IUser | null> => {
  try {
    if (typeof getUserDao !== 'function') {
      return null;
    }
    const dao = getUserDao();
    if (!dao || typeof dao.findByUsername !== 'function') {
      return null;
    }
    return await dao.findByUsername(username);
  } catch {
    return null;
  }
};

export const callerCanUseYlunePlatform = async (): Promise<boolean> => {
  const user = UserContextService.getInstance().getCurrentUser();
  if (!canAccessYlunePlatform(user)) {
    return false;
  }
  const persisted = await loadPersistedUser(user!.username);
  if (!persisted) {
    return false;
  }
  return canAccessYlunePlatform(persisted);
};

const isYlunePlatformToolName = (name: string): name is YlunePlatformToolName =>
  (YLUNE_PLATFORM_TOOL_NAMES as readonly string[]).includes(name);

export const matchYlunePlatformTool = (requestedName: unknown): YlunePlatformToolName | null => {
  if (typeof requestedName !== 'string' || requestedName.length === 0) {
    return null;
  }
  const separator = getNameSeparator();
  const prefix = `${YLUNE_PLATFORM_SERVER_NAME}${separator}`;
  if (requestedName.startsWith(prefix)) {
    const shortName = requestedName.slice(prefix.length);
    return isYlunePlatformToolName(shortName) ? shortName : null;
  }
  // Agents often call the short name from the tool schema (`usage_summary`),
  // not the /mcp qualified name (`ylune-usage_summary`).
  return isYlunePlatformToolName(requestedName) ? requestedName : null;
};

const publicServerType = (info: ServerInfo): string => {
  if (info.builtin || isYlunePlatformServerName(info.name)) {
    return 'builtin';
  }
  if (info.config?.type) {
    return info.config.type;
  }
  if (info.config?.openapi) {
    return 'openapi';
  }
  if (info.config?.url) {
    return 'streamable-http';
  }
  if (info.config?.command) {
    return 'stdio';
  }
  return 'unknown';
};

const shortToolName = (serverName: string, toolName: string): string => {
  const prefix = `${serverName}${getNameSeparator()}`;
  return toolName.startsWith(prefix) ? toolName.slice(prefix.length) : toolName;
};

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.trunc(n)));
};

export const buildYlunePlatformServerInfo = (): ServerInfo => ({
  name: YLUNE_PLATFORM_SERVER_NAME,
  owner: 'system',
  visibility: 'private',
  status: 'connected',
  error: null,
  tools: YLUNE_PLATFORM_TOOLS.map((tool) => ({ ...tool })),
  prompts: [],
  resources: [],
  createTime: YLUNE_CREATED_AT,
  enabled: true,
  builtin: true,
  config: {
    description: YLUNE_PLATFORM_REMARK,
    enabled: true,
    visibility: 'private',
    owner: 'system',
  },
});

export const presentYlunePlatformServer = (): Omit<ServerInfo, 'client' | 'transport'> => {
  const info = buildYlunePlatformServerInfo();
  return {
    name: info.name,
    version: undefined,
    instructions: undefined,
    owner: info.owner,
    visibility: info.visibility,
    status: info.status,
    error: info.error,
    tools: info.tools.map((tool) => ({ ...tool, enabled: true })),
    prompts: [],
    resources: [],
    createTime: info.createTime,
    enabled: true,
    builtin: true,
    oauth: undefined,
    config: {
      description: YLUNE_PLATFORM_REMARK,
      enabled: true,
      visibility: 'private',
      owner: 'system',
    },
  };
};

export const executeYlunePlatformTool = async (
  tool: YlunePlatformToolName,
  args: Record<string, unknown> | undefined,
  ctx: { servers: ServerInfo[] },
): Promise<unknown> => {
  const input = args && typeof args === 'object' ? args : {};

  if (tool === 'list_servers') {
    return {
      servers: ctx.servers.map((server) => ({
        name: server.name,
        status: server.status,
        enabled: server.enabled !== false,
        type: publicServerType(server),
        toolCount: server.tools?.length ?? 0,
        error: server.error,
      })),
    };
  }

  if (tool === 'list_tools') {
    const filter =
      typeof input.server === 'string' && input.server.trim() !== ''
        ? input.server.trim()
        : undefined;
    const tools = [];
    for (const server of ctx.servers) {
      if (filter && server.name !== filter) {
        continue;
      }
      for (const item of server.tools || []) {
        tools.push({
          name: shortToolName(server.name, item.name),
          description: item.description || '',
          enabled: item.enabled !== false,
          server: server.name,
        });
      }
    }
    return { tools };
  }

  if (tool === 'usage_summary' || tool === 'recent_failures') {
    let dao: ReturnType<typeof getActivityDao>;
    try {
      dao = typeof getActivityDao === 'function' ? getActivityDao() : undefined;
    } catch {
      dao = undefined;
    }
    if (!dao || typeof dao.getUsage !== 'function') {
      return {
        available: false,
        message: 'Activity logging is not available in this deployment',
      };
    }

    const days = clampInt(input.days, 7, 1, 90);
    const limit = clampInt(input.limit, 10, 1, 50);
    const usage = await dao.getUsage(days, limit);

    if (tool === 'usage_summary') {
      return {
        available: true,
        since: usage.since,
        days: usage.days,
        tools: usage.tools,
        users: usage.users,
      };
    }

    return {
      available: true,
      failures: (usage.recentErrors || []).map((row) => ({
        timestamp: row.timestamp,
        tool: row.tool,
        username: row.username,
        errorMessage: row.errorMessage,
      })),
    };
  }

  return { error: `Unknown platform tool: ${tool}` };
};

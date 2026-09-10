import { Server } from '@/types';

export interface ToolChange {
  server: string;
  added: string[];
  removed: string[];
}

const STORAGE_KEY = 'ylune.toolInventory.v1';

const shortName = (serverName: string, toolName: string): string => {
  const prefix = `${serverName}-`;
  return toolName.startsWith(prefix) ? toolName.slice(prefix.length) : toolName;
};

const snapshotFromServers = (servers: Server[]): Record<string, string[]> => {
  const next: Record<string, string[]> = {};
  for (const server of servers) {
    next[server.name] = (server.tools || [])
      .map((tool) => shortName(server.name, tool.name))
      .sort();
  }
  return next;
};

const loadSnapshot = (): Record<string, string[]> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

export const diffToolInventory = (servers: Server[]): ToolChange[] => {
  const previous = loadSnapshot();
  const current = snapshotFromServers(servers);
  if (Object.keys(previous).length === 0) {
    return [];
  }

  const names = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const changes: ToolChange[] = [];
  for (const name of names) {
    const before = new Set(previous[name] || []);
    const after = new Set(current[name] || []);
    const added = [...after].filter((tool) => !before.has(tool));
    const removed = [...before].filter((tool) => !after.has(tool));
    if (added.length || removed.length) {
      changes.push({ server: name, added, removed });
    }
  }
  return changes;
};

export const rememberToolInventory = (servers: Server[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshotFromServers(servers)));
};

export const extractSearchTags = (servers: Server[]): string[] => {
  const tags = new Set<string>();
  const tools = new Set<string>();
  for (const server of servers) {
    const description = server.config?.description || '';
    for (const match of description.match(/#[\w\u4e00-\u9fff-]+/g) || []) {
      tags.add(match);
    }
    for (const tool of server.tools || []) {
      tools.add(shortName(server.name, tool.name));
    }
  }
  const byName = (left: string, right: string) => left.localeCompare(right);
  return [...tags].sort(byName).concat([...tools].sort(byName));
};

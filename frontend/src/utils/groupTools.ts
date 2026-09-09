import { Group, IGroupServerConfig, Server } from '@/types';

export type GroupToolChip = {
  server: string;
  name: string;
};

export type GroupToolRow = {
  id: string;
  name: string;
  description?: string;
  members: string[];
  servers: string[];
  tools: GroupToolChip[];
};

function asServerEntry(server: string | IGroupServerConfig): IGroupServerConfig {
  return typeof server === 'string' ? { name: server, tools: 'all' } : server;
}

function liveToolNames(server?: Server): string[] {
  return (server?.tools || []).filter((tool) => tool.enabled !== false).map((tool) => tool.name);
}

export function buildGroupToolRows(groups: Group[], servers: Server[]): GroupToolRow[] {
  return groups.map((group) => {
    const entries = (group.servers || []).map(asServerEntry);
    const tools: GroupToolChip[] = [];

    for (const entry of entries) {
      const live = liveToolNames(servers.find((server) => server.name === entry.name));
      const selected = entry.tools === 'all' || entry.tools === undefined ? live : entry.tools;
      for (const name of selected) {
        tools.push({ server: entry.name, name });
      }
    }

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      members: group.members || [],
      servers: entries.map((entry) => entry.name),
      tools,
    };
  });
}

export function groupsWithoutMembers(groups: Group[]): string[] {
  return groups.filter((group) => !group.members || group.members.length === 0).map((group) => group.name);
}

export function serversNotInGroups(servers: Server[], groups: Group[]): string[] {
  const assigned = new Set(
    groups.flatMap((group) => (group.servers || []).map((server) => (typeof server === 'string' ? server : server.name))),
  );
  return servers.filter((server) => server.enabled !== false && !assigned.has(server.name)).map((server) => server.name);
}

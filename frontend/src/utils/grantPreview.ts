import { IGroupServerConfig, Server } from '@/types';

export interface GrantPreviewRow {
  server: string;
  connected: boolean;
  enabled: boolean;
  allTools: boolean;
  tools: string[];
}

const toolShortName = (serverName: string, toolName: string): string => {
  const prefix = `${serverName}-`;
  return toolName.startsWith(prefix) ? toolName.slice(prefix.length) : toolName;
};

export const summarizeGrants = (
  grants: IGroupServerConfig[] | undefined,
  servers: Server[],
  isAdmin = false,
): GrantPreviewRow[] => {
  if (isAdmin) {
    return servers
      .filter((server) => server.enabled !== false)
      .map((server) => ({
        server: server.name,
        connected: server.status === 'connected',
        enabled: server.enabled !== false,
        allTools: true,
        tools: (server.tools || []).map((tool) => toolShortName(server.name, tool.name)),
      }));
  }

  return (grants || []).map((grant) => {
    const server = servers.find((item) => item.name === grant.name);
    const liveNames = (server?.tools || []).map((tool) => toolShortName(grant.name, tool.name));
    const allTools = grant.tools === 'all' || grant.tools === undefined;
    const selected = Array.isArray(grant.tools) ? grant.tools : liveNames;
    return {
      server: grant.name,
      connected: server?.status === 'connected',
      enabled: server?.enabled !== false,
      allTools,
      tools: allTools ? liveNames : selected,
    };
  });
};

export const countGrantedTools = (rows: GrantPreviewRow[]): number =>
  rows.reduce((sum, row) => sum + row.tools.length, 0);

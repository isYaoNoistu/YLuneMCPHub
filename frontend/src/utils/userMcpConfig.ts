const sanitizeServerName = (username: string): string => {
  const safe = username.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  return `ylune-${safe || 'user'}`;
};

export const getHubBaseUrl = (installBaseUrl?: string): string => {
  const configured = installBaseUrl?.trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

export const buildUserMcpConfig = (
  token: string,
  username: string,
  installBaseUrl?: string,
): Record<string, unknown> => ({
  mcpServers: {
    [sanitizeServerName(username)]: {
      url: `${getHubBaseUrl(installBaseUrl)}/mcp`,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  },
});

export const formatUserMcpJson = (
  token: string,
  username: string,
  installBaseUrl?: string,
): string => JSON.stringify(buildUserMcpConfig(token, username, installBaseUrl), null, 2);

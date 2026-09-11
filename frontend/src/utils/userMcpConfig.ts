import { getBasePath } from './runtime';

const sanitizeServerName = (username: string): string => {
  const safe = username.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  return `ylune-${safe || 'user'}`;
};

export const isLoopbackHostname = (hostname: string): boolean => {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '0.0.0.0';
};

export const isIpHostname = (hostname: string): boolean => {
  const host = hostname.replace(/^\[|\]$/g, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return true;
  }
  return host.includes(':');
};

const isPublicHostname = (url: URL | null): boolean =>
  !!url && !isLoopbackHostname(url.hostname) && !isIpHostname(url.hostname);

const parseOrigin = (value?: string): URL | null => {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    return new URL(raw.includes('://') ? raw : `http://${raw}`);
  } catch {
    return null;
  }
};

const rewriteLocalViteOrigin = (origin: string): string => {
  try {
    const url = new URL(origin);
    if (isLoopbackHostname(url.hostname) && (url.port === '5173' || url.port === '5174')) {
      url.port = '3000';
    }
    return url.origin;
  } catch {
    return origin.replace(/\/+$/, '');
  }
};

/** Public origin agents should call. Prefer a real install URL; never keep localhost when the console is on a public host. */
export const resolveHubOrigin = (installBaseUrl?: string, pageOrigin?: string): string => {
  const configured = installBaseUrl?.trim().replace(/\/+$/, '') || '';
  const page = pageOrigin?.trim().replace(/\/+$/, '') || '';
  const configuredUrl = parseOrigin(configured);
  const pageUrl = parseOrigin(page);

  if (isPublicHostname(configuredUrl)) {
    return configured;
  }
  if (isPublicHostname(pageUrl) && pageUrl) {
    return rewriteLocalViteOrigin(pageUrl.origin);
  }
  if (configuredUrl && !isLoopbackHostname(configuredUrl.hostname)) {
    return configured;
  }
  if (pageUrl && !isLoopbackHostname(pageUrl.hostname)) {
    return rewriteLocalViteOrigin(pageUrl.origin);
  }
  if (configured) {
    return rewriteLocalViteOrigin(configuredUrl?.origin || configured);
  }
  if (page) {
    return rewriteLocalViteOrigin(pageUrl?.origin || page);
  }
  return 'http://127.0.0.1:3000';
};

export const joinMcpUrl = (origin: string, basePath = ''): string => {
  const root = origin.replace(/\/+$/, '');
  const prefix =
    !basePath || basePath === '/'
      ? ''
      : `/${basePath.replace(/^\/+|\/+$/g, '')}`;
  if (prefix && (root === prefix || root.endsWith(prefix))) {
    return `${root}/mcp`;
  }
  return `${root}${prefix}/mcp`;
};

export const getHubBaseUrl = (installBaseUrl?: string): string => {
  const pageOrigin = typeof window !== 'undefined' ? window.location?.origin : '';
  return resolveHubOrigin(installBaseUrl, pageOrigin);
};

export const getMcpEndpointUrl = (installBaseUrl?: string, basePath?: string): string => {
  const origin = getHubBaseUrl(installBaseUrl);
  const path = basePath ?? (typeof window !== 'undefined' ? getBasePath() : '');
  return joinMcpUrl(origin, path);
};

export const buildUserMcpConfig = (
  token: string,
  username: string,
  installBaseUrl?: string,
): Record<string, unknown> => ({
  mcpServers: {
    [sanitizeServerName(username)]: {
      url: getMcpEndpointUrl(installBaseUrl),
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

export type McpCopyFormat = 'json' | 'toml';

export const escapeTomlString = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** Codex reads ~/.codex/config.toml — a table fragment to merge, not a whole file. */
export const formatUserMcpToml = (
  token: string,
  username: string,
  installBaseUrl?: string,
): string => {
  const name = sanitizeServerName(username);
  const url = escapeTomlString(getMcpEndpointUrl(installBaseUrl));
  const authorization = escapeTomlString(`Bearer ${token}`);
  return [
    `[mcp_servers.${name}]`,
    `url = "${url}"`,
    `http_headers = { Authorization = "${authorization}" }`,
  ].join('\n');
};

export const formatUserMcpSnippet = (
  format: McpCopyFormat,
  token: string,
  username: string,
  installBaseUrl?: string,
): string =>
  format === 'toml'
    ? formatUserMcpToml(token, username, installBaseUrl)
    : formatUserMcpJson(token, username, installBaseUrl);

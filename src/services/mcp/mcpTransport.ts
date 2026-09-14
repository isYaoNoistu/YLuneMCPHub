import os from 'os';
import path from 'path';
import fs from 'fs';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  StreamableHTTPClientTransport,
  type StreamableHTTPClientTransportOptions,
} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { normalizeHeaders } from '@modelcontextprotocol/sdk/shared/transport.js';
import { expandEnvVars, replaceEnvVars } from '../../config/index.js';
import type { ProxychainsConfig, ServerConfig } from '../../types/index.js';
import { createAbortIsolatingFetch } from '../../utils/abortIsolatingFetch.js';
import { injectRefreshFlag } from '../../utils/cacheUtils.js';
import { logger } from '../../utils/logger.js';
import { assertSafeUrl, createRedirectValidatingFetch } from '../../utils/ssrf.js';
import { observeStdioStderr } from '../../utils/stdioDiagnostics.js';
import { createFetchWithProxy, getProxyConfigFromEnv } from '../proxy.js';
import { RequestContextService } from '../requestContextService.js';

type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>;

export interface McpTransportDependencies {
  createOAuthProvider: (name: string, conf: ServerConfig) => Promise<any>;
  isOwnerAdmin: (owner: string) => Promise<boolean>;
  getSystemConfig: () => Promise<
    | {
        install?: {
          pythonIndexUrl?: string;
          npmRegistry?: string;
        };
      }
    | null
    | undefined
  >;
  consumePendingReinstall: (name: string) => boolean;
}

const headerValueToString = (
  value: string | string[] | undefined,
): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
};

const getHeaderValue = (
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | string[] | undefined => {
  if (headers[name]) {
    return headers[name];
  }

  const lowerName = name.toLowerCase();
  if (headers[lowerName]) {
    return headers[lowerName];
  }

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  return undefined;
};

export const collectPassthroughHeaders = (
  requestHeaders: Record<string, string | string[] | undefined> | null,
  passthroughHeaderNames?: string[],
): Record<string, string> => {
  if (
    !requestHeaders ||
    !Array.isArray(passthroughHeaderNames) ||
    passthroughHeaderNames.length === 0
  ) {
    return {};
  }

  const passthroughHeaders: Record<string, string> = {};

  for (const headerName of passthroughHeaderNames) {
    const normalizedHeaderName = headerName.trim();
    if (!normalizedHeaderName) {
      continue;
    }

    const headerValue = headerValueToString(
      getHeaderValue(requestHeaders, normalizedHeaderName),
    );

    if (headerValue !== undefined) {
      passthroughHeaders[normalizedHeaderName] = headerValue;
    }
  }

  return passthroughHeaders;
};

export const createRequestContextAwareFetch = (
  baseFetch: FetchLike,
  passthroughHeaderNames?: string[],
): FetchLike => {
  if (!Array.isArray(passthroughHeaderNames) || passthroughHeaderNames.length === 0) {
    return baseFetch;
  }

  return async (url: string | URL, init?: RequestInit) => {
    const requestHeaders = RequestContextService.getInstance().getHeaders();
    const passthroughHeaders = collectPassthroughHeaders(
      requestHeaders,
      passthroughHeaderNames,
    );

    if (Object.keys(passthroughHeaders).length === 0) {
      return baseFetch(url, init);
    }

    return baseFetch(url, {
      ...init,
      headers: {
        ...normalizeHeaders(init?.headers),
        ...passthroughHeaders,
      },
    });
  };
};

/**
 * Check if proxychains4 is available on the system (Linux/macOS only).
 * Returns the path to proxychains4 if found, null otherwise.
 */
export const findProxychains4 = (): string | null => {
  if (process.platform === 'win32') {
    return null;
  }

  const possiblePaths = [
    '/usr/bin/proxychains4',
    '/usr/local/bin/proxychains4',
    '/opt/homebrew/bin/proxychains4',
    '/usr/local/Cellar/proxychains-ng/*/bin/proxychains4',
  ];

  for (const candidate of possiblePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  const pathEnv = process.env.PATH || '';
  const pathDirs = pathEnv.split(path.delimiter);
  for (const dir of pathDirs) {
    const fullPath = path.join(dir, 'proxychains4');
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
};

/**
 * Generate a temporary proxychains4 configuration file.
 * Returns the path to the generated config file.
 */
export const generateProxychainsConfig = (
  serverName: string,
  proxyConfig: ProxychainsConfig,
): string | null => {
  if (proxyConfig.configPath) {
    if (fs.existsSync(proxyConfig.configPath)) {
      return proxyConfig.configPath;
    }
    logger.warn(`[${serverName}] Custom proxychains config not found: ${proxyConfig.configPath}`);
    return null;
  }

  if (!proxyConfig.host || !proxyConfig.port) {
    logger.warn(`[${serverName}] Proxy host and port are required for proxychains4`);
    return null;
  }

  const proxyType = proxyConfig.type || 'socks5';
  const proxyLine =
    proxyConfig.username && proxyConfig.password
      ? `${proxyType} ${proxyConfig.host} ${proxyConfig.port} ${proxyConfig.username} ${proxyConfig.password}`
      : `${proxyType} ${proxyConfig.host} ${proxyConfig.port}`;

  const configContent = `# Proxychains4 configuration for MCP server: ${serverName}
# Generated by MCPHub

localnet 127.0.0.0/255.0.0.0
localnet 10.0.0.0/255.0.0.0
localnet 172.16.0.0/255.240.0.0
localnet 192.168.0.0/255.255.0.0

strict_chain
proxy_dns
remote_dns_subnet 224
tcp_read_time_out 15000
tcp_connect_time_out 8000

[ProxyList]
${proxyLine}
`;

  const tempDir = path.join(os.tmpdir(), 'mcphub-proxychains');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const configPath = path.join(
    tempDir,
    `${serverName.replace(/[^a-zA-Z0-9-_]/g, '_')}.conf`,
  );
  fs.writeFileSync(configPath, configContent, 'utf-8');
  logger.log(`[${serverName}] Generated proxychains4 config: ${configPath}`);

  return configPath;
};

const isSafeCommand = (command: string): boolean => {
  const blockedCommands = new Set([
    'sh',
    'bash',
    'zsh',
    'fish',
    'csh',
    'ksh',
    'tcsh',
    'cmd',
    'powershell',
    'pwsh',
    'eval',
    'exec',
    'source',
    '.',
  ]);

  const basename = command.split('/').pop()?.split('\\').pop()?.toLowerCase() || '';
  if (blockedCommands.has(basename)) {
    return false;
  }

  return !/[;&|`$(){}[\]!]/.test(command);
};

const sanitizeArgs = (args: string[]): string[] => {
  return args.map((arg) => {
    if (/^[a-zA-Z0-9._/\\:@=+,-]+$/.test(arg)) {
      return arg;
    }
    logger.warn(`[proxychains] Potentially unsafe argument blocked: ${arg}`);
    return arg.replace(/[;&|`$(){}[\]!><\n\r]/g, '');
  });
};

/**
 * Wrap a command with proxychains4 if proxy is configured and available.
 * Returns modified command and args if proxychains4 is used, original values otherwise.
 */
export const wrapWithProxychains = (
  serverName: string,
  command: string,
  args: string[],
  proxyConfig?: ProxychainsConfig,
): { command: string; args: string[] } => {
  if (!proxyConfig?.enabled) {
    return { command, args };
  }

  if (process.platform === 'win32') {
    logger.warn(
      `[${serverName}] proxychains4 proxy is not supported on Windows, ignoring proxy configuration`,
    );
    return { command, args };
  }

  if (!isSafeCommand(command)) {
    logger.error(`[${serverName}] Blocked unsafe command for proxychains4 wrapping: ${command}`);
    throw new Error(
      `[${serverName}] Unsafe command blocked: ${command}. Shell builtins and metacharacters are not allowed.`,
    );
  }

  const proxychains4Path = findProxychains4();
  if (!proxychains4Path) {
    logger.warn(
      `[${serverName}] proxychains4 not found on system, install it with: apt install proxychains4 (Debian/Ubuntu) or brew install proxychains-ng (macOS)`,
    );
    return { command, args };
  }

  const configPath = generateProxychainsConfig(serverName, proxyConfig);
  if (!configPath) {
    logger.warn(`[${serverName}] Failed to setup proxychains4 configuration, skipping proxy`);
    return { command, args };
  }

  const sanitizedArgs = sanitizeArgs(args);
  logger.log(
    `[${serverName}] Using proxychains4 proxy: ${proxyConfig.type || 'socks5'}://${proxyConfig.host}:${proxyConfig.port}`,
  );

  return {
    command: proxychains4Path,
    args: ['-f', configPath, command, ...sanitizedArgs],
  };
};

const stripAuthorizationHeader = (
  headers: Record<string, string>,
): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(headers).filter(([key]) => key.toLowerCase() !== 'authorization'),
  );
};

export const createTransportFromConfig = async (
  name: string,
  conf: ServerConfig,
  dependencies: McpTransportDependencies,
): Promise<any> => {
  let transport;
  const envSource: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ...(conf.env || {}),
  };
  const env: Record<string, string> = {
    ...envSource,
    ...replaceEnvVars(conf.env || {}, envSource),
  };
  const resolvedUrl = conf.url ? replaceEnvVars(conf.url, env) : '';
  const allowInternal = conf.owner ? await dependencies.isOwnerAdmin(conf.owner) : false;

  if (resolvedUrl) {
    await assertSafeUrl(resolvedUrl, { allowInternal });
  }

  if (conf.type === 'streamable-http') {
    const options: StreamableHTTPClientTransportOptions = {};
    let headers = conf.headers ? replaceEnvVars(conf.headers, env) : {};
    const baseFetch = createAbortIsolatingFetch(createFetchWithProxy(getProxyConfigFromEnv(env)));
    const requestAwareFetch = createRedirectValidatingFetch(
      createRequestContextAwareFetch(baseFetch, conf.passthroughHeaders),
      allowInternal,
    );

    const authProvider = await dependencies.createOAuthProvider(name, conf);
    if (authProvider) {
      options.authProvider = authProvider;
      headers = stripAuthorizationHeader(headers);
      logger.log(`OAuth provider configured for server: ${name}`);
    }

    if (Object.keys(headers).length > 0) {
      options.requestInit = {
        headers,
      };
    }

    options.fetch = requestAwareFetch;
    transport = new StreamableHTTPClientTransport(new URL(resolvedUrl), options);
  } else if (resolvedUrl) {
    const options: any = {};
    let headers = conf.headers ? replaceEnvVars(conf.headers, env) : {};
    const baseFetch = createAbortIsolatingFetch(createFetchWithProxy(getProxyConfigFromEnv(env)));
    const requestAwareFetch = createRedirectValidatingFetch(
      createRequestContextAwareFetch(baseFetch, conf.passthroughHeaders),
      allowInternal,
    );

    const authProvider = await dependencies.createOAuthProvider(name, conf);
    if (authProvider) {
      options.authProvider = authProvider;
      headers = stripAuthorizationHeader(headers);
      logger.log(`OAuth provider configured for server: ${name}`);
    }

    if (Object.keys(headers).length > 0) {
      options.eventSourceInit = {
        headers,
        fetch: requestAwareFetch,
      };
      options.requestInit = {
        headers,
      };
    } else {
      options.eventSourceInit = {
        fetch: requestAwareFetch,
      };
    }

    options.fetch = requestAwareFetch;
    transport = new SSEClientTransport(new URL(resolvedUrl), options);
  } else if (conf.command) {
    env.PATH = expandEnvVars(process.env.PATH as string) || '';

    const systemConfig = await dependencies.getSystemConfig();
    if (
      systemConfig?.install?.pythonIndexUrl &&
      (conf.command === 'uvx' || conf.command === 'uv' || conf.command === 'python')
    ) {
      env.UV_DEFAULT_INDEX = systemConfig.install.pythonIndexUrl;
    }

    if (
      systemConfig?.install?.npmRegistry &&
      (conf.command === 'npm' ||
        conf.command === 'npx' ||
        conf.command === 'pnpm' ||
        conf.command === 'yarn' ||
        conf.command === 'node')
    ) {
      env.npm_config_registry = systemConfig.install.npmRegistry;
    }

    let resolvedArgs = replaceEnvVars(conf.args ?? [], env) as string[];
    if (dependencies.consumePendingReinstall(name)) {
      resolvedArgs = injectRefreshFlag(conf.command, resolvedArgs);
      logger.log(`[${name}] Injected cache refresh flags for reinstall`);
    }

    const { command: finalCommand, args: finalArgs } = wrapWithProxychains(
      name,
      replaceEnvVars(conf.command, env),
      resolvedArgs,
      conf.proxy,
    );

    transport = new StdioClientTransport({
      cwd: process.cwd(),
      command: finalCommand,
      args: finalArgs,
      env,
      stderr: 'pipe',
    });
    if (transport.stderr) {
      observeStdioStderr(transport, transport.stderr, (message) => {
        logger.log(
          'Upstream server stderr',
          JSON.stringify({
            serverName: name,
            message,
          }),
        );
      });
    }
  } else {
    throw new Error(`Unable to create transport for server: ${name}`);
  }

  return transport;
};

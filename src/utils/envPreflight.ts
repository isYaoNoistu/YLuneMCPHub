import { ServerConfig } from '../types/index.js';

export interface EnvPreflightItem {
  name: string;
  referenced: boolean;
  resolved: boolean;
}

const ENV_REF_RE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

const IGNORED_ENV_KEYS = new Set([
  'PATH',
  'PATHEXT',
  'SYSTEMROOT',
  'WINDIR',
  'HOME',
  'USER',
  'USERNAME',
  'USERPROFILE',
  'TMP',
  'TEMP',
  'TMPDIR',
  'NODE_ENV',
  'NODE_OPTIONS',
  'NODE_PATH',
  'npm_config_registry',
  'UV_DEFAULT_INDEX',
  'LANG',
  'LC_ALL',
  'TERM',
  'SHELL',
  'PWD',
  'OLDPWD',
  'SHLVL',
  'DISPLAY',
]);

export const collectEnvRefNames = (value: unknown, names = new Set<string>()): Set<string> => {
  if (typeof value === 'string') {
    for (const match of value.matchAll(ENV_REF_RE)) {
      if (match[1]) {
        names.add(match[1]);
      }
    }
    return names;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectEnvRefNames(item, names);
    }
    return names;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      collectEnvRefNames(item, names);
    }
  }
  return names;
};

export const buildEnvPreflight = (
  config: unknown,
  env: NodeJS.ProcessEnv = process.env,
): EnvPreflightItem[] => {
  const names = [...collectEnvRefNames(config)].sort((left, right) => left.localeCompare(right));
  return names.map((name) => ({
    name,
    referenced: true,
    resolved: typeof env[name] === 'string' && env[name] !== '',
  }));
};

/** Keys an MCP server expects callers to supply (env names, header ${VAR} refs). */
export const collectCredentialNeeds = (
  config: Pick<ServerConfig, 'env' | 'headers' | 'url' | 'args' | 'command'> | null | undefined,
): string[] => {
  const names = new Set<string>();
  if (!config) {
    return [];
  }
  for (const key of Object.keys(config.env || {})) {
    if (!IGNORED_ENV_KEYS.has(key)) {
      names.add(key);
    }
  }
  collectEnvRefNames(
    {
      env: config.env,
      headers: config.headers,
      url: config.url,
      args: config.args,
      command: config.command,
    },
    names,
  );
  return [...names]
    .filter((name) => !IGNORED_ENV_KEYS.has(name))
    .sort((left, right) => left.localeCompare(right));
};

export const overlayCredentialFields = (
  config: ServerConfig,
  fields: Record<string, string>,
): ServerConfig => ({
  ...config,
  env: {
    ...(config.env || {}),
    ...fields,
  },
});

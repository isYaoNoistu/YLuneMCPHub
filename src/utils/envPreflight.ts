export interface EnvPreflightItem {
  name: string;
  referenced: boolean;
  resolved: boolean;
}

const ENV_REF_RE = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

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

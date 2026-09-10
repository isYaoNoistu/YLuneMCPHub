import type { SystemConfig } from '../types/index.js';

export const INSTALL_BASE_URL_ENV = 'INSTALL_BASE_URL';
export const YLUNE_DOMAIN_ENV = 'YLUNE_DOMAIN';
export const DEFAULT_INSTALL_BASE_URL = 'http://localhost:3000';

const normalizeInstallBaseUrl = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
};

const normalizeBasePath = (value?: string | null): string => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === '/') {
    return '';
  }
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
};

const hostFromDomain = (value?: string | null): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  const withoutScheme = trimmed.replace(/^https?:\/\//i, '');
  const host = withoutScheme.split('/')[0]?.trim();
  return host || undefined;
};

export const getInstallBaseUrlFromEnv = (
  env: NodeJS.ProcessEnv = process.env,
): string | undefined => {
  const explicit = normalizeInstallBaseUrl(env[INSTALL_BASE_URL_ENV]);
  if (explicit) {
    return explicit;
  }

  const host = hostFromDomain(env[YLUNE_DOMAIN_ENV]);
  if (!host) {
    return undefined;
  }

  return `https://${host}${normalizeBasePath(env.BASE_PATH)}`;
};

export const resolveInstallBaseUrl = (
  systemConfig?: Pick<SystemConfig, 'install'> | null,
  fallback?: string,
  env: NodeJS.ProcessEnv = process.env,
): string | undefined =>
  getInstallBaseUrlFromEnv(env) ??
  normalizeInstallBaseUrl(systemConfig?.install?.baseUrl) ??
  normalizeInstallBaseUrl(fallback);

export const withResolvedInstallBaseUrl = (
  systemConfig?: SystemConfig | null,
  fallback?: string,
  env: NodeJS.ProcessEnv = process.env,
): SystemConfig => {
  const resolvedBaseUrl = resolveInstallBaseUrl(systemConfig, fallback, env);

  return {
    ...(systemConfig ?? {}),
    install: {
      ...(systemConfig?.install ?? {}),
      ...(resolvedBaseUrl ? { baseUrl: resolvedBaseUrl } : {}),
    },
  };
};

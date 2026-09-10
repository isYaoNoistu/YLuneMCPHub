export const USER_TOKEN_TTL_DAYS = {
  '1d': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
} as const;

export type UserTokenLifetime = 'permanent' | keyof typeof USER_TOKEN_TTL_DAYS | 'custom';

const isLifetimePreset = (value: string): value is keyof typeof USER_TOKEN_TTL_DAYS =>
  value in USER_TOKEN_TTL_DAYS;

export const parseTokenExpiresAt = (value: Date | string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const isUserTokenExpired = (user: {
  isAdmin?: boolean;
  tokenExpiresAt?: Date | string | null;
}): boolean => {
  if (user.isAdmin) {
    return false;
  }
  const expiresAt = parseTokenExpiresAt(user.tokenExpiresAt);
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
};

export const isCustomExpiryIncomplete = (input: {
  tokenLifetime?: string | null;
  tokenExpiresAt?: string | Date | null;
}): boolean => input.tokenLifetime === 'custom' && !parseTokenExpiresAt(input.tokenExpiresAt);

export const isCustomExpiryInPast = (input: {
  tokenLifetime?: string | null;
  tokenExpiresAt?: string | Date | null;
}): boolean => {
  if (input.tokenLifetime && input.tokenLifetime !== 'custom') {
    return false;
  }
  const expiresAt = parseTokenExpiresAt(input.tokenExpiresAt);
  return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
};

export const resolveTokenExpiresAt = (input: {
  isAdmin?: boolean;
  tokenLifetime?: string | null;
  tokenExpiresAt?: string | Date | null;
}): Date | null => {
  if (input.isAdmin) {
    return null;
  }
  if (input.tokenLifetime === 'permanent') {
    return null;
  }
  if (input.tokenLifetime === 'custom' || (!input.tokenLifetime && input.tokenExpiresAt)) {
    return parseTokenExpiresAt(input.tokenExpiresAt);
  }
  if (input.tokenLifetime && isLifetimePreset(input.tokenLifetime)) {
    const days = USER_TOKEN_TTL_DAYS[input.tokenLifetime];
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  if (input.tokenExpiresAt === null) {
    return null;
  }
  return parseTokenExpiresAt(input.tokenExpiresAt);
};

export const serializeTokenExpiresAt = (
  value: Date | string | null | undefined,
): string | null => {
  const date = parseTokenExpiresAt(value);
  return date ? date.toISOString() : null;
};

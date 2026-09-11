type UserLike = {
  isAdmin?: boolean;
  demo?: boolean;
} | null | undefined;

export const isDemoUser = (user: UserLike): boolean => Boolean(user?.demo);

export const DEMO_BLOCKED_PATHS = [
  '/users',
  '/credentials',
  '/activity',
  '/audit',
  '/logs',
  '/settings',
  '/groups',
] as const;

export const isDemoBlockedPath = (pathname: string): boolean =>
  DEMO_BLOCKED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export const canViewSystemLogs = (user: UserLike): boolean =>
  Boolean(user?.isAdmin) && !isDemoUser(user);

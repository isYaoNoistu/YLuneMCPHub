import type { Server, User } from '../types';
import { isExpiredUser, isExpiringSoon } from './expiryCenter';

export type DashboardAttentionKind =
  | 'disconnected'
  | 'empty_grants'
  | 'expired_users'
  | 'expiring_users';

export type DashboardAttentionItem = {
  kind: DashboardAttentionKind;
  names: string[];
};

export const buildDashboardAttention = (
  servers: readonly Server[],
  users: readonly User[],
): DashboardAttentionItem[] => {
  const disconnected = servers
    .filter((server) => server.enabled !== false && server.status !== 'connected')
    .map((server) => server.name);
  const emptyGrants = users
    .filter((user) => !user.isAdmin && (!user.grants || user.grants.length === 0))
    .map((user) => user.username);
  const expiredUsers = users.filter(isExpiredUser).map((user) => user.username);
  const expiringUsers = users.filter((user) => isExpiringSoon(user)).map((user) => user.username);

  return [
    { kind: 'disconnected' as const, names: disconnected },
    { kind: 'empty_grants' as const, names: emptyGrants },
    { kind: 'expired_users' as const, names: expiredUsers },
    { kind: 'expiring_users' as const, names: expiringUsers },
  ].filter((item) => item.names.length > 0);
};

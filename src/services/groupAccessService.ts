import {
  EffectiveGroupAccess,
  IGroup,
  IGroupServerConfig,
  IUser,
} from '../types/index.js';
import { getGroupDao, getUserDao } from '../dao/index.js';
import { UserContextService } from './userContextService.js';

const normalizeGroupServers = (servers: IGroup['servers'] = []): IGroupServerConfig[] =>
  servers.map((server) =>
    typeof server === 'string'
      ? { name: server, tools: 'all', prompts: 'all', resources: 'all' }
      : {
          name: server.name,
          ...(server.alias?.trim() ? { alias: server.alias.trim() } : {}),
          tools: server.tools || 'all',
          prompts: server.prompts || 'all',
          resources: server.resources || 'all',
        },
  );

export type GroupAccessPrincipal = Pick<IUser, 'username'> & { isAdmin?: boolean };

export const isUnrestrictedPrincipal = (
  user?: GroupAccessPrincipal | null,
): boolean => Boolean(!user?.username || user.isAdmin);

const isRestrictedMember = (
  user?: GroupAccessPrincipal | null,
): user is GroupAccessPrincipal & { username: string } =>
  Boolean(user?.username && !user.isAdmin);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isGroupMember = (group: IGroup, username: string): boolean => {
  return (group.members || []).includes(username);
};

const mergeCapability = (
  left?: string[] | 'all',
  right?: string[] | 'all',
): string[] | 'all' => {
  const a = left ?? 'all';
  const b = right ?? 'all';
  if (a === 'all' || b === 'all') {
    return 'all';
  }
  return [...new Set([...a, ...b])];
};

export const mergeGroupServerConfigs = (groups: IGroup[]): Map<string, IGroupServerConfig> => {
  const merged = new Map<string, IGroupServerConfig>();
  for (const group of groups) {
    for (const server of normalizeGroupServers(group.servers || [])) {
      const existing = merged.get(server.name);
      if (!existing) {
        merged.set(server.name, { ...server });
        continue;
      }
      merged.set(server.name, {
        name: server.name,
        alias: existing.alias || server.alias,
        tools: mergeCapability(existing.tools, server.tools),
        prompts: mergeCapability(existing.prompts, server.prompts),
        resources: mergeCapability(existing.resources, server.resources),
      });
    }
  }
  return merged;
};

export const unrestrictedAccess = (): EffectiveGroupAccess => ({
  unrestricted: true,
  groups: [],
  serversByName: new Map(),
});

export const accessFromGrants = (grants?: IGroupServerConfig[] | null): EffectiveGroupAccess => ({
  unrestricted: false,
  groups: [],
  serversByName: mergeGroupServerConfigs([
    { id: 'user-grants', name: 'user-grants', servers: grants || [] },
  ]),
});

export const getMemberGroups = async (username: string): Promise<IGroup[]> => {
  return getGroupDao().findByMember(username);
};

export const getEffectiveAccess = async (
  user?: GroupAccessPrincipal | null,
): Promise<EffectiveGroupAccess> => {
  const current = user === undefined ? UserContextService.getInstance().getCurrentUser() : user;
  // Admins (and unauthenticated/system callers) keep full access.
  if (!isRestrictedMember(current)) {
    return unrestrictedAccess();
  }

  const persisted = await getUserDao().findByUsername(current.username);
  if (persisted && Array.isArray(persisted.grants)) {
    return accessFromGrants(persisted.grants);
  }

  const groups = await getMemberGroups(current.username);
  return {
    unrestricted: false,
    groups,
    serversByName: mergeGroupServerConfigs(groups),
  };
};

export const ensureEffectiveAccess = async (): Promise<EffectiveGroupAccess> => {
  const context = UserContextService.getInstance();
  const cached = context.getEffectiveAccess();
  if (cached) {
    return cached;
  }
  const access = await getEffectiveAccess();
  context.setEffectiveAccess(access);
  return access;
};

export const isServerGranted = (access: EffectiveGroupAccess, serverName: string): boolean => {
  return access.unrestricted || access.serversByName.has(serverName);
};

export const isGroupRouteAllowed = async (
  user: GroupAccessPrincipal | null | undefined,
  groupOrServer: string,
): Promise<boolean> => {
  const access = await getEffectiveAccess(user);
  if (access.unrestricted) {
    return true;
  }
  if (!user?.username || !groupOrServer) {
    return false;
  }

  const groupDao = getGroupDao();
  let group = await groupDao.findByName(groupOrServer);
  if (!group && UUID_RE.test(groupOrServer)) {
    group = await groupDao.findById(groupOrServer);
  }
  if (group) {
    return isGroupMember(group, user.username);
  }
  return access.serversByName.has(groupOrServer);
};

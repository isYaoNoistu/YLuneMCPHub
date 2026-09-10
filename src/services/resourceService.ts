import { getCredentialDao, getResourceDao, getServerDao } from '../dao/DaoFactory.js';
import {
  IActivityChain,
  IResourceGroup,
  IResourceGroupItem,
  IResourceTarget,
  IResourceTargetConfig,
  ResourceTargetType,
} from '../types/index.js';
import { getUserByUsername } from './userService.js';
import { createCredentialLease } from './credentialBrokerService.js';

const TARGET_TYPES: ResourceTargetType[] = ['postgresql', 'http', 'custom'];
const SECRET_ARG_KEYS = new Set([
  'password',
  'token',
  'secret',
  'apiKey',
  'api_key',
  'encryptedPayload',
  'encrypted_payload',
]);

export class ResourceStoreUnavailableError extends Error {
  constructor() {
    super('Resource store is only available in database mode');
    this.name = 'ResourceStoreUnavailableError';
  }
}

export class ResourceBindingDeniedError extends Error {
  constructor(message = 'Target is not bound for this user') {
    super(message);
    this.name = 'ResourceBindingDeniedError';
  }
}

export const requireResourceDao = () => {
  const dao = getResourceDao();
  if (!dao) {
    throw new ResourceStoreUnavailableError();
  }
  return dao;
};

const isTargetType = (value: unknown): value is ResourceTargetType =>
  typeof value === 'string' && TARGET_TYPES.includes(value as ResourceTargetType);

const sanitizeTargetConfig = (input: unknown): IResourceTargetConfig => {
  if (!input || typeof input !== 'object') {
    return {};
  }
  const raw = input as Record<string, unknown>;
  const config: IResourceTargetConfig = {};
  if (typeof raw.host === 'string') {
    config.host = raw.host.trim();
  }
  if (raw.port !== undefined) {
    const port = Number(raw.port);
    if (Number.isFinite(port)) {
      config.port = port;
    }
  }
  if (typeof raw.database === 'string') {
    config.database = raw.database.trim();
  }
  if (typeof raw.url === 'string') {
    config.url = raw.url.trim();
  }
  return config;
};

const publicTarget = (target: IResourceTarget): IResourceTarget => ({
  ...target,
  config: sanitizeTargetConfig(target.config),
});

export const listResourceTargets = async (): Promise<IResourceTarget[]> =>
  (await requireResourceDao().findAllTargets()).map(publicTarget);

export const createResourceTarget = async (input: {
  name?: string;
  type?: string;
  config?: unknown;
  enabled?: boolean;
}): Promise<IResourceTarget> => {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new Error('Name is required');
  }
  if (!isTargetType(input.type)) {
    throw new Error('Type must be postgresql, http, or custom');
  }
  const dao = requireResourceDao();
  if (await dao.findTargetByName(name)) {
    throw new Error('A target with this name already exists');
  }
  return publicTarget(
    await dao.createTarget({
      name,
      type: input.type,
      config: sanitizeTargetConfig(input.config),
      enabled: input.enabled !== false,
    }),
  );
};

export const updateResourceTarget = async (
  id: string,
  input: { name?: string; type?: string; config?: unknown; enabled?: boolean },
): Promise<IResourceTarget | null> => {
  const dao = requireResourceDao();
  const existing = await dao.findTargetById(id);
  if (!existing) {
    return null;
  }
  const patch: Partial<IResourceTarget> = {};
  if (typeof input.name === 'string') {
    const name = input.name.trim();
    if (!name) {
      throw new Error('Name is required');
    }
    const clash = await dao.findTargetByName(name);
    if (clash && clash.id !== id) {
      throw new Error('A target with this name already exists');
    }
    patch.name = name;
  }
  if (input.type !== undefined) {
    if (!isTargetType(input.type)) {
      throw new Error('Type must be postgresql, http, or custom');
    }
    patch.type = input.type;
  }
  if (input.config !== undefined) {
    patch.config = sanitizeTargetConfig(input.config);
  }
  if (input.enabled !== undefined) {
    patch.enabled = Boolean(input.enabled);
  }
  const updated = await dao.updateTarget(id, patch);
  return updated ? publicTarget(updated) : null;
};

export const deleteResourceTarget = async (id: string): Promise<boolean> =>
  requireResourceDao().deleteTarget(id);

const normalizeItems = (
  items: unknown,
): Omit<IResourceGroupItem, 'id' | 'groupId'>[] => {
  if (!Array.isArray(items)) {
    return [];
  }
  return items.map((item) => {
    const row = item as Record<string, unknown>;
    const serverName = typeof row.serverName === 'string' ? row.serverName.trim() : '';
    const targetId = typeof row.targetId === 'string' ? row.targetId.trim() : '';
    const credentialId = typeof row.credentialId === 'string' ? row.credentialId.trim() : '';
    if (!serverName || !targetId || !credentialId) {
      throw new Error('Each binding needs serverName, targetId, and credentialId');
    }
    return {
      serverName,
      targetId,
      credentialId,
      alias: typeof row.alias === 'string' ? row.alias.trim() : null,
      enabled: row.enabled !== false,
    };
  });
};

export const listResourceGroups = async (): Promise<IResourceGroup[]> =>
  requireResourceDao().findAllGroups();

export const createResourceGroup = async (input: {
  name?: string;
  description?: string;
  enabled?: boolean;
  items?: unknown;
}): Promise<IResourceGroup> => {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new Error('Name is required');
  }
  const dao = requireResourceDao();
  if (await dao.findGroupByName(name)) {
    throw new Error('A resource group with this name already exists');
  }
  const items = normalizeItems(input.items);
  await assertBindingsExist(items);
  return dao.createGroup({
    name,
    description: typeof input.description === 'string' ? input.description : null,
    enabled: input.enabled !== false,
    items,
  });
};

export const updateResourceGroup = async (
  id: string,
  input: { name?: string; description?: string; enabled?: boolean; items?: unknown },
): Promise<IResourceGroup | null> => {
  const dao = requireResourceDao();
  const existing = await dao.findGroupById(id);
  if (!existing) {
    return null;
  }
  if (typeof input.name === 'string') {
    const name = input.name.trim();
    if (!name) {
      throw new Error('Name is required');
    }
    const clash = await dao.findGroupByName(name);
    if (clash && clash.id !== id) {
      throw new Error('A resource group with this name already exists');
    }
  }
  const items = input.items !== undefined ? normalizeItems(input.items) : undefined;
  if (items) {
    await assertBindingsExist(items);
  }
  return dao.updateGroup(id, {
    name: typeof input.name === 'string' ? input.name.trim() : undefined,
    description: input.description,
    enabled: input.enabled,
    items,
  });
};

export const deleteResourceGroup = async (id: string): Promise<boolean> =>
  requireResourceDao().deleteGroup(id);

const assertBindingsExist = async (
  items: Omit<IResourceGroupItem, 'id' | 'groupId'>[],
): Promise<void> => {
  const dao = requireResourceDao();
  const credentialDao = getCredentialDao();
  const serverDao = getServerDao();
  for (const item of items) {
    if (!(await dao.findTargetById(item.targetId))) {
      throw new Error(`Target not found: ${item.targetId}`);
    }
    if (credentialDao && !(await credentialDao.findById(item.credentialId))) {
      throw new Error(`Credential not found: ${item.credentialId}`);
    }
    if (serverDao && !(await serverDao.findById(item.serverName))) {
      throw new Error(`Server not found: ${item.serverName}`);
    }
  }
};

export const listUserResourceGroupIds = async (username: string): Promise<string[]> => {
  const dao = getResourceDao();
  if (!dao) {
    return [];
  }
  return (await dao.findAssignmentsByUser(username)).map((row) => row.groupId);
};

export const attachResourceGroupIds = async <T extends { username: string }>(
  users: T[],
): Promise<(T & { resourceGroupIds: string[] })[]> => {
  const dao = getResourceDao();
  if (!dao) {
    return users.map((user) => ({ ...user, resourceGroupIds: [] }));
  }
  const assignments = await dao.findAllAssignments();
  const map = new Map<string, string[]>();
  for (const row of assignments) {
    const list = map.get(row.username) || [];
    list.push(row.groupId);
    map.set(row.username, list);
  }
  return users.map((user) => ({ ...user, resourceGroupIds: map.get(user.username) || [] }));
};

export const setUserResourceGroups = async (
  username: string,
  groupIds: string[],
  createdBy?: string,
): Promise<string[]> => {
  const dao = requireResourceDao();
  const unique = [...new Set(groupIds.filter((id) => typeof id === 'string' && id.trim()))];
  for (const id of unique) {
    if (!(await dao.findGroupById(id))) {
      throw new Error(`Resource group not found: ${id}`);
    }
  }
  await dao.replaceUserAssignments(username, unique, createdBy);
  return unique;
};

export const stripSecretArgs = (args: unknown): Record<string, unknown> => {
  if (!args || typeof args !== 'object' || Array.isArray(args)) {
    return {};
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
    if (SECRET_ARG_KEYS.has(key) || SECRET_ARG_KEYS.has(key.toLowerCase())) {
      continue;
    }
    result[key] = value;
  }
  return result;
};

export const extractTargetRef = (args: unknown): string | undefined => {
  if (!args || typeof args !== 'object') {
    return undefined;
  }
  const record = args as Record<string, unknown>;
  const raw = record.target ?? record.targetName ?? record.target_id ?? record.targetId;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined;
};

const targetMatches = (target: IResourceTarget, item: IResourceGroupItem, ref: string): boolean =>
  target.id === ref || target.name === ref || item.alias === ref;

export const findResourceBinding = async (input: {
  username: string;
  serverName: string;
  targetRef: string;
  groupIds?: string[];
}): Promise<{
  target: IResourceTarget;
  credentialId: string;
  credentialName: string;
  credentialVersion: number;
  group: IResourceGroup;
  item: IResourceGroupItem;
} | null> => {
  const dao = getResourceDao();
  const credentialDao = getCredentialDao();
  if (!dao) {
    return null;
  }
  const groups = await dao.findAllGroups();
  const allowed = input.groupIds ? new Set(input.groupIds) : null;
  for (const group of groups) {
    if (!group.enabled) continue;
    if (allowed && !allowed.has(group.id)) continue;
    for (const item of group.items) {
      if (!item.enabled || item.serverName !== input.serverName) continue;
      const target = await dao.findTargetById(item.targetId);
      if (!target?.enabled || !targetMatches(target, item, input.targetRef)) continue;
      const credential = credentialDao ? await credentialDao.findById(item.credentialId) : null;
      if (!credential?.enabled) continue;
      return {
        target,
        credentialId: credential.id,
        credentialName: credential.name,
        credentialVersion: credential.keyVersion,
        group,
        item,
      };
    }
  }
  return null;
};

export const authorizeToolResourceAccess = async (input: {
  username?: string;
  serverName: string;
  args: unknown;
}): Promise<{ sanitizedArgs: Record<string, unknown>; chain: IActivityChain }> => {
  const sanitizedArgs = stripSecretArgs(input.args);
  const targetRef = extractTargetRef(input.args);
  const chain: IActivityChain = {};
  if (!input.username) {
    return { sanitizedArgs, chain };
  }

  const dao = getResourceDao();
  if (!dao) {
    return { sanitizedArgs, chain };
  }

  const user = await getUserByUsername(input.username);
  const isAdmin = Boolean(user?.isAdmin);
  const assigned = await listUserResourceGroupIds(input.username);
  const hasBindings = assigned.length > 0;

  if (!targetRef) {
    return { sanitizedArgs, chain };
  }

  const match = await findResourceBinding({
    username: input.username,
    serverName: input.serverName,
    targetRef,
    groupIds: isAdmin ? undefined : hasBindings ? assigned : [],
  });

  if (!match) {
    if (hasBindings && !isAdmin) {
      throw new ResourceBindingDeniedError();
    }
    const byName = await dao.findTargetByName(targetRef);
    const byId = byName || (await dao.findTargetById(targetRef));
    if (byId) {
      chain.targetId = byId.id;
      chain.targetName = byId.name;
    }
    return { sanitizedArgs, chain };
  }

  const lease = createCredentialLease({
    username: input.username,
    serverName: input.serverName,
    targetId: match.target.id,
    targetName: match.target.name,
    credentialId: match.credentialId,
    credentialName: match.credentialName,
    credentialVersion: match.credentialVersion,
    resourceGroupId: match.group.id,
    resourceGroupName: match.group.name,
  });

  return {
    sanitizedArgs: {
      ...sanitizedArgs,
      credentialLeaseId: lease.id,
    },
    chain: {
      targetId: match.target.id,
      targetName: match.target.name,
      credentialId: match.credentialId,
      credentialName: match.credentialName,
      credentialVersion: match.credentialVersion,
      resourceGroupId: match.group.id,
      resourceGroupName: match.group.name,
    },
  };
};

import { getCredentialDao, getResourceDao, getServerDao } from '../dao/DaoFactory.js';
import {
  ICredentialContract,
  IUserServerCredential,
} from '../types/index.js';
import { collectCredentialNeeds } from '../utils/envPreflight.js';
import { toPublicCredential } from './credentialService.js';

const requireDao = () => {
  const dao = getResourceDao();
  if (!dao) {
    const error = new Error('Resource store is only available in database mode');
    error.name = 'ResourceStoreUnavailableError';
    throw error;
  }
  return dao;
};

export const listCredentialContracts = async (): Promise<
  Array<
    ICredentialContract & {
      credentials: ReturnType<typeof toPublicCredential>[];
    }
  >
> => {
  const dao = requireDao();
  const servers = await getServerDao().findAll();
  const bindings = await dao.findServerCredentialBindings();
  const credentialDao = getCredentialDao();
  const credentials = credentialDao ? await credentialDao.findAll() : [];
  const publicById = new Map(credentials.map((row) => [row.id, toPublicCredential(row)]));

  return servers
    .filter((server) => server.enabled !== false)
    .map((server) => {
      const credentialIds = bindings
        .filter((row) => row.serverName === server.name)
        .map((row) => row.credentialId);
      return {
        serverName: server.name,
        neededKeys: collectCredentialNeeds(server),
        credentialIds,
        credentials: credentialIds
          .map((id) => publicById.get(id))
          .filter((row): row is NonNullable<typeof row> => Boolean(row)),
      };
    });
};

export const setServerCredentialBindings = async (
  serverName: string,
  credentialIds: unknown,
): Promise<string[]> => {
  const name = serverName.trim();
  if (!name) {
    throw new Error('Server name is required');
  }
  const server = await getServerDao().findById(name);
  if (!server) {
    throw new Error('Server not found');
  }
  const ids = Array.isArray(credentialIds)
    ? [...new Set(credentialIds.filter((id): id is string => typeof id === 'string' && id.trim() !== '').map((id) => id.trim()))]
    : [];
  const credentialDao = getCredentialDao();
  if (!credentialDao && ids.length > 0) {
    const error = new Error('Resource store is only available in database mode');
    error.name = 'ResourceStoreUnavailableError';
    throw error;
  }
  for (const id of ids) {
    const credential = await credentialDao?.findById(id);
    if (!credential || !credential.enabled) {
      throw new Error(`Credential not found: ${id}`);
    }
  }
  await requireDao().replaceServerCredentialBindings(name, ids);
  return ids;
};

export const listUserServerCredentials = async (
  username: string,
): Promise<IUserServerCredential[]> => {
  const dao = getResourceDao();
  if (!dao) {
    return [];
  }
  return dao.findUserServerCredentials(username);
};

export const replaceUserServerCredentials = async (
  username: string,
  input: unknown,
): Promise<IUserServerCredential[]> => {
  const normalized = await normalizeUserServerCredentialRows(username, Array.isArray(input) ? input : []);
  await requireDao().replaceUserServerCredentials(username, normalized);
  return normalized;
};

const normalizeUserServerCredentialRows = async (
  username: string,
  rows: unknown[],
): Promise<IUserServerCredential[]> => {
  const dao = requireDao();
  const normalized: IUserServerCredential[] = [];
  const bindings = await dao.findServerCredentialBindings();
  const allowed = new Map<string, Set<string>>();
  for (const row of bindings) {
    const set = allowed.get(row.serverName) || new Set<string>();
    set.add(row.credentialId);
    allowed.set(row.serverName, set);
  }

  for (const row of rows) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const serverName = typeof (row as { serverName?: unknown }).serverName === 'string'
      ? (row as { serverName: string }).serverName.trim()
      : '';
    const credentialId = typeof (row as { credentialId?: unknown }).credentialId === 'string'
      ? (row as { credentialId: string }).credentialId.trim()
      : '';
    if (!serverName || !credentialId) {
      throw new Error('Each assignment needs serverName and credentialId');
    }
    const allowedIds = allowed.get(serverName);
    if (!allowedIds || !allowedIds.has(credentialId)) {
      throw new Error(`Credential is not bound to MCP ${serverName}`);
    }
    normalized.push({ username, serverName, credentialId });
  }
  return normalized;
};

export const findUserServerCredential = async (
  username: string,
  serverName: string,
): Promise<IUserServerCredential | null> => {
  const dao = getResourceDao();
  if (!dao) {
    return null;
  }
  return dao.findUserServerCredential(username, serverName);
};

export const serverHasCredentialBindings = async (serverName: string): Promise<boolean> => {
  const dao = getResourceDao();
  if (!dao) {
    return false;
  }
  const rows = await dao.findServerCredentialBindings(serverName);
  return rows.length > 0;
};

const parseServerCredentialRows = (input: unknown): Array<{ serverName: string; credentialId: string }> => {
  if (Array.isArray(input)) {
    return input as Array<{ serverName: string; credentialId: string }>;
  }
  if (input && typeof input === 'object') {
    const body = input as { bindings?: unknown; serverCredentials?: unknown };
    if (Array.isArray(body.bindings)) {
      return body.bindings as Array<{ serverName: string; credentialId: string }>;
    }
    if (Array.isArray(body.serverCredentials)) {
      return body.serverCredentials as Array<{ serverName: string; credentialId: string }>;
    }
  }
  return [];
};

export const validateUserServerCredentials = async (
  username: string,
  input: unknown,
  options?: { grants?: Array<{ name: string }>; isAdmin?: boolean },
): Promise<IUserServerCredential[]> => {
  let rows = parseServerCredentialRows(input);
  if (!getResourceDao()) {
    if (rows.length > 0) {
      const error = new Error('Resource store is only available in database mode');
      error.name = 'ResourceStoreUnavailableError';
      throw error;
    }
    return [];
  }
  const granted = new Set((options?.grants || []).map((row) => row.name));
  if (granted.size > 0 && !options?.isAdmin) {
    rows = rows.filter((row) => typeof row?.serverName === 'string' && granted.has(row.serverName));
  }
  const normalized = await normalizeUserServerCredentialRows(username, rows);
  if (!options?.isAdmin && granted.size > 0) {
    const missing: string[] = [];
    for (const serverName of granted) {
      if (await serverHasCredentialBindings(serverName)) {
        const picked = normalized.some((row) => row.serverName === serverName);
        if (!picked) {
          missing.push(serverName);
        }
      }
    }
    if (missing.length > 0) {
      throw new Error(`MCP requires an assigned credential: ${missing.join(', ')}`);
    }
  }
  return normalized;
};

export const saveUserServerCredentials = async (
  username: string,
  input: unknown,
  options?: { grants?: Array<{ name: string }>; isAdmin?: boolean },
): Promise<IUserServerCredential[]> => {
  const normalized = await validateUserServerCredentials(username, input, options);
  if (!getResourceDao()) {
    return normalized;
  }
  await requireDao().replaceUserServerCredentials(username, normalized);
  return normalized;
};

export const attachUserServerCredentials = async <T extends { username: string }>(
  users: T[],
): Promise<(T & { serverCredentials: Array<{ serverName: string; credentialId: string }> })[]> => {
  const dao = getResourceDao();
  if (!dao) {
    return users.map((user) => ({ ...user, serverCredentials: [] }));
  }
  const rows = await dao.findUserServerCredentials();
  const map = new Map<string, Array<{ serverName: string; credentialId: string }>>();
  for (const row of rows) {
    const list = map.get(row.username) || [];
    list.push({ serverName: row.serverName, credentialId: row.credentialId });
    map.set(row.username, list);
  }
  return users.map((user) => ({
    ...user,
    serverCredentials: map.get(user.username) || [],
  }));
};

import pg from 'pg';
import { getCredentialDao } from '../dao/DaoFactory.js';
import {
  CredentialType,
  ICredential,
  ICredentialPublic,
  ICredentialSecret,
} from '../types/index.js';
import {
  decryptJson,
  encryptJson,
  hasMasterKey,
  MasterKeyMissingError,
} from '../utils/secretBox.js';
import { serializeTokenExpiresAt } from '../utils/userTokenExpiry.js';

const CREDENTIAL_TYPES: CredentialType[] = ['postgresql', 'token', 'basic'];
const SECRET_KEYS = ['password', 'token', 'encryptedPayload', 'encrypted_payload', 'secret'] as const;

export const isCredentialStoreEnabled = (): boolean => typeof getCredentialDao() !== 'undefined';

export const requireCredentialDao = () => {
  const dao = getCredentialDao();
  if (!dao) {
    const error = new Error('Credential store is only available in database mode');
    error.name = 'CredentialStoreUnavailableError';
    throw error;
  }
  return dao;
};

export const toPublicCredential = (credential: ICredential): ICredentialPublic => {
  const publicView: ICredentialPublic = {
    id: credential.id,
    name: credential.name,
    type: credential.type,
    enabled: credential.enabled,
    secretConfigured: Boolean(credential.encryptedPayload),
    createdAt: serializeTokenExpiresAt(credential.createdAt),
    updatedAt: serializeTokenExpiresAt(credential.updatedAt),
    rotatedAt: serializeTokenExpiresAt(credential.rotatedAt),
  };
  if (credential.username) {
    publicView.username = credential.username;
  }
  for (const key of SECRET_KEYS) {
    delete (publicView as unknown as Record<string, unknown>)[key];
  }
  return publicView;
};

export const assertNoSecrets = (value: unknown): void => {
  const text = JSON.stringify(value);
  if (!text) {
    return;
  }
  if (
    /"password"\s*:/.test(text) ||
    /"token"\s*:/.test(text) ||
    /"encryptedPayload"\s*:/.test(text) ||
    /"encrypted_payload"\s*:/.test(text)
  ) {
    throw new Error('Credential response leaked a secret field');
  }
};

const isCredentialType = (value: unknown): value is CredentialType =>
  typeof value === 'string' && CREDENTIAL_TYPES.includes(value as CredentialType);

const normalizeSecret = (
  type: CredentialType,
  input: ICredentialSecret,
): { secret: ICredentialSecret; username?: string } => {
  if (type === 'token') {
    const token = typeof input.token === 'string' ? input.token.trim() : '';
    if (!token) {
      throw new Error('Token is required');
    }
    return { secret: { token } };
  }

  const username = typeof input.username === 'string' ? input.username.trim() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  if (!username || !password) {
    throw new Error('Username and password are required');
  }
  return { secret: { username, password }, username };
};

const encryptSecret = (secret: ICredentialSecret) => {
  if (!hasMasterKey()) {
    throw new MasterKeyMissingError();
  }
  return encryptJson(secret);
};

export const listCredentials = async (): Promise<ICredentialPublic[]> => {
  const rows = await requireCredentialDao().findAll();
  return rows.map(toPublicCredential);
};

export const createCredential = async (input: {
  name?: string;
  type?: string;
  username?: string;
  password?: string;
  token?: string;
  enabled?: boolean;
}): Promise<ICredentialPublic> => {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new Error('Name is required');
  }
  if (!isCredentialType(input.type)) {
    throw new Error('Type must be postgresql, token, or basic');
  }
  const dao = requireCredentialDao();
  if (await dao.findByName(name)) {
    throw new Error('A credential with this name already exists');
  }
  const { secret, username } = normalizeSecret(input.type, input);
  const sealed = encryptSecret(secret);
  const created = await dao.create({
    name,
    type: input.type,
    encryptedPayload: sealed.payload,
    keyVersion: sealed.keyVersion,
    enabled: input.enabled !== false,
    username: username ?? null,
    rotatedAt: null,
  });
  return toPublicCredential(created);
};

export const updateCredential = async (
  id: string,
  input: { name?: string; enabled?: boolean },
): Promise<ICredentialPublic | null> => {
  const dao = requireCredentialDao();
  const existing = await dao.findById(id);
  if (!existing) {
    return null;
  }
  const patch: Partial<ICredential> = {};
  if (typeof input.name === 'string') {
    const name = input.name.trim();
    if (!name) {
      throw new Error('Name is required');
    }
    const clash = await dao.findByName(name);
    if (clash && clash.id !== id) {
      throw new Error('A credential with this name already exists');
    }
    patch.name = name;
  }
  if (input.enabled !== undefined) {
    patch.enabled = Boolean(input.enabled);
  }
  if (Object.keys(patch).length === 0) {
    throw new Error('At least one of name or enabled is required');
  }
  const updated = await dao.update(id, patch);
  return updated ? toPublicCredential(updated) : null;
};

export const replaceCredentialSecret = async (
  id: string,
  input: ICredentialSecret,
): Promise<ICredentialPublic | null> => {
  const dao = requireCredentialDao();
  const existing = await dao.findById(id);
  if (!existing) {
    return null;
  }
  const { secret, username } = normalizeSecret(existing.type, input);
  const sealed = encryptSecret(secret);
  const updated = await dao.update(id, {
    encryptedPayload: sealed.payload,
    keyVersion: sealed.keyVersion,
    username: username ?? null,
    rotatedAt: new Date(),
  });
  return updated ? toPublicCredential(updated) : null;
};

export const deleteCredential = async (id: string): Promise<boolean> => {
  return requireCredentialDao().deleteById(id);
};

export const openCredentialSecret = (credential: ICredential): ICredentialSecret => {
  if (!hasMasterKey()) {
    throw new MasterKeyMissingError();
  }
  return decryptJson<ICredentialSecret>(credential.encryptedPayload, credential.keyVersion);
};

export const testCredential = async (
  id: string,
  probe: { host?: string; port?: number | string; database?: string; url?: string },
): Promise<{ ok: boolean; message: string; kind: 'postgresql' | 'format' }> => {
  const credential = await requireCredentialDao().findById(id);
  if (!credential) {
    throw new Error('Credential not found');
  }
  const secret = openCredentialSecret(credential);

  if (credential.type === 'postgresql') {
    const host = typeof probe.host === 'string' ? probe.host.trim() : '';
    const database = typeof probe.database === 'string' ? probe.database.trim() : '';
    const port = Number(probe.port || 5432);
    if (!host || !database || !Number.isFinite(port)) {
      throw new Error('Host, port, and database are required for a PostgreSQL probe');
    }
    const client = new pg.Client({
      host,
      port,
      database,
      user: secret.username,
      password: secret.password,
      connectionTimeoutMillis: 5000,
    });
    try {
      await client.connect();
      await client.query('SELECT 1');
      return { ok: true, message: 'Connection succeeded', kind: 'postgresql' };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      return { ok: false, message, kind: 'postgresql' };
    } finally {
      await client.end().catch(() => undefined);
    }
  }

  if (credential.type === 'token') {
    if (!secret.token?.trim()) {
      return { ok: false, message: 'Token is empty', kind: 'format' };
    }
    return { ok: true, message: 'Token format looks valid', kind: 'format' };
  }

  if (!secret.username?.trim() || !secret.password) {
    return { ok: false, message: 'Username or password is empty', kind: 'format' };
  }
  return { ok: true, message: 'Username and password are present', kind: 'format' };
};

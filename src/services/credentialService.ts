import { getCredentialDao, getResourceDao } from '../dao/DaoFactory.js';
import { ICredential, ICredentialPublic } from '../types/index.js';
import {
  payloadToCredentialFields,
  sanitizeFieldMap,
} from '../utils/fieldMap.js';
import {
  decryptJson,
  encryptJson,
  hasMasterKey,
  MasterKeyMissingError,
} from '../utils/secretBox.js';
import { serializeTokenExpiresAt } from '../utils/userTokenExpiry.js';

const SECRET_KEYS = ['password', 'token', 'encryptedPayload', 'encrypted_payload', 'secret'] as const;
const CREDENTIAL_KIND = 'fields';

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

const publicKeys = (credential: ICredential): string[] => {
  if (Array.isArray(credential.fieldKeys) && credential.fieldKeys.length > 0) {
    return credential.fieldKeys.filter((key) => typeof key === 'string' && key.length > 0);
  }
  if (!credential.encryptedPayload || !hasMasterKey()) {
    return [];
  }
  try {
    return Object.keys(openCredentialFields(credential));
  } catch {
    return [];
  }
};

export const toPublicCredential = (credential: ICredential): ICredentialPublic => {
  const publicView: ICredentialPublic = {
    id: credential.id,
    name: credential.name,
    enabled: credential.enabled,
    keys: publicKeys(credential),
    secretConfigured: Boolean(credential.encryptedPayload),
    createdAt: serializeTokenExpiresAt(credential.createdAt),
    updatedAt: serializeTokenExpiresAt(credential.updatedAt),
    rotatedAt: serializeTokenExpiresAt(credential.rotatedAt),
  };
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
    /"encrypted_payload"\s*:/.test(text) ||
    /"fields"\s*:/.test(text)
  ) {
    throw new Error('Credential response leaked a secret field');
  }
};

const sealFields = (fields: Record<string, string>) => {
  if (!hasMasterKey()) {
    throw new MasterKeyMissingError();
  }
  return encryptJson({ fields });
};

const readInputFields = (input: { fields?: unknown }): Record<string, string> =>
  sanitizeFieldMap(input.fields, { trimValues: false });

export const listCredentials = async (): Promise<ICredentialPublic[]> => {
  const rows = await requireCredentialDao().findAll();
  return rows.map(toPublicCredential);
};

export const createCredential = async (input: {
  name?: string;
  fields?: unknown;
  enabled?: boolean;
}): Promise<ICredentialPublic> => {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) {
    throw new Error('Name is required');
  }
  const fields = readInputFields(input);
  const dao = requireCredentialDao();
  if (await dao.findByName(name)) {
    throw new Error('A credential with this name already exists');
  }
  const sealed = sealFields(fields);
  const created = await dao.create({
    name,
    type: CREDENTIAL_KIND,
    encryptedPayload: sealed.payload,
    keyVersion: sealed.keyVersion,
    enabled: input.enabled !== false,
    fieldKeys: Object.keys(fields),
    username: null,
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
  input: { fields?: unknown },
): Promise<ICredentialPublic | null> => {
  const dao = requireCredentialDao();
  const existing = await dao.findById(id);
  if (!existing) {
    return null;
  }
  const fields = readInputFields(input);
  const sealed = sealFields(fields);
  const updated = await dao.update(id, {
    type: CREDENTIAL_KIND,
    encryptedPayload: sealed.payload,
    keyVersion: sealed.keyVersion,
    fieldKeys: Object.keys(fields),
    username: null,
    rotatedAt: new Date(),
  });
  return updated ? toPublicCredential(updated) : null;
};

export const deleteCredential = async (id: string): Promise<boolean> => {
  const dao = requireCredentialDao();
  const resourceDao = getResourceDao();
  if (resourceDao) {
    await resourceDao.deleteBindingsForCredential(id);
  }
  return dao.deleteById(id);
};

export const openCredentialFields = (credential: ICredential): Record<string, string> => {
  if (!hasMasterKey()) {
    throw new MasterKeyMissingError();
  }
  return payloadToCredentialFields(
    decryptJson<unknown>(credential.encryptedPayload, credential.keyVersion),
  );
};

/** Admin console edit only. List endpoints must keep using toPublicCredential. */
export const listCredentialEditPairs = async (
  id: string,
): Promise<{ name: string; pairs: Array<{ key: string; value: string }> } | null> => {
  const credential = await requireCredentialDao().findById(id);
  if (!credential) {
    return null;
  }
  const fields = openCredentialFields(credential);
  return {
    name: credential.name,
    pairs: Object.entries(fields).map(([key, value]) => ({ key, value })),
  };
};

/** @deprecated Use openCredentialFields. Kept so existing imports keep compiling. */
export const openCredentialSecret = openCredentialFields;

export const testCredential = async (
  id: string,
): Promise<{ ok: boolean; message: string; fieldCount: number }> => {
  const credential = await requireCredentialDao().findById(id);
  if (!credential) {
    throw new Error('Credential not found');
  }
  const fields = openCredentialFields(credential);
  const fieldCount = Object.keys(fields).length;
  return {
    ok: fieldCount > 0,
    fieldCount,
    message: fieldCount > 0 ? `Readable, ${fieldCount} field(s)` : 'No fields',
  };
};

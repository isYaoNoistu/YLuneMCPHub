import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const MASTER_KEY_ENV = 'YLUNE_MASTER_KEY';
export const CURRENT_KEY_VERSION = 1;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class MasterKeyMissingError extends Error {
  constructor() {
    super('YLUNE_MASTER_KEY is not configured');
    this.name = 'MasterKeyMissingError';
  }
}

export const hasMasterKey = (): boolean => Boolean(process.env[MASTER_KEY_ENV]?.trim());

/**
 * Accept openssl rand -base64 32, 64-char hex, or any other string hashed to 32 bytes.
 * The key never leaves process env.
 */
export const resolveMasterKey = (): Buffer => {
  const raw = process.env[MASTER_KEY_ENV]?.trim();
  if (!raw) {
    throw new MasterKeyMissingError();
  }

  const asBase64 = Buffer.from(raw, 'base64');
  if (asBase64.length === 32) {
    return asBase64;
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  return createHash('sha256').update(raw, 'utf8').digest();
};

export interface SealedSecret {
  v: number;
  iv: string;
  tag: string;
  data: string;
}

export const encryptSecret = (plaintext: string): { payload: string; keyVersion: number } => {
  const key = resolveMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const sealed: SealedSecret = {
    v: CURRENT_KEY_VERSION,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: encrypted.toString('base64'),
  };
  return {
    payload: JSON.stringify(sealed),
    keyVersion: CURRENT_KEY_VERSION,
  };
};

export const decryptSecret = (payload: string, keyVersion = CURRENT_KEY_VERSION): string => {
  const key = resolveMasterKey();
  let sealed: SealedSecret;
  try {
    sealed = JSON.parse(payload) as SealedSecret;
  } catch {
    throw new Error('Encrypted payload is not valid JSON');
  }
  if (!sealed?.iv || !sealed?.tag || !sealed?.data) {
    throw new Error('Encrypted payload is missing iv, tag, or data');
  }
  if (sealed.v && sealed.v !== keyVersion) {
    throw new Error(`Unsupported credential key version ${sealed.v}`);
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(sealed.iv, 'base64'), {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(sealed.data, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

export const encryptJson = (value: unknown): { payload: string; keyVersion: number } =>
  encryptSecret(JSON.stringify(value));

export const decryptJson = <T>(payload: string, keyVersion?: number): T =>
  JSON.parse(decryptSecret(payload, keyVersion)) as T;

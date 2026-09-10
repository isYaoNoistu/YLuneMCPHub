import { randomBytes } from 'node:crypto';
import {
  CURRENT_KEY_VERSION,
  MASTER_KEY_ENV,
  decryptJson,
  decryptSecret,
  encryptJson,
  encryptSecret,
  hasMasterKey,
  MasterKeyMissingError,
  resolveMasterKey,
} from '../../src/utils/secretBox.js';

const originalKey = process.env[MASTER_KEY_ENV];

describe('secretBox', () => {
  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env[MASTER_KEY_ENV];
    } else {
      process.env[MASTER_KEY_ENV] = originalKey;
    }
  });

  it('encrypts and decrypts a string with YLUNE_MASTER_KEY', () => {
    process.env[MASTER_KEY_ENV] = randomBytes(32).toString('base64');
    const { payload, keyVersion } = encryptSecret('readonly-password');
    expect(keyVersion).toBe(CURRENT_KEY_VERSION);
    expect(payload).not.toContain('readonly-password');
    expect(decryptSecret(payload, keyVersion)).toBe('readonly-password');
  });

  it('round-trips a postgresql secret object', () => {
    process.env[MASTER_KEY_ENV] = randomBytes(32).toString('base64');
    const secret = { username: 'ylune_ro', password: 's3cret' };
    const { payload, keyVersion } = encryptJson(secret);
    expect(payload).not.toContain('s3cret');
    expect(decryptJson(payload, keyVersion)).toEqual(secret);
  });

  it('reports a missing master key and refuses to encrypt', () => {
    delete process.env[MASTER_KEY_ENV];
    expect(hasMasterKey()).toBe(false);
    expect(() => resolveMasterKey()).toThrow(MasterKeyMissingError);
    expect(() => encryptSecret('x')).toThrow(MasterKeyMissingError);
  });
});

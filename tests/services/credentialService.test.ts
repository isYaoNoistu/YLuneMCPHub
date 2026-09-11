import { randomBytes } from 'node:crypto';
import { jest } from '@jest/globals';
import { MASTER_KEY_ENV, encryptJson } from '../../src/utils/secretBox.js';

const findAll = jest.fn();
const findById = jest.fn();
const findByName = jest.fn();
const create = jest.fn();
const update = jest.fn();
const deleteById = jest.fn();

jest.mock('../../src/dao/DaoFactory.js', () => ({
  getCredentialDao: () => ({
    findAll,
    findById,
    findByName,
    create,
    update,
    deleteById,
  }),
}));

import {
  createCredential,
  listCredentialEditPairs,
  listCredentials,
  openCredentialFields,
  replaceCredentialSecret,
  toPublicCredential,
} from '../../src/services/credentialService.js';
import { MasterKeyMissingError } from '../../src/utils/secretBox.js';

const originalKey = process.env[MASTER_KEY_ENV];

describe('credentialService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env[MASTER_KEY_ENV] = randomBytes(32).toString('base64');
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env[MASTER_KEY_ENV];
    } else {
      process.env[MASTER_KEY_ENV] = originalKey;
    }
  });

  it('never puts field values on the public view', () => {
    const publicView = toPublicCredential({
      id: 'c1',
      name: 'prod-pg',
      type: 'fields',
      encryptedPayload: '{"data":"cipher"}',
      keyVersion: 1,
      enabled: true,
      fieldKeys: ['PGUSER', 'PGPASSWORD'],
      createdAt: new Date('2026-09-10T00:00:00.000Z'),
      updatedAt: new Date('2026-09-10T00:00:00.000Z'),
      rotatedAt: null,
    });
    expect(publicView).toEqual(
      expect.objectContaining({
        id: 'c1',
        name: 'prod-pg',
        keys: ['PGUSER', 'PGPASSWORD'],
        secretConfigured: true,
      }),
    );
    expect(JSON.stringify(publicView)).not.toMatch(
      /"password"\s*:|"token"\s*:|"encryptedPayload"|"fields"\s*:|cipher/,
    );
  });

  it('lists credentials without secret fields', async () => {
    findAll.mockResolvedValue([
      {
        id: 'c1',
        name: 'prod-pg',
        type: 'fields',
        encryptedPayload: 'sealed',
        keyVersion: 1,
        enabled: true,
        fieldKeys: ['PGUSER', 'PGPASSWORD'],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const rows = await listCredentials();
    expect(rows[0]?.keys).toEqual(['PGUSER', 'PGPASSWORD']);
    expect(JSON.stringify(rows)).not.toMatch(/"password"\s*:|"token"\s*:|"encryptedPayload"|"fields"\s*:/);
  });

  it('refuses to write when the master key is missing', async () => {
    delete process.env[MASTER_KEY_ENV];
    findByName.mockResolvedValue(null);
    await expect(
      createCredential({
        name: 'prod-pg',
        fields: { PGUSER: 'ylune_ro', PGPASSWORD: 's3cret' },
      }),
    ).rejects.toBeInstanceOf(MasterKeyMissingError);
    expect(create).not.toHaveBeenCalled();
  });

  it('stores only ciphertext on create', async () => {
    findByName.mockResolvedValue(null);
    create.mockImplementation(async (input: Record<string, unknown>) => ({
      id: 'c1',
      ...input,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    const publicView = await createCredential({
      name: 'prod-pg',
      fields: { PGUSER: 'ylune_ro', PGPASSWORD: 's3cret' },
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'prod-pg',
        type: 'fields',
        fieldKeys: ['PGUSER', 'PGPASSWORD'],
      }),
    );
    const stored = create.mock.calls[0]?.[0] as { encryptedPayload: string };
    expect(stored.encryptedPayload).not.toContain('s3cret');
    expect(JSON.stringify(publicView)).not.toContain('s3cret');
    expect(publicView.keys).toEqual(['PGUSER', 'PGPASSWORD']);
  });

  it('rejects empty or illegal field names', async () => {
    findByName.mockResolvedValue(null);
    await expect(createCredential({ name: 'x', fields: {} })).rejects.toThrow(/at least one field/i);
    await expect(
      createCredential({ name: 'x', fields: { 'pg-user': 'ro' } }),
    ).rejects.toThrow(/Invalid field name/);
    expect(create).not.toHaveBeenCalled();
  });

  it('opens legacy username/password payloads as a field map', () => {
    const sealed = encryptJson({ username: 'ylune_ro', password: 's3cret' });
    expect(
      openCredentialFields({
        id: 'c1',
        name: 'legacy',
        type: 'postgresql',
        encryptedPayload: sealed.payload,
        keyVersion: sealed.keyVersion,
        enabled: true,
      }),
    ).toEqual({ username: 'ylune_ro', password: 's3cret' });
  });

  it('returns decrypted pairs for admin edit without putting values on the public view', async () => {
    const sealed = encryptJson({
      fields: {
        JENKINS_URL: 'https://ci.example',
        JENKINS_API_TOKEN: 'abc',
      },
    });
    const row = {
      id: 'c1',
      name: 'jenkins-prod',
      type: 'fields',
      encryptedPayload: sealed.payload,
      keyVersion: sealed.keyVersion,
      enabled: true,
      fieldKeys: ['JENKINS_URL', 'JENKINS_API_TOKEN'],
      createdAt: new Date('2026-09-10T00:00:00.000Z'),
      updatedAt: new Date('2026-09-10T00:00:00.000Z'),
      rotatedAt: null,
    };
    findById.mockResolvedValue(row);
    await expect(listCredentialEditPairs('c1')).resolves.toEqual({
      name: 'jenkins-prod',
      pairs: [
        { key: 'JENKINS_URL', value: 'https://ci.example' },
        { key: 'JENKINS_API_TOKEN', value: 'abc' },
      ],
    });
    expect(JSON.stringify(toPublicCredential(row))).not.toContain('abc');
  });

  it('refuses replaceSecret without a master key', async () => {
    findById.mockResolvedValue({
      id: 'c1',
      name: 'prod-pg',
      type: 'fields',
      encryptedPayload: 'sealed',
      keyVersion: 1,
      enabled: true,
      fieldKeys: ['PGPASSWORD'],
    });
    delete process.env[MASTER_KEY_ENV];
    await expect(
      replaceCredentialSecret('c1', { fields: { PGPASSWORD: 'new-secret' } }),
    ).rejects.toBeInstanceOf(MasterKeyMissingError);
    expect(update).not.toHaveBeenCalled();
  });
});

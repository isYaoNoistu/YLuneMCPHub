import { randomBytes } from 'node:crypto';
import { jest } from '@jest/globals';
import { MASTER_KEY_ENV } from '../../src/utils/secretBox.js';

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
  listCredentials,
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

  it('never puts password or token on the public view', () => {
    const publicView = toPublicCredential({
      id: 'c1',
      name: 'prod-pg',
      type: 'postgresql',
      encryptedPayload: '{"data":"cipher"}',
      keyVersion: 1,
      enabled: true,
      username: 'ylune_ro',
      createdAt: new Date('2026-09-10T00:00:00.000Z'),
      updatedAt: new Date('2026-09-10T00:00:00.000Z'),
      rotatedAt: null,
    });
    expect(publicView).toEqual(
      expect.objectContaining({
        id: 'c1',
        name: 'prod-pg',
        type: 'postgresql',
        username: 'ylune_ro',
        secretConfigured: true,
      }),
    );
    expect(JSON.stringify(publicView)).not.toMatch(/password|token|encryptedPayload|cipher/i);
  });

  it('lists credentials without secret fields', async () => {
    findAll.mockResolvedValue([
      {
        id: 'c1',
        name: 'prod-pg',
        type: 'postgresql',
        encryptedPayload: 'sealed',
        keyVersion: 1,
        enabled: true,
        username: 'ylune_ro',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    const rows = await listCredentials();
    expect(rows[0]?.username).toBe('ylune_ro');
    expect(JSON.stringify(rows)).not.toMatch(/"password"|"token"|"encryptedPayload"/);
  });

  it('refuses to write when the master key is missing', async () => {
    delete process.env[MASTER_KEY_ENV];
    findByName.mockResolvedValue(null);
    await expect(
      createCredential({
        name: 'prod-pg',
        type: 'postgresql',
        username: 'ylune_ro',
        password: 's3cret',
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
      type: 'postgresql',
      username: 'ylune_ro',
      password: 's3cret',
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'prod-pg',
        username: 'ylune_ro',
      }),
    );
    const stored = create.mock.calls[0]?.[0] as { encryptedPayload: string };
    expect(stored.encryptedPayload).not.toContain('s3cret');
    expect(JSON.stringify(publicView)).not.toContain('s3cret');
  });

  it('refuses replaceSecret without a master key', async () => {
    findById.mockResolvedValue({
      id: 'c1',
      name: 'prod-pg',
      type: 'postgresql',
      encryptedPayload: 'sealed',
      keyVersion: 1,
      enabled: true,
    });
    delete process.env[MASTER_KEY_ENV];
    await expect(
      replaceCredentialSecret('c1', { username: 'ylune_ro', password: 'new-secret' }),
    ).rejects.toBeInstanceOf(MasterKeyMissingError);
    expect(update).not.toHaveBeenCalled();
  });
});

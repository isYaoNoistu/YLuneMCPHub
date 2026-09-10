import { jest } from '@jest/globals';
import { Request, Response } from 'express';

const listCredentials = jest.fn();
const createCredential = jest.fn();

jest.mock('../../src/utils/requireAdmin.js', () => ({
  requireAdmin: jest.fn(async () => true),
}));

jest.mock('../../src/services/credentialService.js', () => ({
  assertNoSecrets: jest.fn((value: unknown) => {
    const text = JSON.stringify(value);
    if (text && /"password"\s*:|"token"\s*:|"encryptedPayload"\s*:/.test(text)) {
      throw new Error('leaked');
    }
  }),
  createCredential,
  deleteCredential: jest.fn(),
  isCredentialStoreEnabled: jest.fn(() => true),
  listCredentials,
  replaceCredentialSecret: jest.fn(),
  testCredential: jest.fn(),
  updateCredential: jest.fn(),
}));

jest.mock('../../src/utils/secretBox.js', () => ({
  MasterKeyMissingError: class MasterKeyMissingError extends Error {
    constructor() {
      super('YLUNE_MASTER_KEY is not configured');
      this.name = 'MasterKeyMissingError';
    }
  },
}));

import { createNewCredential, getCredentials } from '../../src/controllers/credentialController.js';
import { MasterKeyMissingError } from '../../src/utils/secretBox.js';

const makeRes = () => {
  const res = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response & { json: jest.Mock; status: jest.Mock };
};

describe('credentialController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('never returns password or token on GET', async () => {
    listCredentials.mockResolvedValue([
      {
        id: 'c1',
        name: 'prod-pg',
        type: 'postgresql',
        enabled: true,
        username: 'ylune_ro',
        secretConfigured: true,
        createdAt: '2026-09-10T00:00:00.000Z',
        updatedAt: '2026-09-10T00:00:00.000Z',
        rotatedAt: null,
      },
    ]);
    const res = makeRes();
    await getCredentials({} as Request, res);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/"password"|"token"|"encryptedPayload"/);
    expect(body.data[0].username).toBe('ylune_ro');
    expect(body.data[0].secretConfigured).toBe(true);
  });

  it('refuses create when the master key is missing', async () => {
    createCredential.mockRejectedValue(new MasterKeyMissingError());
    const res = makeRes();
    await createNewCredential(
      { body: { name: 'prod-pg', type: 'postgresql', username: 'ro', password: 's3cret' } } as Request,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'api.errors.master_key_missing',
      }),
    );
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('s3cret');
  });
});

import { jest } from '@jest/globals';

const findUserServerCredential = jest.fn();
const serverHasCredentialBindings = jest.fn();
const getUserByUsername = jest.fn();
const createCredentialLease = jest.fn(() => ({ id: 'lease-1' }));

jest.mock('../../src/services/credentialBindingService.js', () => ({
  findUserServerCredential: (...args: unknown[]) => findUserServerCredential(...args),
  serverHasCredentialBindings: (...args: unknown[]) => serverHasCredentialBindings(...args),
}));

jest.mock('../../src/services/userService.js', () => ({
  getUserByUsername: (...args: unknown[]) => getUserByUsername(...args),
}));

jest.mock('../../src/services/credentialBrokerService.js', () => ({
  createCredentialLease: (...args: unknown[]) => createCredentialLease(...args),
}));

jest.mock('../../src/dao/DaoFactory.js', () => ({
  getResourceDao: () => ({
    findAllGroups: async () => [],
    findAssignmentsByUser: async () => [],
    findTargetByName: async () => null,
    findTargetById: async () => null,
  }),
  getCredentialDao: () => ({
    findById: async (id: string) =>
      id === 'cred-1'
        ? { id: 'cred-1', name: 'ci-ro', enabled: true, keyVersion: 3 }
        : null,
  }),
  getServerDao: () => ({ findById: async () => null }),
}));

import {
  authorizeToolResourceAccess,
  ResourceBindingDeniedError,
} from '../../src/services/resourceService.js';

describe('authorizeToolResourceAccess user-server credentials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUserByUsername.mockResolvedValue({ username: 'alice', isAdmin: false });
    findUserServerCredential.mockResolvedValue(null);
    serverHasCredentialBindings.mockResolvedValue(false);
    createCredentialLease.mockReturnValue({ id: 'lease-1' });
  });

  it('injects a lease when the user has a bound MCP credential', async () => {
    findUserServerCredential.mockResolvedValue({
      username: 'alice',
      serverName: 'jenkins',
      credentialId: 'cred-1',
    });
    const result = await authorizeToolResourceAccess({
      username: 'alice',
      serverName: 'jenkins',
      args: { job: 'deploy' },
    });
    expect(result.sanitizedArgs.credentialLeaseId).toBe('lease-1');
    expect(result.chain.credentialId).toBe('cred-1');
    expect(result.chain.credentialName).toBe('ci-ro');
    expect(JSON.stringify(result)).not.toMatch(/password|token/i);
  });

  it('denies a non-admin when the MCP requires a credential and none is assigned', async () => {
    serverHasCredentialBindings.mockResolvedValue(true);
    await expect(
      authorizeToolResourceAccess({
        username: 'alice',
        serverName: 'jenkins',
        args: {},
      }),
    ).rejects.toBeInstanceOf(ResourceBindingDeniedError);
  });
});

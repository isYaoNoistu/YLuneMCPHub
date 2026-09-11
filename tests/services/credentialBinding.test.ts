import { jest } from '@jest/globals';

const findAllServers = jest.fn();
const findServerById = jest.fn();
const findServerCredentialBindings = jest.fn();
const replaceServerCredentialBindings = jest.fn();
const deleteUserServerCredentialsNotIn = jest.fn();
const findAllCredentials = jest.fn();
const findCredentialById = jest.fn();
const replaceUserServerCredentials = jest.fn();
const findUserServerCredentials = jest.fn();

jest.mock('../../src/dao/DaoFactory.js', () => ({
  getServerDao: () => ({
    findAll: findAllServers,
    findById: findServerById,
  }),
  getCredentialDao: () => ({
    findAll: findAllCredentials,
    findById: findCredentialById,
  }),
  getResourceDao: () => ({
    findServerCredentialBindings,
    replaceServerCredentialBindings,
    deleteUserServerCredentialsNotIn,
    replaceUserServerCredentials,
    findUserServerCredentials,
    findUserServerCredential: jest.fn(),
    deleteBindingsForCredential: jest.fn(),
    deleteUserServerCredentials: jest.fn(),
  }),
}));

jest.mock('../../src/services/credentialService.js', () => ({
  toPublicCredential: (row: { id: string; name: string; enabled: boolean }) => ({
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    keys: ['JENKINS_API_TOKEN'],
    secretConfigured: true,
    createdAt: null,
    updatedAt: null,
    rotatedAt: null,
  }),
}));

import {
  listCredentialContracts,
  listBoundCredentialIds,
  saveUserServerCredentials,
  setServerCredentialBindings,
  validateUserServerCredentials,
} from '../../src/services/credentialBindingService.js';

describe('credentialBindingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findAllServers.mockResolvedValue([
      {
        name: 'jenkins',
        enabled: true,
        env: { JENKINS_URL: 'https://ci', JENKINS_API_TOKEN: '${JENKINS_API_TOKEN}' },
      },
    ]);
    findServerById.mockResolvedValue({ name: 'jenkins', enabled: true });
    findServerCredentialBindings.mockResolvedValue([
      { serverName: 'jenkins', credentialId: 'cred-1' },
    ]);
    findAllCredentials.mockResolvedValue([
      { id: 'cred-1', name: 'ci-ro', enabled: true },
    ]);
    findCredentialById.mockResolvedValue({ id: 'cred-1', name: 'ci-ro', enabled: true });
    replaceServerCredentialBindings.mockResolvedValue(undefined);
    replaceUserServerCredentials.mockResolvedValue(undefined);
    findUserServerCredentials.mockResolvedValue([]);
  });

  it('lists bound credential ids for one MCP', async () => {
    await expect(listBoundCredentialIds('jenkins')).resolves.toEqual(['cred-1']);
  });

  it('lists needed keys and bound credentials without secrets', async () => {
    const contracts = await listCredentialContracts();
    expect(contracts).toEqual([
      expect.objectContaining({
        serverName: 'jenkins',
        enabled: true,
        neededKeys: ['JENKINS_API_TOKEN', 'JENKINS_URL'],
        credentialIds: ['cred-1'],
      }),
    ]);
    expect(JSON.stringify(contracts)).not.toMatch(/"password"\s*:|"token"\s*:|"fields"\s*:/);
  });

  it('includes disabled servers so a clone can be bound before it is enabled', async () => {
    findAllServers.mockResolvedValue([
      { name: 'jenkins-uat', enabled: false, command: '/opt/mcp/jenkins-mcp-server' },
    ]);
    findServerCredentialBindings.mockResolvedValue([]);
    await expect(listCredentialContracts()).resolves.toEqual([
      expect.objectContaining({
        serverName: 'jenkins-uat',
        enabled: false,
        neededKeys: [],
        credentialIds: [],
      }),
    ]);
  });

  it('rejects assigning a credential that is not bound to the MCP', async () => {
    await expect(
      validateUserServerCredentials('alice', [{ serverName: 'jenkins', credentialId: 'other' }], {
        grants: [{ name: 'jenkins' }],
      }),
    ).rejects.toThrow('Credential is not bound to MCP jenkins');
  });

  it('requires a pick when the granted MCP has bound credentials', async () => {
    await expect(
      validateUserServerCredentials('alice', [], { grants: [{ name: 'jenkins' }] }),
    ).rejects.toThrow('MCP requires an assigned credential: jenkins');
  });

  it('saves multiple credentials for the same MCP', async () => {
    findServerCredentialBindings.mockResolvedValue([
      { serverName: 'jenkins', credentialId: 'cred-1' },
      { serverName: 'jenkins', credentialId: 'cred-2' },
    ]);
    findCredentialById.mockImplementation(async (id: string) => ({ id, name: id, enabled: true }));
    const saved = await saveUserServerCredentials(
      'alice',
      [
        { serverName: 'jenkins', credentialId: 'cred-1' },
        { serverName: 'jenkins', credentialId: 'cred-2' },
      ],
      { grants: [{ name: 'jenkins' }] },
    );
    expect(saved).toEqual([
      { username: 'alice', serverName: 'jenkins', credentialId: 'cred-1' },
      { username: 'alice', serverName: 'jenkins', credentialId: 'cred-2' },
    ]);
  });

  it('saves a valid user pick', async () => {
    const saved = await saveUserServerCredentials(
      'alice',
      [{ serverName: 'jenkins', credentialId: 'cred-1' }],
      { grants: [{ name: 'jenkins' }] },
    );
    expect(saved).toEqual([{ username: 'alice', serverName: 'jenkins', credentialId: 'cred-1' }]);
    expect(replaceUserServerCredentials).toHaveBeenCalledWith('alice', saved);
  });

  it('binds credentials to a server', async () => {
    await setServerCredentialBindings('jenkins', ['cred-1']);
    expect(replaceServerCredentialBindings).toHaveBeenCalledWith('jenkins', ['cred-1']);
  });
});

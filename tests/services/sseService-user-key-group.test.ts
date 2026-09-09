import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request } from 'express';
import type { BearerKey, IGroup, IUser } from '../../src/types/index.js';

const mockGroupDao = {
  findByMember: jest.fn(),
  findByName: jest.fn(),
  findById: jest.fn(),
};

const mockUserDao = {
  findByUsername: jest.fn(),
};

jest.mock('../../src/dao/index.js', () => ({
  getBearerKeyDao: jest.fn(),
  getGroupDao: jest.fn(() => mockGroupDao),
  getServerDao: jest.fn(),
  getSystemConfigDao: jest.fn(),
  getUserDao: jest.fn(() => mockUserDao),
}));

jest.mock('../../src/config/index.js', () => ({
  __esModule: true,
  default: { basePath: '' },
  loadSettings: jest.fn(),
}));

jest.mock('../../src/services/mcpService.js', () => ({
  deleteMcpServer: jest.fn(),
  getMcpServer: jest.fn(),
}));

jest.mock('../../src/utils/oauthBearer.js', () => ({
  resolveOAuthUserFromToken: jest.fn(),
}));

jest.mock('../../src/services/hostedAuthService.js', () => ({
  HostedAuthUnavailableError: class extends Error {},
  isHostedApiKey: jest.fn(() => false),
  validateHostedBearer: jest.fn(),
}));

jest.mock('../../src/services/hostedMode.js', () => ({
  isHostedModeEnabled: jest.fn(() => false),
}));

jest.mock('../../src/db/connection.js', () => ({
  getDatabase: jest.fn(),
  getAppDataSource: jest.fn(),
}));

import { isBearerKeyAllowedForRequest } from '../../src/services/sseService.js';

const testUser: IUser = {
  username: 'test',
  password: '',
  isAdmin: false,
};

const memberGroup: IGroup = {
  id: 'g1',
  name: 'jenkins-readonly',
  owner: 'admin',
  members: ['test'],
  servers: [
    { name: 'jenkins', tools: ['health_check'], prompts: 'all', resources: 'all' },
  ],
};

const secretGroup: IGroup = {
  id: 'g2',
  name: 'secret',
  owner: 'admin',
  members: ['alice'],
  servers: [{ name: 'nightingale', tools: 'all', prompts: 'all', resources: 'all' }],
};

const userKey: BearerKey = {
  id: 'k1',
  name: 'test-key',
  token: 'tok',
  enabled: true,
  kind: 'user',
  owner: 'test',
  accessType: 'all',
};

const requestFor = (group?: string): Request =>
  ({ params: group ? { group } : {} }) as Request;

describe('sseService user-key group scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserDao.findByUsername.mockResolvedValue(testUser);
    mockGroupDao.findByMember.mockResolvedValue([memberGroup]);
    mockGroupDao.findById.mockResolvedValue(null);
    mockGroupDao.findByName.mockImplementation(async (name: string) => {
      if (name === memberGroup.name) return memberGroup;
      if (name === secretGroup.name) return secretGroup;
      return null;
    });
  });

  it('allows a user key on the global /mcp route', async () => {
    await expect(isBearerKeyAllowedForRequest(requestFor(), userKey)).resolves.toBe(true);
    await expect(isBearerKeyAllowedForRequest(requestFor('$smart'), userKey)).resolves.toBe(true);
  });

  it('allows a user key on a member group or a server in the union', async () => {
    await expect(
      isBearerKeyAllowedForRequest(requestFor('jenkins-readonly'), userKey),
    ).resolves.toBe(true);
    await expect(isBearerKeyAllowedForRequest(requestFor('jenkins'), userKey)).resolves.toBe(true);
    await expect(
      isBearerKeyAllowedForRequest(requestFor('$smart/jenkins-readonly'), userKey),
    ).resolves.toBe(true);
  });

  it('rejects a user key on a group the owner is not a member of', async () => {
    await expect(isBearerKeyAllowedForRequest(requestFor('secret'), userKey)).resolves.toBe(false);
    await expect(
      isBearerKeyAllowedForRequest(requestFor('$smart/secret'), userKey),
    ).resolves.toBe(false);
    await expect(
      isBearerKeyAllowedForRequest(requestFor('nightingale'), userKey),
    ).resolves.toBe(false);
  });
});

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Request } from 'express';
import type { BearerKey } from '../../src/types/index.js';

const mockUserDao = {
  findByUsername: jest.fn(),
};

jest.mock('../../src/dao/index.js', () => ({
  getBearerKeyDao: jest.fn(),
  getGroupDao: jest.fn(),
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

import { resolveUserLevelKeyUser } from '../../src/services/sseService.js';

const userKey: BearerKey = {
  id: 'k1',
  name: 'ops',
  token: 'ylune_abc',
  enabled: true,
  kind: 'user',
  owner: 'ops',
  accessType: 'all',
  allowedGroups: [],
  allowedServers: [],
};

const req = { params: {} } as Request;

describe('resolveUserLevelKeyUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a console-only admin from /mcp', async () => {
    mockUserDao.findByUsername.mockResolvedValue({
      username: 'ops',
      password: 'hash',
      isAdmin: true,
      consoleEnabled: true,
      mcpEnabled: false,
    });
    await expect(resolveUserLevelKeyUser(req, userKey)).resolves.toEqual({
      valid: false,
      reason: 'disabled',
    });
  });

  it('expires an admin MCP key without blocking console logic', async () => {
    mockUserDao.findByUsername.mockResolvedValue({
      username: 'ops',
      password: 'hash',
      isAdmin: true,
      consoleEnabled: true,
      mcpEnabled: true,
      tokenExpiresAt: new Date(Date.now() - 60_000),
    });
    await expect(resolveUserLevelKeyUser(req, userKey)).resolves.toEqual({
      valid: false,
      reason: 'expired',
    });
  });
});

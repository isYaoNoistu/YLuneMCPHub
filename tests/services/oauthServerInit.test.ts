jest.mock('@node-oauth/oauth2-server', () => {
  return jest.fn().mockImplementation(() => ({}));
});

jest.mock('../../src/dao/index.js', () => ({
  getSystemConfigDao: jest.fn(),
  getBearerKeyDao: jest.fn(),
}));

jest.mock('../../src/models/User.js', () => ({
  findUserByUsername: jest.fn(),
  verifyPassword: jest.fn(),
}));

jest.mock('../../src/models/OAuth.js', () => ({
  findOAuthClientById: jest.fn(),
  saveAuthorizationCode: jest.fn(),
  getAuthorizationCode: jest.fn(),
  revokeAuthorizationCode: jest.fn(),
  saveToken: jest.fn(),
  getToken: jest.fn(),
  revokeToken: jest.fn(),
}));

import * as daoModule from '../../src/dao/index.js';
import { initOAuthServer, getOAuthServer } from '../../src/services/oauthServerService.js';

describe('initOAuthServer', () => {
  const mockGet = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (daoModule.getSystemConfigDao as jest.Mock).mockReturnValue({ get: mockGet });
  });

  it('initializes with default config when oauthServer is an empty object (first DB-mode startup)', async () => {
    mockGet.mockResolvedValue({ oauthServer: {} });

    await initOAuthServer();

    expect(getOAuthServer()).not.toBeNull();
  });

  it('initializes with default config when oauthServer is undefined', async () => {
    mockGet.mockResolvedValue({});

    await initOAuthServer();

    expect(getOAuthServer()).not.toBeNull();
  });

  it('does not initialize when oauthServer.enabled is explicitly false', async () => {
    mockGet.mockResolvedValue({ oauthServer: { enabled: false } });

    await initOAuthServer();

    expect(getOAuthServer()).toBeNull();
  });

  it('initializes with stored config when oauthServer.enabled is explicitly true', async () => {
    mockGet.mockResolvedValue({
      oauthServer: {
        enabled: true,
        accessTokenLifetime: 7200,
        requireClientSecret: true,
      },
    });

    await initOAuthServer();

    expect(getOAuthServer()).not.toBeNull();
  });

  it('initializes with merged defaults when stored config is partial (only enabled)', async () => {
    mockGet.mockResolvedValue({
      oauthServer: { enabled: true },
    });

    await initOAuthServer();

    expect(getOAuthServer()).not.toBeNull();
  });
});

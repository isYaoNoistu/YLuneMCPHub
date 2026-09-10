import { Request, Response } from 'express';
import { jest } from '@jest/globals';

const createUserMock = jest.fn();
const findUserByUsernameMock = jest.fn();
const verifyPasswordMock = jest.fn();

jest.mock('../../src/models/User.js', () => ({
  createUser: createUserMock,
  findUserByUsername: findUserByUsernameMock,
  verifyPassword: verifyPasswordMock,
  updateUserPassword: jest.fn(),
}));

jest.mock('../../src/services/services.js', () => ({
  getDataService: jest.fn(() => ({
    getPermissions: jest.fn(() => ['']),
  })),
}));

jest.mock('../../src/config/jwt.js', () => ({
  JWT_SECRET: 'test-secret',
}));

jest.mock('../../src/utils/passwordValidation.js', () => ({
  validatePasswordStrength: jest.fn(() => ({ isValid: true, errors: [] })),
  isDefaultPassword: jest.fn(() => false),
}));

jest.mock('../../src/utils/version.js', () => ({
  getPackageVersion: jest.fn(() => 'dev'),
}));

jest.mock('../../src/services/userService.js', () => ({
  toSessionUser: jest.fn(async (user: { username: string; isAdmin?: boolean }) => ({
    username: user.username,
    isAdmin: Boolean(user.isAdmin),
    permissions: [],
    grants: [],
    consoleEnabled: true,
    mcpEnabled: true,
    tokenExpiresAt: null,
    expired: false,
    createdAt: null,
    lastCalledAt: null,
  })),
}));

import { login, register } from '../../src/controllers/authController.js';
import { DUMMY_PASSWORD_HASH } from '../../src/utils/loginGuard.js';

const makeRes = () => {
  const res = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response & {
    json: jest.Mock;
    status: jest.Mock;
    setHeader: jest.Mock;
  };
};

const makeReq = (body: Record<string, unknown> = {}) =>
  ({
    body,
    ip: '203.0.113.10',
    t: (value: string) => value,
  }) as unknown as Request;

describe('authController.register', () => {
  it('rejects self-registration', async () => {
    const req = makeReq({
      username: 'alice',
      password: 'secret123',
      isAdmin: true,
    });
    const res = makeRes();

    await register(req, res);

    expect(createUserMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'api.errors.registration_disabled',
      }),
    );
  });
});

describe('authController.login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('still verifies a dummy hash when the user is missing', async () => {
    findUserByUsernameMock.mockResolvedValue(undefined);
    verifyPasswordMock.mockResolvedValue(false);

    const req = makeReq({ username: 'nobody', password: 'wrong-pass' });
    const res = makeRes();

    await login(req, res);

    expect(verifyPasswordMock).toHaveBeenCalledWith('wrong-pass', DUMMY_PASSWORD_HASH);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'api.errors.invalid_credentials',
      }),
    );
  });

  it('rejects overlong credentials before hashing', async () => {
    const req = makeReq({
      username: 'ops',
      password: 'x'.repeat(129),
    });
    const res = makeRes();

    await login(req, res);

    expect(findUserByUsernameMock).not.toHaveBeenCalled();
    expect(verifyPasswordMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('trims the username before lookup', async () => {
    findUserByUsernameMock.mockResolvedValue(undefined);
    verifyPasswordMock.mockResolvedValue(false);

    const req = makeReq({ username: '  ops  ', password: 'secret' });
    const res = makeRes();

    await login(req, res);

    expect(findUserByUsernameMock).toHaveBeenCalledWith('ops');
  });

  it('rejects MCP-only users from the console even with a valid password', async () => {
    findUserByUsernameMock.mockResolvedValue({
      username: 'agent',
      password: 'hash',
      isAdmin: false,
      consoleEnabled: false,
      mcpEnabled: true,
    });
    verifyPasswordMock.mockResolvedValue(true);

    const req = makeReq({ username: 'agent', password: 'secret123' });
    const res = makeRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: 'api.errors.console_login_disabled',
      }),
    );
  });

  it('lets a console admin log in after their MCP key expired', async () => {
    findUserByUsernameMock.mockResolvedValue({
      username: 'ops',
      password: 'hash',
      isAdmin: true,
      consoleEnabled: true,
      mcpEnabled: true,
      tokenExpiresAt: new Date(Date.now() - 60_000),
    });
    verifyPasswordMock.mockResolvedValue(true);

    const req = makeReq({ username: 'ops', password: 'secret123' });
    const res = makeRes();

    await login(req, res);

    expect(res.status).not.toHaveBeenCalledWith(401);
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        token: expect.any(String),
      }),
    );
  });
});

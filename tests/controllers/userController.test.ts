import { Request, Response } from 'express';

// ── Mock service layer ───────────────────────────────────────────
const mockGetAllUsers = jest.fn();
const mockGetUserByUsername = jest.fn();
const mockCreateNewUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockDeleteUser = jest.fn();
const mockGetUserCount = jest.fn();
const mockGetAdminCount = jest.fn();
const mockCheckReservedUsername = jest.fn(() => null);
const mockGenerateInternalPassword = jest.fn(() => 'A1!generated-internal-pass');
const mockEnsureUserAccessToken = jest.fn(async () => 'ylune_testtoken');
const mockRotateUserAccessToken = jest.fn(async () => 'ylune_rotatedtoken');
const mockToPublicUser = jest.fn(async (user: { password?: string; [key: string]: unknown }) => {
  const { password: _password, ...rest } = user;
  return { ...rest, token: 'ylune_testtoken' };
});

jest.mock('../../src/services/userService.js', () => ({
  getAllUsers: mockGetAllUsers,
  getUserByUsername: mockGetUserByUsername,
  createNewUser: mockCreateNewUser,
  updateUser: mockUpdateUser,
  deleteUser: mockDeleteUser,
  getUserCount: mockGetUserCount,
  getAdminCount: mockGetAdminCount,
  checkReservedUsername: mockCheckReservedUsername,
  generateInternalPassword: mockGenerateInternalPassword,
  ensureUserAccessToken: mockEnsureUserAccessToken,
  rotateUserAccessToken: mockRotateUserAccessToken,
  toPublicUser: mockToPublicUser,
  attachLastCalledAt: jest.fn(async (users: unknown[]) => users),
}));

jest.mock('../../src/utils/passwordValidation.js', () => ({
  validatePasswordStrength: jest.fn(() => ({ isValid: true, errors: [] })),
}));

import {
  getUsers,
  createUser,
  updateExistingUser,
  rotateUserToken,
} from '../../src/controllers/userController.js';

const makeRes = () => {
  const res = {
    json: jest.fn().mockReturnThis(),
    status: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response;
};

const makeReq = (overrides: Record<string, any> = {}) =>
  ({
    body: {},
    params: {},
    user: { username: 'admin', isAdmin: true },
    ...overrides,
  }) as unknown as Request;

describe('userController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── createUser ───────────────────────────────────────────────

  describe('createUser', () => {
    it('should pass email to createNewUser service', async () => {
      mockCreateNewUser.mockResolvedValue({
        username: 'newuser',
        email: 'new@example.com',
        isAdmin: false,
      });

      const req = makeReq({
        body: { username: 'newuser', password: 'pass1234', isAdmin: false, email: 'new@example.com' },
      });
      const res = makeRes();

      await createUser(req, res);

      expect(mockCreateNewUser).toHaveBeenCalledWith(
        'newuser',
        'pass1234',
        false,
        'new@example.com',
        undefined,
        [],
        null,
        { consoleEnabled: false, mcpEnabled: true, demo: false },
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ email: 'new@example.com' }),
        }),
      );
    });

    it('should work without email (backward compatible)', async () => {
      mockCreateNewUser.mockResolvedValue({
        username: 'newuser',
        isAdmin: false,
      });

      const req = makeReq({
        body: { username: 'newuser', password: 'pass1234' },
      });
      const res = makeRes();

      await createUser(req, res);

      expect(mockCreateNewUser).toHaveBeenCalledWith(
        'newuser',
        'pass1234',
        false,
        undefined,
        undefined,
        [],
        null,
        { consoleEnabled: false, mcpEnabled: true, demo: false },
      );
    });

    it('should create a token-only user with remark', async () => {
      mockCreateNewUser.mockResolvedValue({
        username: 'ops',
        isAdmin: false,
        remark: '值班账号',
      });

      const req = makeReq({
        body: { username: 'ops', remark: '值班账号' },
      });
      const res = makeRes();

      await createUser(req, res);

      expect(mockCreateNewUser).toHaveBeenCalledWith(
        'ops',
        'A1!generated-internal-pass',
        false,
        undefined,
        '值班账号',
        [],
        null,
        { consoleEnabled: false, mcpEnabled: true, demo: false },
      );
      expect(mockEnsureUserAccessToken).toHaveBeenCalledWith('ops', undefined);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('should persist a 7-day token lifetime', async () => {
      mockCreateNewUser.mockResolvedValue({
        username: 'temp',
        isAdmin: false,
      });

      const req = makeReq({
        body: { username: 'temp', tokenLifetime: '7d' },
      });
      const res = makeRes();

      await createUser(req, res);

      expect(mockCreateNewUser).toHaveBeenCalledWith(
        'temp',
        'A1!generated-internal-pass',
        false,
        undefined,
        undefined,
        [],
        expect.any(Date),
        { consoleEnabled: false, mcpEnabled: true, demo: false },
      );
      const expiresAt = mockCreateNewUser.mock.calls[0][6] as Date;
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + sevenDays - 2000);
      expect(expiresAt.getTime()).toBeLessThan(Date.now() + sevenDays + 2000);
    });

    it('should reject a custom expiry in the past', async () => {
      const req = makeReq({
        body: {
          username: 'temp',
          tokenLifetime: 'custom',
          tokenExpiresAt: new Date(Date.now() - 60_000).toISOString(),
        },
      });
      const res = makeRes();

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockCreateNewUser).not.toHaveBeenCalled();
    });

    it('should reject custom lifetime without a date', async () => {
      const req = makeReq({
        body: { username: 'temp', tokenLifetime: 'custom' },
      });
      const res = makeRes();

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockCreateNewUser).not.toHaveBeenCalled();
    });

    it('requires a password for console admins and does not issue a key by default', async () => {
      const req = makeReq({
        body: { username: 'ops-admin', isAdmin: true },
      });
      const res = makeRes();

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockCreateNewUser).not.toHaveBeenCalled();
      expect(mockEnsureUserAccessToken).not.toHaveBeenCalled();
    });

    it('creates a console-only admin without an Access Key', async () => {
      mockCreateNewUser.mockResolvedValue({
        username: 'ops-admin',
        isAdmin: true,
        consoleEnabled: true,
        mcpEnabled: false,
      });

      const req = makeReq({
        body: { username: 'ops-admin', password: 'Passw0rd!', isAdmin: true },
      });
      const res = makeRes();

      await createUser(req, res);

      expect(mockCreateNewUser).toHaveBeenCalledWith(
        'ops-admin',
        'Passw0rd!',
        true,
        undefined,
        undefined,
        [],
        null,
        { consoleEnabled: true, mcpEnabled: false, demo: false },
      );
      expect(mockEnsureUserAccessToken).not.toHaveBeenCalled();
    });

    it('creates a demo account without MCP or Access Key', async () => {
      mockCreateNewUser.mockResolvedValue({
        username: 'guest',
        isAdmin: false,
        consoleEnabled: true,
        mcpEnabled: false,
        demo: true,
      });

      const req = makeReq({
        body: { username: 'guest', password: 'Passw0rd!', demo: true, isAdmin: true },
      });
      const res = makeRes();

      await createUser(req, res);

      expect(mockCreateNewUser).toHaveBeenCalledWith(
        'guest',
        'Passw0rd!',
        false,
        undefined,
        undefined,
        [],
        null,
        { consoleEnabled: true, mcpEnabled: false, demo: true },
      );
      expect(mockEnsureUserAccessToken).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });

    it('requires a password for demo accounts', async () => {
      const req = makeReq({
        body: { username: 'guest', demo: true },
      });
      const res = makeRes();

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockCreateNewUser).not.toHaveBeenCalled();
    });

    it('should require username', async () => {
      const req = makeReq({ body: { email: 'x@x.com' } });
      const res = makeRes();

      await createUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockCreateNewUser).not.toHaveBeenCalled();
    });
  });

  // ── updateExistingUser ───────────────────────────────────────

  describe('updateExistingUser', () => {
    it('should pass email to updateUser service', async () => {
      mockGetUserByUsername.mockResolvedValue({ username: 'testuser', isAdmin: false });
      mockUpdateUser.mockResolvedValue({
        username: 'testuser',
        email: 'updated@example.com',
        isAdmin: false,
      });

      const req = makeReq({
        params: { username: 'testuser' },
        body: { email: 'updated@example.com' },
      });
      const res = makeRes();

      await updateExistingUser(req, res);

      expect(mockUpdateUser).toHaveBeenCalledWith('testuser', {
        email: 'updated@example.com',
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ email: 'updated@example.com' }),
        }),
      );
    });

    it('should update isAdmin and email together', async () => {
      mockGetUserByUsername.mockResolvedValue({ username: 'testuser', isAdmin: false });
      mockGetAdminCount.mockResolvedValue(2);
      mockUpdateUser.mockResolvedValue({
        username: 'testuser',
        email: 'admin@example.com',
        isAdmin: true,
      });

      const req = makeReq({
        params: { username: 'testuser' },
        body: { isAdmin: true, email: 'admin@example.com' },
      });
      const res = makeRes();

      await updateExistingUser(req, res);

      expect(mockUpdateUser).toHaveBeenCalledWith('testuser', {
        isAdmin: true,
        email: 'admin@example.com',
      });
    });

    it('should require at least one field to update', async () => {
      mockGetUserByUsername.mockResolvedValue({ username: 'testuser', isAdmin: false });

      const req = makeReq({
        params: { username: 'testuser' },
        body: {},
      });
      const res = makeRes();

      await updateExistingUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it('should require admin privileges', async () => {
      const req = makeReq({
        user: { username: 'regular', isAdmin: false },
        body: { email: 'x@x.com' },
      });
      const res = makeRes();

      await updateExistingUser(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('rotateUserToken', () => {
    it('returns 404 when the user does not exist', async () => {
      mockRotateUserAccessToken.mockResolvedValue(null);

      const req = makeReq({ params: { username: 'missing' } });
      const res = makeRes();

      await rotateUserToken(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: 'User not found' }),
      );
    });

    it('returns the new token after a successful rotation', async () => {
      mockRotateUserAccessToken.mockResolvedValue('ylune_rotatedtoken');
      mockGetUserByUsername.mockResolvedValue({
        username: 'ops',
        isAdmin: false,
      });

      const req = makeReq({ params: { username: 'ops' } });
      const res = makeRes();

      await rotateUserToken(req, res);

      expect(mockRotateUserAccessToken).toHaveBeenCalledWith('ops');
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ username: 'ops', token: 'ylune_rotatedtoken' }),
        }),
      );
    });
  });
});

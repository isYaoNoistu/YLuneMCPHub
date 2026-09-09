import { randomBytes } from 'node:crypto';
import { IUser } from '../types/index.js';
import { getBearerKeyDao, getUserDao } from '../dao/index.js';
import { logger } from '../utils/logger.js';

export const USER_ACCESS_TOKEN_PREFIX = 'ylune_';
const USER_ACCESS_TOKEN_PATTERN = /^(ylune|mcphub)_[a-fA-F0-9]{64}$/;

export const generateUserAccessToken = (): string =>
  `${USER_ACCESS_TOKEN_PREFIX}${randomBytes(32).toString('hex')}`;

export const isUserAccessToken = (token: string): boolean => USER_ACCESS_TOKEN_PATTERN.test(token);

/** Random console password for token-only sub-users. They do not log in with it. */
export const generateInternalPassword = (): string => `A1!${randomBytes(18).toString('base64url')}`;

export const getUserAccessToken = async (username: string): Promise<string | undefined> => {
  const keys = await getBearerKeyDao().findByOwner(username);
  const current = keys.find((key) => key.enabled) ?? keys[0];
  return current?.token;
};

export const ensureUserAccessToken = async (
  username: string,
  requestedToken?: string,
): Promise<string> => {
  const existing = await getUserAccessToken(username);
  if (existing) {
    return existing;
  }

  const token =
    requestedToken && isUserAccessToken(requestedToken)
      ? requestedToken
      : generateUserAccessToken();

  await getBearerKeyDao().create({
    name: username,
    token,
    enabled: true,
    kind: 'user',
    owner: username,
    accessType: 'all',
    allowedGroups: [],
    allowedServers: [],
  });

  return token;
};

export const toPublicUser = async (
  user: IUser,
): Promise<Omit<IUser, 'password'> & { token?: string }> => {
  const { password: _, ...rest } = user;
  return {
    ...rest,
    token: await getUserAccessToken(user.username),
  };
};

// Get all users
export const getAllUsers = async (): Promise<IUser[]> => {
  const userDao = getUserDao();
  return await userDao.findAll();
};

// Get user by username
export const getUserByUsername = async (username: string): Promise<IUser | undefined> => {
  const userDao = getUserDao();
  const user = await userDao.findByUsername(username);
  return user || undefined;
};

/** Usernames reserved for system use (case-insensitive). */
const RESERVED_USERNAMES = ['system', 'admin', 'guest', 'root'];

/**
 * Check if a username is reserved for system use.
 * Returns the reason string if reserved, or null if allowed.
 */
export const checkReservedUsername = (username: string): string | null => {
  const lower = username.toLowerCase();
  if (RESERVED_USERNAMES.includes(lower)) {
    return `Username "${username}" is reserved and cannot be used`;
  }
  return null;
};

// Create a new user
export const createNewUser = async (
  username: string,
  password: string,
  isAdmin: boolean = false,
  email?: string,
  remark?: string,
): Promise<IUser | null> => {
  try {
    const reservedError = checkReservedUsername(username);
    if (reservedError) {
      logger.warn(`User creation blocked: ${reservedError}`);
      return null;
    }

    const userDao = getUserDao();
    const existingUser = await userDao.findByUsername(username);
    if (existingUser) {
      return null; // User already exists
    }

    return await userDao.createWithHashedPassword(
      username,
      password,
      isAdmin,
      email || undefined,
      undefined,
      remark?.trim() || undefined,
    );
  } catch (error) {
    logger.error('Failed to create user:', error);
    return null;
  }
};

// Update user information
export const updateUser = async (
  username: string,
  data: { isAdmin?: boolean; newPassword?: string; email?: string; remark?: string },
): Promise<IUser | null> => {
  try {
    const userDao = getUserDao();
    const user = await userDao.findByUsername(username);

    if (!user) {
      return null;
    }

    // Update admin status if provided
    if (data.isAdmin !== undefined) {
      const result = await userDao.update(username, { isAdmin: data.isAdmin });
      if (!result) {
        return null;
      }
    }

    // Update email if provided
    if (data.email !== undefined) {
      const result = await userDao.update(username, { email: data.email || null });
      if (!result) {
        return null;
      }
    }

    if (data.remark !== undefined) {
      const result = await userDao.update(username, { remark: data.remark.trim() || null });
      if (!result) {
        return null;
      }
    }

    // Update password if provided
    if (data.newPassword) {
      const success = await userDao.updatePassword(username, data.newPassword);
      if (!success) {
        return null;
      }
    }

    // Return updated user
    return await userDao.findByUsername(username);
  } catch (error) {
    logger.error('Failed to update user:', error);
    return null;
  }
};

// Delete a user
export const deleteUser = async (username: string): Promise<boolean> => {
  try {
    const userDao = getUserDao();

    // Cannot delete the last admin user
    const users = await userDao.findAll();
    const adminUsers = users.filter((user) => user.isAdmin);
    const userToDelete = users.find((user) => user.username === username);

    if (userToDelete?.isAdmin && adminUsers.length === 1) {
      return false; // Cannot delete the last admin
    }

    const deleted = await userDao.delete(username);
    if (deleted) {
      await getBearerKeyDao().deleteByOwner(username);
    }
    return deleted;
  } catch (error) {
    logger.error('Failed to delete user:', error);
    return false;
  }
};

// Check if user has admin permissions
export const isUserAdmin = async (username: string): Promise<boolean> => {
  const userDao = getUserDao();
  const user = await userDao.findByUsername(username);
  return user?.isAdmin || false;
};

// Get user count
export const getUserCount = async (): Promise<number> => {
  const userDao = getUserDao();
  return await userDao.count();
};

// Get admin count
export const getAdminCount = async (): Promise<number> => {
  const userDao = getUserDao();
  const admins = await userDao.findAdmins();
  return admins.length;
};

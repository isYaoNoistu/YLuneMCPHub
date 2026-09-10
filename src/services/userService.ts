import { randomBytes } from 'node:crypto';
import { IGroupServerConfig, IUser } from '../types/index.js';
import { getActivityDao, getBearerKeyDao, getResourceDao, getUserDao } from '../dao/index.js';
import { logger } from '../utils/logger.js';
import { isUserTokenExpired, serializeTokenExpiresAt } from '../utils/userTokenExpiry.js';
import { isMcpEnabled, resolveAccountFlags } from '../utils/userAccount.js';

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

export const rotateUserAccessToken = async (username: string): Promise<string | null> => {
  const user = await getUserDao().findByUsername(username);
  if (!user || !isMcpEnabled(user)) {
    return null;
  }
  await getBearerKeyDao().deleteByOwner(username);
  return ensureUserAccessToken(username);
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
): Promise<
  Omit<IUser, 'password'> & {
    token?: string;
    expired: boolean;
    tokenExpiresAt: string | null;
    createdAt: string | null;
    lastCalledAt: string | null;
  }
> => {
  const { password: _, ...rest } = user;
  const flags = resolveAccountFlags(user);
  return {
    ...rest,
    ...flags,
    tokenExpiresAt: serializeTokenExpiresAt(user.tokenExpiresAt),
    createdAt: serializeTokenExpiresAt(user.createdAt),
    lastCalledAt: null,
    expired: isUserTokenExpired(user),
    token: flags.mcpEnabled ? await getUserAccessToken(user.username) : undefined,
  };
};

export const attachLastCalledAt = async <T extends { username: string; lastCalledAt?: string | null }>(
  users: T[],
): Promise<(T & { lastCalledAt: string | null })[]> => {
  const dao = getActivityDao();
  if (!dao?.getLastTimestampByUsernames || users.length === 0) {
    return users.map((user) => ({ ...user, lastCalledAt: user.lastCalledAt ?? null }));
  }

  try {
    const lastMap = await dao.getLastTimestampByUsernames(users.map((user) => user.username));
    return users.map((user) => ({
      ...user,
      lastCalledAt: serializeTokenExpiresAt(lastMap.get(user.username) ?? null),
    }));
  } catch (error) {
    logger.warn('Failed to load last call times for users:', error);
    return users.map((user) => ({ ...user, lastCalledAt: user.lastCalledAt ?? null }));
  }
};

export const toSessionUser = async (
  user: IUser,
  permissions: string[],
): Promise<{
  username: string;
  isAdmin: boolean;
  permissions: string[];
  grants: IGroupServerConfig[];
  consoleEnabled: boolean;
  mcpEnabled: boolean;
  tokenExpiresAt: string | null;
  expired: boolean;
  createdAt: string | null;
  lastCalledAt: string | null;
}> => {
  const flags = resolveAccountFlags(user);
  const [withLast] = await attachLastCalledAt([
    {
      username: user.username,
      isAdmin: flags.isAdmin,
      consoleEnabled: flags.consoleEnabled,
      mcpEnabled: flags.mcpEnabled,
      permissions,
      grants: flags.isAdmin ? [] : user.grants || [],
      tokenExpiresAt: serializeTokenExpiresAt(user.tokenExpiresAt),
      expired: isUserTokenExpired(user),
      createdAt: serializeTokenExpiresAt(user.createdAt),
      lastCalledAt: null,
    },
  ]);
  return withLast;
};

export const normalizeUserGrants = (input: unknown): IGroupServerConfig[] => {
  if (!Array.isArray(input)) {
    return [];
  }
  const grants: IGroupServerConfig[] = [];
  for (const item of input) {
    if (typeof item === 'string' && item.trim()) {
      grants.push({ name: item.trim(), tools: 'all', prompts: 'all', resources: 'all' });
      continue;
    }
    if (!item || typeof item !== 'object') {
      continue;
    }
    const server = item as Partial<IGroupServerConfig>;
    if (typeof server.name !== 'string' || !server.name.trim()) {
      continue;
    }
    grants.push({
      name: server.name.trim(),
      ...(server.alias?.trim() ? { alias: server.alias.trim() } : {}),
      tools: server.tools ?? 'all',
      prompts: server.prompts ?? 'all',
      resources: server.resources ?? 'all',
    });
  }
  return grants;
};

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
  grants?: IGroupServerConfig[],
  tokenExpiresAt?: Date | null,
  account?: { consoleEnabled?: boolean; mcpEnabled?: boolean },
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

    const flags = resolveAccountFlags({ isAdmin, ...account });
    return await userDao.createWithHashedPassword(
      username,
      password,
      flags.isAdmin,
      email || undefined,
      undefined,
      remark?.trim() || undefined,
      grants ?? [],
      flags.mcpEnabled ? tokenExpiresAt ?? null : null,
      { consoleEnabled: flags.consoleEnabled, mcpEnabled: flags.mcpEnabled },
    );
  } catch (error) {
    logger.error('Failed to create user:', error);
    return null;
  }
};

// Update user information
export const updateUser = async (
  username: string,
  data: {
    isAdmin?: boolean;
    consoleEnabled?: boolean;
    mcpEnabled?: boolean;
    newPassword?: string;
    email?: string;
    remark?: string;
    grants?: IGroupServerConfig[];
    tokenExpiresAt?: Date | null;
  },
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

    if (data.consoleEnabled !== undefined) {
      const result = await userDao.update(username, { consoleEnabled: data.consoleEnabled });
      if (!result) {
        return null;
      }
    }

    if (data.mcpEnabled !== undefined) {
      const result = await userDao.update(username, { mcpEnabled: data.mcpEnabled });
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

    if (data.grants !== undefined) {
      const result = await userDao.update(username, { grants: data.grants });
      if (!result) {
        return null;
      }
    }

    if (data.tokenExpiresAt !== undefined) {
      const nextMcpEnabled = data.mcpEnabled ?? user.mcpEnabled;
      const result = await userDao.update(username, {
        tokenExpiresAt: nextMcpEnabled === false ? null : data.tokenExpiresAt,
      });
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
      const resourceDao = getResourceDao();
      if (resourceDao) {
        await resourceDao.deleteUserServerCredentials(username);
      }
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

/** After schema add: keep existing admins able to open the console. */
export const backfillAccountFlags = async (): Promise<void> => {
  const userDao = getUserDao();
  const users = await userDao.findAll();
  for (const user of users) {
    const patch: Partial<IUser> = {};
    if (user.isAdmin && user.consoleEnabled !== true) {
      patch.consoleEnabled = true;
    }
    if (user.mcpEnabled === undefined || user.mcpEnabled === null) {
      patch.mcpEnabled = true;
    }
    if (Object.keys(patch).length > 0) {
      await userDao.update(user.username, patch);
    }
  }
};

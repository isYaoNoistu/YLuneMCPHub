import { IUser } from '../types/index.js';

export interface AccountFlags {
  isAdmin: boolean;
  consoleEnabled: boolean;
  mcpEnabled: boolean;
}

/**
 * Old rows have no consoleEnabled / mcpEnabled columns.
 * After TypeORM adds the columns, admins must still keep console access.
 */
export const resolveAccountFlags = (
  user: Pick<IUser, 'isAdmin' | 'consoleEnabled' | 'mcpEnabled'>,
): AccountFlags => {
  const isAdmin = Boolean(user.isAdmin);
  return {
    isAdmin,
    consoleEnabled: user.consoleEnabled !== undefined ? Boolean(user.consoleEnabled) : isAdmin,
    mcpEnabled: user.mcpEnabled !== undefined ? Boolean(user.mcpEnabled) : true,
  };
};

export const isConsoleEnabled = (
  user: Pick<IUser, 'isAdmin' | 'consoleEnabled'>,
): boolean => resolveAccountFlags(user).consoleEnabled;

export const isMcpEnabled = (user: Pick<IUser, 'mcpEnabled'>): boolean =>
  user.mcpEnabled !== undefined ? Boolean(user.mcpEnabled) : true;

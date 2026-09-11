import { IUser } from '../types/index.js';

export interface AccountFlags {
  isAdmin: boolean;
  consoleEnabled: boolean;
  mcpEnabled: boolean;
  demo: boolean;
}

/**
 * Old rows have no consoleEnabled / mcpEnabled / demo columns.
 * After TypeORM adds the columns, admins must still keep console access.
 * A demo account can log in but is never admin and never gets MCP.
 */
export const resolveAccountFlags = (
  user: Pick<IUser, 'isAdmin' | 'consoleEnabled' | 'mcpEnabled' | 'demo'>,
): AccountFlags => {
  const demo = Boolean(user.demo);
  const isAdmin = demo ? false : Boolean(user.isAdmin);
  return {
    isAdmin,
    demo,
    consoleEnabled: demo
      ? true
      : user.consoleEnabled !== undefined
        ? Boolean(user.consoleEnabled)
        : isAdmin,
    mcpEnabled: demo
      ? false
      : user.mcpEnabled !== undefined
        ? Boolean(user.mcpEnabled)
        : true,
  };
};

export const isDemoUser = (
  user: Pick<IUser, 'demo' | 'isAdmin'> | null | undefined,
): boolean => Boolean(user?.demo);

export const isConsoleEnabled = (
  user: Pick<IUser, 'isAdmin' | 'consoleEnabled' | 'mcpEnabled' | 'demo'>,
): boolean => resolveAccountFlags(user).consoleEnabled;

export const isMcpEnabled = (
  user: Pick<IUser, 'isAdmin' | 'consoleEnabled' | 'mcpEnabled' | 'demo'>,
): boolean => resolveAccountFlags(user).mcpEnabled;

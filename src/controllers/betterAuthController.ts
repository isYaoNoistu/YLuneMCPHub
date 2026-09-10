import { Request, Response } from 'express';
import { resolveBetterAuthUser } from '../services/betterAuthSession.js';
import { getDataService } from '../services/services.js';
import { findUserByUsername } from '../models/User.js';
import { toSessionUser } from '../services/userService.js';
import { logger } from '../utils/logger.js';

const dataService = getDataService();

export const getBetterAuthUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await resolveBetterAuthUser(req);
    if (!user) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const stored = await findUserByUsername(user.username);
    res.json({
      success: true,
      user: stored
        ? await toSessionUser(stored, dataService.getPermissions(user))
        : {
            username: user.username,
            isAdmin: user.isAdmin,
            permissions: dataService.getPermissions(user),
            grants: user.isAdmin ? [] : user.grants || [],
            tokenExpiresAt: null,
            expired: false,
            createdAt: null,
            lastCalledAt: null,
          },
    });
  } catch (error) {
    logger.error('Get Better Auth user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

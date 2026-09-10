import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { findUserByUsername, verifyPassword, updateUserPassword } from '../models/User.js';
import { toSessionUser } from '../services/userService.js';
import { getDataService } from '../services/services.js';
import { DataService } from '../services/dataService.js';
import { JWT_SECRET } from '../config/jwt.js';
import { validatePasswordStrength, isDefaultPassword } from '../utils/passwordValidation.js';
import { getPackageVersion } from '../utils/version.js';
import { isUserTokenExpired } from '../utils/userTokenExpiry.js';
import {
  DUMMY_PASSWORD_HASH,
  LOGIN_PASSWORD_MAX,
  LOGIN_USERNAME_MAX,
  normalizeLoginUsername,
} from '../utils/loginGuard.js';
import { logger } from '../utils/logger.js';

const dataService: DataService = getDataService();

const TOKEN_EXPIRY = '24h';

// Login user
export const login = async (req: Request, res: Response): Promise<void> => {
  // Get translation function from request
  const t = (req as any).t;

  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      message: t('api.errors.validation_failed'),
      errors: errors.array(),
    });
    return;
  }

  const username = normalizeLoginUsername(
    typeof req.body.username === 'string' ? req.body.username : '',
  );
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (
    !username ||
    username.length > LOGIN_USERNAME_MAX ||
    !password ||
    password.length > LOGIN_PASSWORD_MAX
  ) {
    res.status(400).json({
      success: false,
      message: t('api.errors.validation_failed'),
    });
    return;
  }

  try {
    const user = await findUserByUsername(username);
    const isPasswordValid = await verifyPassword(password, user?.password || DUMMY_PASSWORD_HASH);

    if (!user || !isPasswordValid) {
      logger.warn('Login failed', { username, ip: req.ip });
      res.setHeader('Cache-Control', 'no-store');
      res.status(401).json({
        success: false,
        message: t('api.errors.invalid_credentials'),
      });
      return;
    }

    if (isUserTokenExpired(user)) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(401).json({
        success: false,
        message: t('api.errors.user_token_expired'),
      });
      return;
    }

    // Generate JWT token
    const payload = {
      user: {
        username: user.username,
        isAdmin: user.isAdmin || false,
      },
    };

    // Check if user is admin with default password
    const version = getPackageVersion();
    const isUsingDefaultPassword =
      user.username === 'admin' && user.isAdmin && isDefaultPassword(password) && version !== 'dev';

    const sessionUser = await toSessionUser(user, dataService.getPermissions(user));

    jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY }, (err, token) => {
      if (err) throw err;
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        success: true,
        message: t('api.success.login_successful'),
        token,
        user: sessionUser,
        isUsingDefaultPassword,
      });
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: t('api.errors.server_error'),
    });
  }
};

// Register new user
export const register = async (req: Request, res: Response): Promise<void> => {
  const t = (req as any).t;
  res.status(403).json({
    success: false,
    message:
      typeof t === 'function'
        ? t('api.errors.registration_disabled')
        : 'Self-registration is disabled',
  });
};

// Get current user
export const getCurrentUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    const stored = user?.username ? await findUserByUsername(user.username) : undefined;
    const sessionUser = stored
      ? await toSessionUser(stored, dataService.getPermissions(user))
      : {
          username: user.username,
          isAdmin: user.isAdmin,
          permissions: dataService.getPermissions(user),
          grants: [],
          tokenExpiresAt: null,
          expired: false,
          createdAt: null,
          lastCalledAt: null,
        };

    res.json({
      success: true,
      user: sessionUser,
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Change password
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, errors: errors.array() });
    return;
  }

  const { currentPassword, newPassword } = req.body;
  const username = (req as any).user.username;

  try {
    // Validate new password strength
    const validationResult = validatePasswordStrength(newPassword);
    if (!validationResult.isValid) {
      res.status(400).json({
        success: false,
        message: 'Password does not meet security requirements',
        errors: validationResult.errors,
      });
      return;
    }

    // Find user by username
    const user = await findUserByUsername(username);

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    // Verify current password
    const isPasswordValid = await verifyPassword(currentPassword, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    // Update the password
    const updated = await updateUserPassword(username, newPassword);

    if (!updated) {
      res.status(500).json({ success: false, message: 'Failed to update password' });
      return;
    }

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

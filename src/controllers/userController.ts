import { Request, Response } from 'express';
import { ApiResponse } from '../types/index.js';
import {
  getAllUsers,
  getUserByUsername,
  createNewUser,
  updateUser,
  deleteUser,
  getUserCount,
  getAdminCount,
  checkReservedUsername,
  generateInternalPassword,
  ensureUserAccessToken,
  rotateUserAccessToken,
  toPublicUser,
  attachLastCalledAt,
  normalizeUserGrants,
} from '../services/userService.js';
import { attachResourceGroupIds } from '../services/resourceService.js';
import { recordAdminAuditFromRequest } from '../services/adminAuditService.js';
import { validatePasswordStrength } from '../utils/passwordValidation.js';
import {
  isCustomExpiryIncomplete,
  isCustomExpiryInPast,
  resolveTokenExpiresAt,
} from '../utils/userTokenExpiry.js';

// Admin permission check middleware function
const requireAdmin = async (req: Request, res: Response): Promise<boolean> => {
  const user = (req as any).user;
  if (!user || !user.isAdmin) {
    res.status(403).json({
      success: false,
      message: 'Admin privileges required',
    });
    return false;
  }
  return true;
};

// Get all users (admin only)
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  try {
    const users = await attachResourceGroupIds(
      await attachLastCalledAt(
        await Promise.all((await getAllUsers()).map((user) => toPublicUser(user))),
      ),
    );
    const response: ApiResponse = {
      success: true,
      data: users,
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get users information',
    });
  }
};

// Get a specific user by username (admin only)
export const getUser = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  try {
    const { username } = req.params;
    if (!username) {
      res.status(400).json({
        success: false,
        message: 'Username is required',
      });
      return;
    }

    const user = await getUserByUsername(username);
    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found',
      });
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: await toPublicUser(user),
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user information',
    });
  }
};

// Create a new user (admin only)
export const createUser = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  try {
    const {
      username,
      password,
      isAdmin,
      consoleEnabled,
      mcpEnabled,
      email,
      remark,
      token,
      grants,
      tokenLifetime,
      tokenExpiresAt,
    } = req.body;

    if (!username || typeof username !== 'string' || !username.trim()) {
      res.status(400).json({
        success: false,
        message: 'Username is required',
      });
      return;
    }

    const creatingAdmin = Boolean(isAdmin) || consoleEnabled === true;
    const wantsMcp = mcpEnabled !== false && (mcpEnabled === true || !creatingAdmin);
    const resolvedPassword =
      typeof password === 'string' && password.trim() ? password : generateInternalPassword();

    if (creatingAdmin && !(typeof password === 'string' && password.trim())) {
      res.status(400).json({
        success: false,
        message: 'Password is required for console administrators',
      });
      return;
    }

    // Optional password is still validated when the caller supplies one
    if (typeof password === 'string' && password.trim()) {
      const validationResult = validatePasswordStrength(password);
      if (!validationResult.isValid) {
        res.status(400).json({
          success: false,
          message: 'Password does not meet security requirements',
          errors: validationResult.errors,
        });
        return;
      }
    }

    // Check username against reserved names (e.g. "system", "admin")
    const reservedError = checkReservedUsername(username);
    if (reservedError) {
      res.status(400).json({
        success: false,
        message: reservedError,
      });
      return;
    }

    if (isCustomExpiryIncomplete({ tokenLifetime, tokenExpiresAt })) {
      res.status(400).json({
        success: false,
        message: 'Custom token expiry is required',
      });
      return;
    }

    if (isCustomExpiryInPast({ tokenLifetime, tokenExpiresAt })) {
      res.status(400).json({
        success: false,
        message: 'Custom token expiry must be in the future',
      });
      return;
    }

    const newUser = await createNewUser(
      username.trim(),
      resolvedPassword,
      Boolean(isAdmin) || creatingAdmin,
      email,
      typeof remark === 'string' ? remark : undefined,
      grants !== undefined ? normalizeUserGrants(grants) : [],
      resolveTokenExpiresAt({
        mcpEnabled: wantsMcp,
        tokenLifetime,
        tokenExpiresAt,
      }),
      {
        consoleEnabled: creatingAdmin,
        mcpEnabled: wantsMcp,
      },
    );
    if (!newUser) {
      res.status(400).json({
        success: false,
        message: 'Failed to create user or username already exists',
      });
      return;
    }

    if (wantsMcp) {
      await ensureUserAccessToken(
        newUser.username,
        typeof token === 'string' ? token : undefined,
      );
    }
    const response: ApiResponse = {
      success: true,
      data: await toPublicUser(newUser),
      message: 'User created successfully',
    };
    await recordAdminAuditFromRequest(req, {
      action: 'user.create',
      resourceType: 'user',
      resourceId: newUser.username,
      after: { username: newUser.username, isAdmin: newUser.isAdmin, mcpEnabled: wantsMcp },
    });
    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Update an existing user (admin only)
export const updateExistingUser = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  try {
    const { username } = req.params;
    const { isAdmin, consoleEnabled, mcpEnabled, newPassword, email, remark, grants, tokenLifetime, tokenExpiresAt } =
      req.body;

    if (!username) {
      res.status(400).json({
        success: false,
        message: 'Username is required',
      });
      return;
    }

    // Check if trying to change admin status
    if (isAdmin !== undefined) {
      const currentUser = await getUserByUsername(username);
      if (!currentUser) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        });
        return;
      }

      // Prevent removing admin status from the last admin
      if (currentUser.isAdmin && !isAdmin && (await getAdminCount()) === 1) {
        res.status(400).json({
          success: false,
          message: 'Cannot remove admin status from the last admin user',
        });
        return;
      }
    }

    const updateData: any = {};
    if (isAdmin !== undefined) updateData.isAdmin = isAdmin;
    if (consoleEnabled !== undefined) updateData.consoleEnabled = Boolean(consoleEnabled);
    if (mcpEnabled !== undefined) updateData.mcpEnabled = Boolean(mcpEnabled);
    if (email !== undefined) updateData.email = email;
    if (remark !== undefined) updateData.remark = remark;
    if (grants !== undefined) updateData.grants = normalizeUserGrants(grants);
    if (tokenLifetime !== undefined || tokenExpiresAt !== undefined) {
      if (isCustomExpiryIncomplete({ tokenLifetime, tokenExpiresAt })) {
        res.status(400).json({
          success: false,
          message: 'Custom token expiry is required',
        });
        return;
      }
      if (isCustomExpiryInPast({ tokenLifetime, tokenExpiresAt })) {
        res.status(400).json({
          success: false,
          message: 'Custom token expiry must be in the future',
        });
        return;
      }
      const current = await getUserByUsername(username);
      updateData.tokenExpiresAt = resolveTokenExpiresAt({
        mcpEnabled: Boolean(mcpEnabled ?? current?.mcpEnabled ?? true),
        tokenLifetime,
        tokenExpiresAt,
      });
    }
    if (newPassword) {
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
      updateData.newPassword = newPassword;
    }

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({
        success: false,
        message:
          'At least one field (isAdmin, consoleEnabled, mcpEnabled, email, remark, grants, tokenLifetime, tokenExpiresAt, or newPassword) is required to update',
      });
      return;
    }

    const updatedUser = await updateUser(username, updateData);
    if (!updatedUser) {
      res.status(404).json({
        success: false,
        message: 'User not found or update failed',
      });
      return;
    }

    if (updatedUser.mcpEnabled) {
      await ensureUserAccessToken(updatedUser.username);
    }

    const response: ApiResponse = {
      success: true,
      data: await toPublicUser(updatedUser),
      message: 'User updated successfully',
    };
    await recordAdminAuditFromRequest(req, {
      action: grants !== undefined ? 'user.update_grants' : 'user.update',
      resourceType: 'user',
      resourceId: username,
      after: {
        isAdmin: updatedUser.isAdmin,
        mcpEnabled: updatedUser.mcpEnabled,
        grants: updatedUser.grants,
      },
    });
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Delete a user (admin only)
export const deleteExistingUser = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  try {
    const { username } = req.params;
    if (!username) {
      res.status(400).json({
        success: false,
        message: 'Username is required',
      });
      return;
    }

    // Check if trying to delete the current admin user
    const currentUser = (req as any).user;
    if (currentUser.username === username) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete your own account',
      });
      return;
    }

    const success = await deleteUser(username);
    if (!success) {
      res.status(400).json({
        success: false,
        message: 'User not found, failed to delete, or cannot delete the last admin',
      });
      return;
    }

    await recordAdminAuditFromRequest(req, {
      action: 'user.delete',
      resourceType: 'user',
      resourceId: username,
    });
    res.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const rotateUserToken = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  try {
    const { username } = req.params;
    if (!username) {
      res.status(400).json({ success: false, message: 'Username is required' });
      return;
    }

    const token = await rotateUserAccessToken(username);
    if (!token) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const user = await getUserByUsername(username);
    await recordAdminAuditFromRequest(req, {
      action: 'user.rotate_token',
      resourceType: 'user',
      resourceId: username,
    });
    res.json({
      success: true,
      data: user ? { ...(await toPublicUser(user)), token } : { username, token },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to rotate user token',
    });
  }
};

export const copyExistingUserGrants = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const { username } = req.params;
    const fromUsername = typeof req.body?.fromUsername === 'string' ? req.body.fromUsername.trim() : '';
    if (!username || !fromUsername) {
      res.status(400).json({ success: false, message: 'fromUsername is required' });
      return;
    }
    if (username === fromUsername) {
      res.status(400).json({ success: false, message: 'Cannot copy grants from the same user' });
      return;
    }
    const source = await getUserByUsername(fromUsername);
    const target = await getUserByUsername(username);
    if (!source || !target) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const grants = normalizeUserGrants(source.grants || []);
    const updatedUser = await updateUser(username, { grants });
    if (!updatedUser) {
      res.status(400).json({ success: false, message: 'Failed to copy grants' });
      return;
    }
    await recordAdminAuditFromRequest(req, {
      action: 'user.copy_grants',
      resourceType: 'user',
      resourceId: username,
      before: { grants: target.grants || [] },
      after: { grants, fromUsername },
    });
    res.json({
      success: true,
      data: await toPublicUser(updatedUser),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to copy grants',
    });
  }
};

// Get user statistics (admin only)
export const getUserStats = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;

  try {
    const totalUsers = await getUserCount();
    const adminUsers = await getAdminCount();
    const regularUsers = totalUsers - adminUsers;

    const response: ApiResponse = {
      success: true,
      data: {
        totalUsers,
        adminUsers,
        regularUsers,
      },
    };
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get user statistics',
    });
  }
};

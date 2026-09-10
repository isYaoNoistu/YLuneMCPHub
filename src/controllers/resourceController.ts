import { Request, Response } from 'express';
import { requireAdmin } from '../utils/requireAdmin.js';
import { recordAdminAuditFromRequest } from '../services/adminAuditService.js';
import { getActorUsername } from '../utils/requestMeta.js';
import {
  ResourceStoreUnavailableError,
  createResourceGroup,
  createResourceTarget,
  deleteResourceGroup,
  deleteResourceTarget,
  listResourceGroups,
  listResourceTargets,
  listUserResourceGroupIds,
  setUserResourceGroups,
  updateResourceGroup,
  updateResourceTarget,
} from '../services/resourceService.js';
import { getUserByUsername } from '../services/userService.js';

const handleError = (res: Response, error: unknown): void => {
  if (error instanceof ResourceStoreUnavailableError) {
    res.status(404).json({ success: false, message: 'api.errors.resource_store_unavailable' });
    return;
  }
  res.status(400).json({
    success: false,
    message: error instanceof Error ? error.message : 'Request failed',
  });
};

export const getResourceTargets = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    res.json({ success: true, data: await listResourceTargets() });
  } catch (error) {
    handleError(res, error);
  }
};

export const createNewResourceTarget = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const data = await createResourceTarget(req.body || {});
    await recordAdminAuditFromRequest(req, {
      action: 'target.create',
      resourceType: 'target',
      resourceId: data.id,
      after: data,
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateExistingResourceTarget = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const data = await updateResourceTarget(req.params.id, req.body || {});
    if (!data) {
      res.status(404).json({ success: false, message: 'Target not found' });
      return;
    }
    await recordAdminAuditFromRequest(req, {
      action: 'target.update',
      resourceType: 'target',
      resourceId: data.id,
      after: data,
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteExistingResourceTarget = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const ok = await deleteResourceTarget(req.params.id);
    if (!ok) {
      res.status(404).json({ success: false, message: 'Target not found' });
      return;
    }
    await recordAdminAuditFromRequest(req, {
      action: 'target.delete',
      resourceType: 'target',
      resourceId: req.params.id,
    });
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
};

export const getResourceGroups = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    res.json({ success: true, data: await listResourceGroups() });
  } catch (error) {
    handleError(res, error);
  }
};

export const createNewResourceGroup = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const data = await createResourceGroup(req.body || {});
    await recordAdminAuditFromRequest(req, {
      action: 'resource_group.create',
      resourceType: 'resource_group',
      resourceId: data.id,
      after: { name: data.name, items: data.items },
    });
    res.status(201).json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateExistingResourceGroup = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const data = await updateResourceGroup(req.params.id, req.body || {});
    if (!data) {
      res.status(404).json({ success: false, message: 'Resource group not found' });
      return;
    }
    await recordAdminAuditFromRequest(req, {
      action: 'resource_group.update',
      resourceType: 'resource_group',
      resourceId: data.id,
      after: { name: data.name, items: data.items },
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

export const deleteExistingResourceGroup = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const ok = await deleteResourceGroup(req.params.id);
    if (!ok) {
      res.status(404).json({ success: false, message: 'Resource group not found' });
      return;
    }
    await recordAdminAuditFromRequest(req, {
      action: 'resource_group.delete',
      resourceType: 'resource_group',
      resourceId: req.params.id,
    });
    res.json({ success: true });
  } catch (error) {
    handleError(res, error);
  }
};

export const getUserResourceGroups = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const user = await getUserByUsername(req.params.username);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    res.json({ success: true, data: await listUserResourceGroupIds(req.params.username) });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateUserResourceGroups = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const user = await getUserByUsername(req.params.username);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const before = await listUserResourceGroupIds(req.params.username);
    const groupIds = Array.isArray(req.body?.groupIds) ? req.body.groupIds : [];
    const data = await setUserResourceGroups(req.params.username, groupIds, getActorUsername(req));
    await recordAdminAuditFromRequest(req, {
      action: 'resource_group.assign_user',
      resourceType: 'user',
      resourceId: req.params.username,
      before: { groupIds: before },
      after: { groupIds: data },
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

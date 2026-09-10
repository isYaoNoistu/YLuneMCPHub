import { Request, Response } from 'express';
import { requireAdmin } from '../utils/requireAdmin.js';
import { recordAdminAuditFromRequest } from '../services/adminAuditService.js';
import { assertNoSecrets } from '../services/credentialService.js';
import {
  listCredentialContracts,
  listUserServerCredentials,
  saveUserServerCredentials,
  setServerCredentialBindings,
} from '../services/credentialBindingService.js';
import { getUserByUsername } from '../services/userService.js';
import { invalidateCredentialClients, probeServerWithCredential } from '../services/mcpService.js';

const sendPublic = (res: Response, status: number, body: Record<string, unknown>): void => {
  assertNoSecrets(body);
  res.status(status).json(body);
};

const handleError = (res: Response, error: unknown): void => {
  if (error instanceof Error && error.name === 'ResourceStoreUnavailableError') {
    sendPublic(res, 404, {
      success: false,
      message: 'api.errors.resource_store_unavailable',
    });
    return;
  }
  sendPublic(res, 400, {
    success: false,
    message: error instanceof Error ? error.message : 'Request failed',
  });
};

export const getCredentialContracts = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    sendPublic(res, 200, { success: true, data: await listCredentialContracts() });
  } catch (error) {
    handleError(res, error);
  }
};

export const putServerCredentials = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const name = decodeURIComponent(req.params.name || req.params.serverName || '');
    const ids = await setServerCredentialBindings(name, req.body?.credentialIds);
    invalidateCredentialClients({ serverName: name });
    await recordAdminAuditFromRequest(req, {
      action: 'server.bind_credentials',
      resourceType: 'server',
      resourceId: name,
      after: { credentialIds: ids },
    });
    sendPublic(res, 200, { success: true, data: { serverName: name, credentialIds: ids } });
  } catch (error) {
    handleError(res, error);
  }
};

export const testServerCredential = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const name = decodeURIComponent(req.params.name || req.params.serverName || '');
    const credentialId =
      typeof req.body?.credentialId === 'string' ? req.body.credentialId.trim() : '';
    if (!credentialId) {
      sendPublic(res, 400, { success: false, message: 'credentialId is required' });
      return;
    }
    const result = await probeServerWithCredential(name, credentialId);
    sendPublic(res, result.ok ? 200 : 400, {
      success: result.ok,
      data: { ok: result.ok, toolCount: result.toolCount },
      message: result.message,
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getUserServerCredentialsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const username = req.params.username;
    if (!username) {
      sendPublic(res, 400, { success: false, message: 'Username is required' });
      return;
    }
    sendPublic(res, 200, { success: true, data: await listUserServerCredentials(username) });
  } catch (error) {
    handleError(res, error);
  }
};

export const putUserServerCredentialsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const username = req.params.username;
    if (!username) {
      sendPublic(res, 400, { success: false, message: 'Username is required' });
      return;
    }
    const user = await getUserByUsername(username);
    if (!user) {
      sendPublic(res, 404, { success: false, message: 'User not found' });
      return;
    }
    const data = await saveUserServerCredentials(username, req.body, {
      grants: user.grants || [],
      isAdmin: Boolean(user.isAdmin),
    });
    await recordAdminAuditFromRequest(req, {
      action: 'user.update_server_credentials',
      resourceType: 'user',
      resourceId: username,
      after: { serverCredentials: data },
    });
    sendPublic(res, 200, { success: true, data });
  } catch (error) {
    handleError(res, error);
  }
};

import { Request, Response } from 'express';
import { requireAdmin } from '../utils/requireAdmin.js';
import { MasterKeyMissingError } from '../utils/secretBox.js';
import {
  assertNoSecrets,
  createCredential,
  deleteCredential,
  isCredentialStoreEnabled,
  listCredentials,
  replaceCredentialSecret,
  testCredential,
  toPublicCredential,
  updateCredential,
} from '../services/credentialService.js';
import { recordAdminAuditFromRequest } from '../services/adminAuditService.js';

const sendPublic = (res: Response, status: number, body: Record<string, unknown>): void => {
  assertNoSecrets(body);
  res.status(status).json(body);
};

const handleCredentialError = (res: Response, error: unknown): void => {
  if (error instanceof MasterKeyMissingError) {
    sendPublic(res, 503, {
      success: false,
      message: 'api.errors.master_key_missing',
    });
    return;
  }
  if (error instanceof Error && error.name === 'CredentialStoreUnavailableError') {
    sendPublic(res, 404, {
      success: false,
      message: 'api.errors.credential_store_unavailable',
    });
    return;
  }
  sendPublic(res, 400, {
    success: false,
    message: error instanceof Error ? error.message : 'Request failed',
  });
};

export const checkCredentialAvailable = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  sendPublic(res, 200, {
    success: true,
    data: {
      available: isCredentialStoreEnabled(),
    },
  });
};

export const getCredentials = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const data = await listCredentials();
    sendPublic(res, 200, { success: true, data });
  } catch (error) {
    handleCredentialError(res, error);
  }
};

export const createNewCredential = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const data = await createCredential(req.body || {});
    await recordAdminAuditFromRequest(req, {
      action: 'credential.create',
      resourceType: 'credential',
      resourceId: data.id,
      after: { name: data.name, type: data.type },
    });
    sendPublic(res, 201, { success: true, data });
  } catch (error) {
    handleCredentialError(res, error);
  }
};

export const updateExistingCredential = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const updated = await updateCredential(req.params.id, req.body || {});
    if (!updated) {
      sendPublic(res, 404, { success: false, message: 'Credential not found' });
      return;
    }
    sendPublic(res, 200, { success: true, data: updated });
  } catch (error) {
    handleCredentialError(res, error);
  }
};

export const replaceExistingCredentialSecret = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const updated = await replaceCredentialSecret(req.params.id, req.body || {});
    if (!updated) {
      sendPublic(res, 404, { success: false, message: 'Credential not found' });
      return;
    }
    await recordAdminAuditFromRequest(req, {
      action: 'credential.replace_secret',
      resourceType: 'credential',
      resourceId: updated.id,
      after: { name: updated.name, rotatedAt: updated.rotatedAt },
    });
    sendPublic(res, 200, { success: true, data: updated });
  } catch (error) {
    handleCredentialError(res, error);
  }
};

export const deleteExistingCredential = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const ok = await deleteCredential(req.params.id);
    if (!ok) {
      sendPublic(res, 404, { success: false, message: 'Credential not found' });
      return;
    }
    await recordAdminAuditFromRequest(req, {
      action: 'credential.delete',
      resourceType: 'credential',
      resourceId: req.params.id,
    });
    sendPublic(res, 200, { success: true });
  } catch (error) {
    handleCredentialError(res, error);
  }
};

export const testExistingCredential = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const result = await testCredential(req.params.id, req.body || {});
    sendPublic(res, result.ok ? 200 : 400, {
      success: result.ok,
      data: {
        ok: result.ok,
        kind: result.kind,
      },
      message: result.message,
    });
  } catch (error) {
    handleCredentialError(res, error);
  }
};

export { toPublicCredential };

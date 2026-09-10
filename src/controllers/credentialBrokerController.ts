import { Request, Response } from 'express';
import { requireAdmin } from '../utils/requireAdmin.js';
import { getResourceDao } from '../dao/DaoFactory.js';
import {
  hasRuntimeToken,
  isValidRuntimeToken,
  loadCredentialForLease,
  peekCredentialLease,
  resolveCredentialLease,
} from '../services/credentialBrokerService.js';
import { assertNoSecrets } from '../services/credentialService.js';

export const resolveInternalCredentialLease = async (
  req: Request,
  res: Response,
): Promise<void> => {
  if (!hasRuntimeToken()) {
    res.status(503).json({ success: false, message: 'api.errors.runtime_token_missing' });
    return;
  }
  if (!isValidRuntimeToken(req.headers.authorization)) {
    res.status(401).json({ success: false, message: 'Invalid runtime token' });
    return;
  }
  try {
    const lease = peekCredentialLease(req.params.id);
    if (!lease) {
      res.status(404).json({ success: false, message: 'Lease not found or expired' });
      return;
    }
    const dao = getResourceDao();
    const target = dao ? await dao.findTargetById(lease.targetId) : null;
    const credential = await loadCredentialForLease(lease.credentialId);
    const resolved = await resolveCredentialLease(lease.id, target, credential);
    res.json({ success: true, data: resolved });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to resolve lease',
    });
  }
};

export const getPublicCredentialLease = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  const lease = peekCredentialLease(req.params.id);
  if (!lease) {
    res.status(404).json({ success: false, message: 'Lease not found or expired' });
    return;
  }
  const body = {
    success: true,
    data: {
      id: lease.id,
      username: lease.username,
      serverName: lease.serverName,
      targetId: lease.targetId,
      targetName: lease.targetName,
      credentialId: lease.credentialId,
      credentialName: lease.credentialName,
      credentialVersion: lease.credentialVersion,
      resourceGroupId: lease.resourceGroupId,
      resourceGroupName: lease.resourceGroupName,
      expiresAt: new Date(lease.expiresAt).toISOString(),
      consumed: lease.consumed,
    },
  };
  assertNoSecrets(body);
  res.json(body);
};

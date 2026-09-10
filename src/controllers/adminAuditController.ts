import { Request, Response } from 'express';
import { requireAdmin } from '../utils/requireAdmin.js';
import { listAdminAudit } from '../services/adminAuditService.js';

export const getAdminAuditLogs = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const result = await listAdminAudit({
      page,
      limit,
      actor: typeof req.query.actor === 'string' ? req.query.actor : undefined,
      action: typeof req.query.action === 'string' ? req.query.action : undefined,
      resourceType:
        typeof req.query.resourceType === 'string' ? req.query.resourceType : undefined,
    });
    res.json({
      success: true,
      data: result.data,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / result.limit)),
      },
    });
  } catch (error) {
    const unavailable = error instanceof Error && error.name === 'AdminAuditUnavailableError';
    res.status(unavailable ? 404 : 500).json({
      success: false,
      message: unavailable
        ? 'Admin audit is only available in database mode'
        : 'Failed to load admin audit',
    });
  }
};

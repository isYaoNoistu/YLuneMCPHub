import { Request, Response } from 'express';
import { requireAdmin } from '../utils/requireAdmin.js';
import { getServersInfo } from '../services/mcpService.js';
import { acknowledgeToolChanges, listToolChanges } from '../services/toolChangeService.js';
import { getActorUsername } from '../utils/requestMeta.js';

export const getToolChanges = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const servers = await getServersInfo(undefined, undefined, (req as { user?: unknown }).user);
    res.json({ success: true, data: await listToolChanges(servers) });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to load tool changes',
    });
  }
};

export const ackToolChanges = async (req: Request, res: Response): Promise<void> => {
  if (!(await requireAdmin(req, res))) return;
  try {
    const servers = await getServersInfo(undefined, undefined, (req as { user?: unknown }).user);
    await acknowledgeToolChanges(servers, getActorUsername(req));
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to acknowledge tool changes',
    });
  }
};

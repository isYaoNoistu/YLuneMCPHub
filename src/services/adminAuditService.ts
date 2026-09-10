import { Request } from 'express';
import { getAdminAuditDao } from '../dao/DaoFactory.js';
import { IAdminAuditLog } from '../types/index.js';
import { sanitizeStringForLogging } from '../utils/serialization.js';
import { getActorUsername, getSourceIp } from '../utils/requestMeta.js';
import { logger } from '../utils/logger.js';

const SECRET_KEY_RE =
  /password|token|secret|authorization|encryptedpayload|encrypted_payload|apikey|api_key|clientsecret|private_key/i;

export const redactAuditValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return sanitizeStringForLogging(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditValue(item));
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SECRET_KEY_RE.test(key) ? '[redacted]' : redactAuditValue(item);
    }
    return result;
  }
  return value;
};

const toJson = (value: unknown): string | null => {
  if (value === undefined) {
    return null;
  }
  try {
    return JSON.stringify(redactAuditValue(value));
  } catch {
    return JSON.stringify({ _error: 'failed to serialize audit payload' });
  }
};

export const recordAdminAudit = async (input: {
  actor: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  before?: unknown;
  after?: unknown;
  sourceIp?: string;
}): Promise<void> => {
  let dao;
  try {
    dao = getAdminAuditDao();
  } catch (error) {
    logger.warn('Failed to resolve admin audit DAO', error);
    return;
  }
  if (!dao) {
    return;
  }
  try {
    await dao.create({
      actor: input.actor,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      beforeJson: toJson(input.before),
      afterJson: toJson(input.after),
      sourceIp: input.sourceIp,
    });
  } catch (error) {
    logger.warn('Failed to write admin audit log', error);
  }
};

export const recordAdminAuditFromRequest = async (
  req: Request,
  input: {
    action: string;
    resourceType: string;
    resourceId?: string | null;
    before?: unknown;
    after?: unknown;
  },
): Promise<void> => {
  try {
    await recordAdminAudit({
      ...input,
      actor: getActorUsername(req),
      sourceIp: getSourceIp(req),
    });
  } catch (error) {
    logger.warn('Failed to write admin audit log', error);
  }
};

export const listAdminAudit = async (input: {
  page?: number;
  limit?: number;
  actor?: string;
  action?: string;
  resourceType?: string;
}): Promise<{ data: IAdminAuditLog[]; total: number; page: number; limit: number }> => {
  const dao = getAdminAuditDao();
  if (!dao) {
    const error = new Error('Admin audit is only available in database mode');
    error.name = 'AdminAuditUnavailableError';
    throw error;
  }
  const page = Math.max(1, input.page || 1);
  const limit = Math.min(100, Math.max(1, input.limit || 20));
  const result = await dao.findPaginated(page, limit, {
    actor: input.actor,
    action: input.action,
    resourceType: input.resourceType,
  });
  return { ...result, page, limit };
};

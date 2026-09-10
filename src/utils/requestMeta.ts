import { Request } from 'express';

export const getActorUsername = (req: Request): string => {
  const user = (req as { user?: { username?: string } }).user;
  return user?.username || 'unknown';
};

export const getSourceIp = (req: Request): string | undefined => {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0]?.trim();
  }
  return req.ip || req.socket?.remoteAddress || undefined;
};

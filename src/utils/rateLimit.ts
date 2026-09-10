import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { loginRateLimitIdentity } from './loginGuard.js';

const isTestEnv =
  process.env.NODE_ENV === 'test' ||
  process.env.JEST_WORKER_ID !== undefined ||
  process.env.VITEST_WORKER_ID !== undefined;

const authLimitHandler = (req: { t?: (key: string) => string }, res: {
  status: (code: number) => { json: (body: unknown) => void };
}): void => {
  const t = req.t;
  res.status(429).json({
    success: false,
    error: 'rate_limited',
    message:
      typeof t === 'function'
        ? t('api.errors.too_many_login_attempts')
        : 'Too many login attempts. Try again later.',
  });
};

export const createStandardRateLimiter = (options: { windowMs: number; max: number }) =>
  rateLimit({
    ...options,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTestEnv,
  });

export const templateRateLimiter = createStandardRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 200,
});

export const authenticatedRouteRateLimiter = createStandardRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 600,
});

export const hostedInternalEventRateLimiter = createStandardRateLimiter({
  windowMs: 60 * 1000,
  max: 600,
});

export const mcpConnectionRateLimiter = createStandardRateLimiter({
  windowMs: 60 * 1000,
  max: 480,
});

export const authAttemptRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  handler: authLimitHandler,
});

export const authAccountRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTestEnv,
  keyGenerator: (req) =>
    `${ipKeyGenerator(req.ip || '0.0.0.0')}:${loginRateLimitIdentity(req.body?.username)}`,
  handler: authLimitHandler,
});

export const spaPageRateLimiter = createStandardRateLimiter({
  windowMs: 60 * 1000,
  max: 600,
});

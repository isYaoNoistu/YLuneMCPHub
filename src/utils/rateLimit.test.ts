import { describe, expect, it, jest } from '@jest/globals';

const rateLimitMock = jest.fn((options: unknown) => options);

jest.mock('express-rate-limit', () => ({
  __esModule: true,
  default: rateLimitMock,
}));

import {
  authAccountRateLimiter,
  authAttemptRateLimiter,
  authenticatedRouteRateLimiter,
  createStandardRateLimiter,
  mcpConnectionRateLimiter,
  templateRateLimiter,
} from './rateLimit.js';

describe('rateLimit configuration', () => {
  it('uses relaxed default limits across authenticated, template, and MCP routes', () => {
    expect(templateRateLimiter).toMatchObject({
      windowMs: 15 * 60 * 1000,
      max: 200,
      standardHeaders: true,
      legacyHeaders: false,
    });
    expect(authenticatedRouteRateLimiter).toMatchObject({
      windowMs: 15 * 60 * 1000,
      max: 600,
      standardHeaders: true,
      legacyHeaders: false,
    });
    expect(mcpConnectionRateLimiter).toMatchObject({
      windowMs: 60 * 1000,
      max: 480,
      standardHeaders: true,
      legacyHeaders: false,
    });
    expect(authAttemptRateLimiter).toMatchObject({
      windowMs: 15 * 60 * 1000,
      max: 10,
    });
    expect(authAccountRateLimiter).toMatchObject({
      windowMs: 15 * 60 * 1000,
      max: 5,
    });
    expect(typeof (authAccountRateLimiter as { keyGenerator?: unknown }).keyGenerator).toBe(
      'function',
    );
  });

  it('skips rate limiting automatically in test environments', () => {
    const limiter = createStandardRateLimiter({
      windowMs: 1000,
      max: 1,
    }) as { skip: () => boolean };

    expect(limiter.skip()).toBe(true);
  });
});

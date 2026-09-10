import {
  DUMMY_PASSWORD_HASH,
  LOGIN_PASSWORD_MAX,
  LOGIN_USERNAME_MAX,
  loginRateLimitIdentity,
  normalizeLoginUsername,
} from '../../src/utils/loginGuard.js';

describe('loginGuard', () => {
  it('trims usernames for lookup without changing case', () => {
    expect(normalizeLoginUsername('  Ops  ')).toBe('Ops');
  });

  it('collapses case for rate-limit identity', () => {
    expect(loginRateLimitIdentity('  Admin  ')).toBe('admin');
    expect(loginRateLimitIdentity(null)).toBe('');
  });

  it('keeps a dummy bcrypt hash for missing-user compares', () => {
    expect(DUMMY_PASSWORD_HASH.startsWith('$2b$')).toBe(true);
    expect(LOGIN_USERNAME_MAX).toBe(128);
    expect(LOGIN_PASSWORD_MAX).toBe(128);
  });
});

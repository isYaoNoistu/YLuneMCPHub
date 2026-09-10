import { isExpiredUser, isExpiringSoon, listExpiryAttention } from '../../frontend/src/utils/expiryCenter';
import { User } from '../../frontend/src/types';

const user = (overrides: Partial<User>): User => ({
  username: 'ops',
  isAdmin: false,
  ...overrides,
});

describe('expiryCenter', () => {
  it('treats admins and permanent tokens as not expired', () => {
    expect(isExpiredUser(user({ isAdmin: true, expired: true }))).toBe(false);
    expect(isExpiredUser(user({ tokenExpiresAt: null }))).toBe(false);
  });

  it('flags already-expired users', () => {
    expect(isExpiredUser(user({ expired: true, tokenExpiresAt: '2020-01-01T00:00:00.000Z' }))).toBe(
      true,
    );
  });

  it('flags users that expire within seven days', () => {
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const later = new Date(Date.now() + 30 * 86_400_000).toISOString();
    expect(isExpiringSoon(user({ tokenExpiresAt: soon }))).toBe(true);
    expect(isExpiringSoon(user({ tokenExpiresAt: later }))).toBe(false);
  });

  it('sorts expired users before those that expire later', () => {
    const expired = user({
      username: 'old',
      expired: true,
      tokenExpiresAt: '2020-01-01T00:00:00.000Z',
    });
    const soon = user({
      username: 'soon',
      tokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const ok = user({
      username: 'ok',
      tokenExpiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    });

    expect(listExpiryAttention([ok, soon, expired]).map((item) => item.username)).toEqual([
      'old',
      'soon',
    ]);
  });
});

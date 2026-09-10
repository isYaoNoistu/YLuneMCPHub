import {
  isCustomExpiryIncomplete,
  isUserTokenExpired,
  resolveTokenExpiresAt,
  serializeTokenExpiresAt,
} from '../../src/utils/userTokenExpiry.js';

describe('userTokenExpiry', () => {
  it('treats missing expiry as permanent', () => {
    expect(isUserTokenExpired({ tokenExpiresAt: null })).toBe(false);
    expect(isUserTokenExpired({})).toBe(false);
  });

  it('does not expire admin tokens', () => {
    expect(
      isUserTokenExpired({
        isAdmin: true,
        tokenExpiresAt: new Date(Date.now() - 60_000),
      }),
    ).toBe(false);
  });

  it('marks a past timestamp as expired', () => {
    expect(isUserTokenExpired({ tokenExpiresAt: new Date(Date.now() - 60_000) })).toBe(true);
  });

  it('resolves preset lifetimes from now', () => {
    const before = Date.now();
    const expires = resolveTokenExpiresAt({ tokenLifetime: '7d' });
    const after = Date.now();
    expect(expires).toBeInstanceOf(Date);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(expires!.getTime()).toBeGreaterThanOrEqual(before + sevenDays - 50);
    expect(expires!.getTime()).toBeLessThanOrEqual(after + sevenDays + 50);
  });

  it('resolves permanent and admin to null', () => {
    expect(resolveTokenExpiresAt({ tokenLifetime: 'permanent' })).toBeNull();
    expect(
      resolveTokenExpiresAt({
        isAdmin: true,
        tokenLifetime: '7d',
      }),
    ).toBeNull();
  });

  it('requires a date when lifetime is custom', () => {
    expect(isCustomExpiryIncomplete({ tokenLifetime: 'custom' })).toBe(true);
    expect(isCustomExpiryIncomplete({ tokenLifetime: 'custom', tokenExpiresAt: '' })).toBe(true);
    expect(
      isCustomExpiryIncomplete({
        tokenLifetime: 'custom',
        tokenExpiresAt: '2026-09-17T00:00:00.000Z',
      }),
    ).toBe(false);
    expect(isCustomExpiryIncomplete({ tokenLifetime: '7d' })).toBe(false);
  });

  it('serializes dates to ISO', () => {
    const date = new Date('2026-09-10T12:00:00.000Z');
    expect(serializeTokenExpiresAt(date)).toBe('2026-09-10T12:00:00.000Z');
    expect(serializeTokenExpiresAt(null)).toBeNull();
  });
});

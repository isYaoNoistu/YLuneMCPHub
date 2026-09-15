import { buildDashboardAttention } from '../../frontend/src/utils/dashboardAttention';
import type { Server, User } from '../../frontend/src/types';

const server = (name: string, status: Server['status'], enabled = true): Server =>
  ({ name, status, enabled }) as Server;

const user = (overrides: Partial<User>): User =>
  ({ username: 'user', isAdmin: false, grants: [{ name: 'demo' }], ...overrides }) as User;

describe('dashboard attention', () => {
  it('groups actionable issues and ignores intentionally disabled servers', () => {
    const result = buildDashboardAttention(
      [server('offline', 'disconnected'), server('disabled', 'disconnected', false)],
      [
        user({ username: 'empty', grants: [] }),
        user({ username: 'expired', tokenExpiresAt: '2020-01-01T00:00:00.000Z' }),
        user({ username: 'admin', isAdmin: true, grants: [] }),
      ],
    );

    expect(result.map((item) => ({ kind: item.kind, names: item.names }))).toEqual([
      { kind: 'disconnected', names: ['offline'] },
      { kind: 'empty_grants', names: ['empty'] },
      { kind: 'expired_users', names: ['expired'] },
    ]);
  });

  it('returns no panel items when the dashboard has nothing actionable', () => {
    expect(
      buildDashboardAttention(
        [server('online', 'connected'), server('disabled', 'disconnected', false)],
        [user({ username: 'healthy', tokenExpiresAt: null })],
      ),
    ).toEqual([]);
  });

  it('keeps expired and soon-expiring keys in separate messages', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    const result = buildDashboardAttention(
      [],
      [
        user({ username: 'expired', tokenExpiresAt: '2020-01-01T00:00:00.000Z' }),
        user({ username: 'soon', tokenExpiresAt: tomorrow }),
      ],
    );

    expect(result).toEqual([
      { kind: 'expired_users', names: ['expired'] },
      { kind: 'expiring_users', names: ['soon'] },
    ]);
  });
});

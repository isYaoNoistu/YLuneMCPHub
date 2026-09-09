import { AuthorizationService } from '../../src/services/authorizationService.js';
import { UserContextService } from '../../src/services/userContextService.js';
import { getEffectiveAccess } from '../../src/services/groupAccessService.js';

jest.mock('../../src/services/userContextService.js', () => ({
  UserContextService: {
    getInstance: jest.fn(() => ({
      getCurrentUser: mockGetCurrentUser,
      getEffectiveAccess: mockGetEffectiveAccess,
    })),
  },
}));

jest.mock('../../src/services/groupAccessService.js', () => ({
  getEffectiveAccess: jest.fn(),
  isServerGranted: jest.fn(
    (access: { unrestricted: boolean; serversByName: Map<string, unknown> }, name: string) =>
      access.unrestricted || access.serversByName.has(name),
  ),
}));

const mockGetCurrentUser = jest.fn();
const mockGetEffectiveAccess = jest.fn();

const admin = { username: 'admin', isAdmin: true };
const bob = { username: 'bob', isAdmin: false };
const alice = { username: 'alice', isAdmin: false };

describe('AuthorizationService (#1036 Phase 1)', () => {
  let service: AuthorizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockReturnValue(null);
    mockGetEffectiveAccess.mockReturnValue(null);
    service = new AuthorizationService();
  });

  describe('server.config.read', () => {
    const server = { owner: 'bob', visibility: 'public' as const };

    it('allows admins', () => {
      expect(service.can('server.config.read', server, admin)).toBe(true);
    });

    it('allows the owner', () => {
      expect(service.can('server.config.read', server, bob)).toBe(true);
    });

    it('denies a shared regular user even on a public server', () => {
      expect(service.can('server.config.read', server, alice)).toBe(false);
    });

    it('denies an unrelated user', () => {
      expect(service.can('server.config.read', server, alice)).toBe(false);
    });

    it('denies anonymous callers', () => {
      expect(service.can('server.config.read', server, null)).toBe(false);
    });
  });

  describe('server.manage', () => {
    it('mirrors config.read semantics (owner allow, shared user deny)', () => {
      const server = { owner: 'bob', visibility: 'group' as const, sharedWithUsers: ['alice'] };
      expect(service.can('server.manage', server, bob)).toBe(true);
      expect(service.can('server.manage', server, alice)).toBe(false);
      expect(service.can('server.manage', server, admin)).toBe(true);
    });

    it('normalizes a missing/blank owner to the admin account', () => {
      const orphan = { owner: '  ', visibility: 'private' as const };
      expect(service.can('server.manage', orphan, admin)).toBe(true);
      expect(service.can('server.manage', orphan, bob)).toBe(false);
      const legacy = { visibility: 'private' as const };
      expect(service.can('server.manage', legacy, admin)).toBe(true);
    });
  });

  describe('server.discover / server.invoke', () => {
    it('follows group membership rather than server visibility', async () => {
      const granted = {
        unrestricted: false,
        groups: [],
        serversByName: new Map([['jenkins', {}]]),
      };
      mockGetEffectiveAccess.mockReturnValue(granted);
      (getEffectiveAccess as jest.Mock).mockResolvedValue(granted);

      const server = { name: 'jenkins', owner: 'bob', visibility: 'private' as const };
      expect(service.can('server.discover', server, alice)).toBe(true);
      await expect(service.canInvoke(server, alice)).resolves.toBe(true);

      const other = { name: 'nightingale', owner: 'bob', visibility: 'public' as const };
      expect(service.can('server.invoke', other, alice)).toBe(false);
      await expect(service.canInvoke(other, alice)).resolves.toBe(false);
    });

    it('allows admins without membership', async () => {
      const server = { name: 'jenkins', owner: 'bob', visibility: 'private' as const };
      expect(service.can('server.invoke', server, admin)).toBe(true);
      await expect(service.canInvoke(server, admin)).resolves.toBe(true);
    });

    it('fails closed when membership has not been loaded', () => {
      mockGetEffectiveAccess.mockReturnValue(null);
      const server = { name: 'jenkins', owner: 'bob', visibility: 'public' as const };
      expect(service.can('server.invoke', server, alice)).toBe(false);
    });

    it('denies anonymous callers even for public servers', () => {
      const server = { owner: 'bob', visibility: 'public' as const };
      expect(service.can('server.invoke', server, null)).toBe(false);
    });

    it('an explicitly null principal stays anonymous even when the ambient context is admin', () => {
      // Regression: `??` used to coalesce explicit null into the ambient
      // UserContext, so an unauthenticated request could inherit an ambient
      // admin identity. null must mean anonymous, never fallback.
      mockGetCurrentUser.mockReturnValue(admin);
      const server = { owner: 'bob', visibility: 'public' as const };
      expect(service.can('server.config.read', server, null)).toBe(false);
      expect(service.can('server.invoke', server, null)).toBe(false);
    });
  });

  describe('principal resolution', () => {
    it('falls back to the ambient user context when no principal is passed', () => {
      mockGetCurrentUser.mockReturnValue(bob);
      expect(
        service.can('server.config.read', { owner: undefined, visibility: 'private' }),
      ).toBe(false);
      mockGetCurrentUser.mockReturnValue(admin);
      expect(
        service.can('server.config.read', { owner: undefined, visibility: 'private' }),
      ).toBe(true);
    });

    it('prefers an explicit principal over the ambient context', () => {
      mockGetCurrentUser.mockReturnValue(admin);
      expect(
        service.can('server.config.read', { owner: 'bob', visibility: 'public' }, alice),
      ).toBe(false);
    });
  });
});

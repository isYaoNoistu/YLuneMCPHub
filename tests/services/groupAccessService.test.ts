import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { IGroup } from '../../src/types/index.js';

const mockGroupDao = {
  findByMember: jest.fn(),
  findByName: jest.fn(),
  findById: jest.fn(),
};

const mockUserContextService = {
  getCurrentUser: jest.fn(),
  getEffectiveAccess: jest.fn(),
  setEffectiveAccess: jest.fn(),
};

jest.mock('../../src/dao/index.js', () => ({
  getGroupDao: jest.fn(() => mockGroupDao),
}));

jest.mock('../../src/services/userContextService.js', () => ({
  UserContextService: {
    getInstance: jest.fn(() => mockUserContextService),
  },
}));

import {
  getEffectiveAccess,
  isGroupMember,
  isGroupRouteAllowed,
  isUnrestrictedPrincipal,
  mergeGroupServerConfigs,
} from '../../src/services/groupAccessService.js';

const jenkinsAll: IGroup = {
  id: 'g1',
  name: 'jenkins-readonly',
  owner: 'admin',
  members: ['test'],
  servers: [{ name: 'jenkins', tools: ['health_check', 'list_jobs'], prompts: 'all', resources: 'all' }],
};

const extraTools: IGroup = {
  id: 'g2',
  name: 'jenkins-extra',
  owner: 'admin',
  members: ['test'],
  servers: [{ name: 'jenkins', tools: ['get_build_info'], prompts: 'all', resources: 'all' }],
};

describe('groupAccessService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserContextService.getCurrentUser.mockReturnValue(null);
    mockUserContextService.getEffectiveAccess.mockReturnValue(null);
  });

  it('treats listed usernames as members', () => {
    expect(isGroupMember(jenkinsAll, 'test')).toBe(true);
    expect(isGroupMember(jenkinsAll, 'alice')).toBe(false);
    expect(isGroupMember({ ...jenkinsAll, members: undefined }, 'test')).toBe(false);
  });

  it('merges tool lists across groups and promotes all', () => {
    const merged = mergeGroupServerConfigs([jenkinsAll, extraTools]);
    expect(merged.get('jenkins')?.tools).toEqual(
      expect.arrayContaining(['health_check', 'list_jobs', 'get_build_info']),
    );

    const withAll = mergeGroupServerConfigs([
      jenkinsAll,
      {
        ...extraTools,
        servers: [{ name: 'jenkins', tools: 'all', prompts: 'all', resources: 'all' }],
      },
    ]);
    expect(withAll.get('jenkins')?.tools).toBe('all');
  });

  it('treats admins as unrestricted even when they are not group members', async () => {
    expect(isUnrestrictedPrincipal({ username: 'admin', isAdmin: true })).toBe(true);
    expect(isUnrestrictedPrincipal({ username: 'test', isAdmin: false })).toBe(false);

    mockGroupDao.findByMember.mockResolvedValue([]);
    await expect(getEffectiveAccess({ username: 'admin', isAdmin: true })).resolves.toEqual(
      expect.objectContaining({ unrestricted: true }),
    );
    expect(mockGroupDao.findByMember).not.toHaveBeenCalled();
  });

  it('returns unrestricted access for admins and anonymous callers', async () => {
    await expect(getEffectiveAccess(null)).resolves.toEqual(
      expect.objectContaining({ unrestricted: true }),
    );
    await expect(getEffectiveAccess({ username: 'admin', isAdmin: true })).resolves.toEqual(
      expect.objectContaining({ unrestricted: true }),
    );
    expect(mockGroupDao.findByMember).not.toHaveBeenCalled();
  });

  it('builds the member union for a regular user', async () => {
    mockGroupDao.findByMember.mockResolvedValue([jenkinsAll, extraTools]);

    const access = await getEffectiveAccess({ username: 'test', isAdmin: false });
    expect(access.unrestricted).toBe(false);
    expect(access.groups).toHaveLength(2);
    expect(access.serversByName.has('jenkins')).toBe(true);
    expect(access.serversByName.get('jenkins')?.tools).toEqual(
      expect.arrayContaining(['health_check', 'list_jobs', 'get_build_info']),
    );
  });

  it('allows a member group route and denies a non-member group', async () => {
    mockGroupDao.findByMember.mockResolvedValue([jenkinsAll]);
    mockGroupDao.findByName.mockImplementation(async (name: string) =>
      name === 'jenkins-readonly'
        ? jenkinsAll
        : name === 'secret'
          ? { ...extraTools, name: 'secret', members: ['alice'] }
          : null,
    );
    mockGroupDao.findById.mockResolvedValue(null);

    const user = { username: 'test', isAdmin: false };
    await expect(isGroupRouteAllowed(user, 'jenkins-readonly')).resolves.toBe(true);
    await expect(isGroupRouteAllowed(user, 'secret')).resolves.toBe(false);
    await expect(isGroupRouteAllowed(user, 'jenkins')).resolves.toBe(true);
    await expect(isGroupRouteAllowed(user, 'nightingale')).resolves.toBe(false);
  });
});

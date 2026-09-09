import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGroupDao = {
  findByMember: jest.fn(),
};

const mockUserDao = {
  findAll: jest.fn(),
  update: jest.fn(),
};

jest.mock('../../src/dao/index.js', () => ({
  getGroupDao: jest.fn(() => mockGroupDao),
  getUserDao: jest.fn(() => mockUserDao),
}));

import { migrateUserGrantsFromGroups } from '../../src/services/userGrantMigration.js';

describe('migrateUserGrantsFromGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserDao.update.mockResolvedValue({ username: 'test' });
  });

  it('copies group membership into users that do not yet have grants', async () => {
    mockUserDao.findAll.mockResolvedValue([
      { username: 'admin', password: 'x', isAdmin: true },
      { username: 'test', password: 'x', isAdmin: false },
    ]);
    mockGroupDao.findByMember.mockResolvedValue([
      {
        id: 'g1',
        name: 'workbuddy',
        members: ['test'],
        servers: [{ name: 'jenkins', tools: ['list_jobs'], prompts: 'all', resources: 'all' }],
      },
    ]);

    await expect(migrateUserGrantsFromGroups()).resolves.toBe(1);
    expect(mockUserDao.update).toHaveBeenCalledWith(
      'test',
      expect.objectContaining({
        grants: [expect.objectContaining({ name: 'jenkins', tools: ['list_jobs'] })],
      }),
    );
    expect(mockGroupDao.findByMember).not.toHaveBeenCalledWith('admin');
  });

  it('does not overwrite an explicit empty grants list', async () => {
    mockUserDao.findAll.mockResolvedValue([
      { username: 'test', password: 'x', isAdmin: false, grants: [] },
    ]);

    await expect(migrateUserGrantsFromGroups()).resolves.toBe(0);
    expect(mockUserDao.update).not.toHaveBeenCalled();
    expect(mockGroupDao.findByMember).not.toHaveBeenCalled();
  });
});

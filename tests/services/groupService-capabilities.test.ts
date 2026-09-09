const mockGroupDao = {
  findByName: jest.fn(),
  create: jest.fn(),
};

const mockServerDao = {
  findAll: jest.fn(),
};

jest.mock('../../src/dao/index.js', () => ({
  getGroupDao: jest.fn(() => mockGroupDao),
  getServerDao: jest.fn(() => mockServerDao),
  getSystemConfigDao: jest.fn(() => ({
    get: jest.fn(() => Promise.resolve({ routing: { enableGroupNameRoute: true } })),
  })),
}));

jest.mock('../../src/services/mcpService.js', () => ({
  notifyToolChanged: jest.fn(),
}));

jest.mock('../../src/services/userContextService.js', () => ({
  UserContextService: {
    getInstance: jest.fn(() => ({
      isAdmin: () => true,
      getCurrentUser: () => ({ username: 'admin', isAdmin: true }),
    })),
  },
}));

import { createGroup } from '../../src/services/groupService.js';

describe('groupService capability selections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGroupDao.findByName.mockResolvedValue(null);
    mockServerDao.findAll.mockResolvedValue([{ name: 'server1' }, { name: 'server2' }]);
    mockGroupDao.create.mockImplementation(async (group: any) => group);
  });

  it('should preserve prompt and resource selections when creating groups', async () => {
    const result = await createGroup(
      'Team A',
      'Capability-scoped group',
      [
        {
          name: 'server1',
          alias: 'fetch',
          tools: ['search'],
          prompts: ['draft_prompt'],
          resources: ['resource://docs/guide'],
        },
      ],
      'admin',
    );

    expect(result?.servers).toEqual([
      {
        name: 'server1',
        alias: 'fetch',
        tools: ['search'],
        prompts: ['draft_prompt'],
        resources: ['resource://docs/guide'],
      },
    ]);
  });

  it('should preserve empty capability selections when creating groups', async () => {
    const result = await createGroup(
      'Team Empty',
      'No capabilities selected yet',
      [
        {
          name: 'server1',
          tools: [],
          prompts: [],
          resources: [],
        },
      ],
      'admin',
    );

    expect(result?.servers).toEqual([
      {
        name: 'server1',
        tools: [],
        prompts: [],
        resources: [],
      },
    ]);
  });

  it('persists group members when an admin creates a group', async () => {
    const result = await createGroup(
      'jenkins-readonly',
      'Read-only Jenkins tools',
      [{ name: 'server1', tools: ['search'], prompts: 'all', resources: 'all' }],
      'admin',
      ['test', ' test ', 'test', ''],
    );

    expect(result?.members).toEqual(['test']);
    expect(mockGroupDao.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'jenkins-readonly',
        members: ['test'],
      }),
    );
  });

  it('rejects duplicate exposed server names in a group', async () => {
    const result = await createGroup(
      'Duplicate aliases',
      'Ambiguous exposed names',
      [
        {
          name: 'server1',
          alias: 'fetch',
          tools: 'all',
          prompts: 'all',
          resources: 'all',
        },
        {
          name: 'server2',
          alias: 'fetch',
          tools: 'all',
          prompts: 'all',
          resources: 'all',
        },
      ],
      'admin',
    );

    expect(result).toBeNull();
    expect(mockGroupDao.create).not.toHaveBeenCalled();
  });
});

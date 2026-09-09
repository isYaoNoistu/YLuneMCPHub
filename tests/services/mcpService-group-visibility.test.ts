/**
 * Group membership now gates MCP server lists.
 * A non-admin only sees servers from groups they belong to, including
 * private servers in those groups. Visibility alone is not enough.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { IGroup, ServerInfo } from '../../src/types/index.js';

// ---------------------------------------------------------------------------
// Mocks (must be declared before any import that touches them)
// ---------------------------------------------------------------------------

const adminGroup: IGroup = {
  id: 'group-admin-1',
  name: 'GroupG',
  owner: 'admin',
  members: [],
  servers: [
    { name: 'ServerA', tools: 'all', prompts: 'all', resources: 'all' },
    { name: 'ServerB', tools: 'all', prompts: 'all', resources: 'all' },
  ],
};

const mockGroupDao = {
  findAll: jest.fn<() => Promise<IGroup[]>>().mockResolvedValue([adminGroup]),
  findById: jest.fn<(id: string) => Promise<IGroup | null>>().mockImplementation(async (id) =>
    id === adminGroup.id ? adminGroup : null,
  ),
  findByName: jest.fn<(name: string) => Promise<IGroup | null>>().mockImplementation(
    async (name) => (name === adminGroup.name ? adminGroup : null),
  ),
  findByOwner: jest.fn(),
  findByMember: jest.fn<() => Promise<IGroup[]>>().mockResolvedValue([]),
  findByServer: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
  addServerToGroup: jest.fn(),
  removeServerFromGroup: jest.fn(),
  updateServers: jest.fn(),
  updateServerName: jest.fn(),
};

const mockServerDao = {
  findAll: jest.fn(),
  findById: jest.fn(),
  findByName: jest.fn(),
  findByOwnerPaginated: jest.fn(),
  findVisibleToUserPaginated: jest.fn(),
  findAllPaginated: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
  count: jest.fn(),
  updateServerName: jest.fn(),
};

const mockUserContextService = {
  getCurrentUser: jest.fn<() => any>(),
  getEffectiveAccess: jest.fn<() => any>(() => null),
  setEffectiveAccess: jest.fn(),
  hasUser: jest.fn<() => boolean>(),
  isAdmin: jest.fn<() => boolean>(),
  setCurrentUser: jest.fn(),
  clearCurrentUser: jest.fn(),
  runWithContext: jest.fn(),
};

// Mutable state: updated per-test via beforeEach so clearAllMocks doesn't
// wipe the return value (mockReturnValue is reset by clearAllMocks in some
// Jest versions when set inside the factory).
let currentUserForFilter: any = null;

// Real DataService-like filter: non-admin sees own + public items.
// This is the same logic as DataService.filterData in src/services/dataService.ts.
const realFilterData = (data: any[], user?: any) => {
  const currentUser = user || currentUserForFilter;
  if (!currentUser || currentUser.isAdmin) {
    return data;
  }
  return data.filter((item) => {
    if (item.owner === currentUser.username) return true;
    if (item.visibility === 'public') return true;
    return false;
  });
};

jest.mock('../../src/dao/index.js', () => ({
  getGroupDao: jest.fn(() => mockGroupDao),
  getServerDao: jest.fn(() => mockServerDao),
  getSystemConfigDao: jest.fn(() => ({
    get: jest.fn(() =>
      Promise.resolve({ routing: { enableGlobalRoute: true, enableGroupNameRoute: true } }),
    ),
  })),
  getBuiltinPromptDao: jest.fn(() => ({ findAll: jest.fn().mockResolvedValue([]) })),
  getBuiltinResourceDao: jest.fn(() => ({ findAll: jest.fn().mockResolvedValue([]) })),
}));

jest.mock('../../src/services/services.js', () => ({
  getDataService: jest.fn(() => ({
    filterData: realFilterData,
  })),
}));

jest.mock('../../src/services/userContextService.js', () => ({
  UserContextService: {
    getInstance: jest.fn(() => mockUserContextService),
  },
}));

jest.mock('../../src/services/sseService.js', () => ({
  getGroup: jest.fn(),
}));

jest.mock('../../src/services/vectorSearchService.js', () => ({
  removeServerToolEmbeddings: jest.fn(),
  saveToolsAsVectorEmbeddings: jest.fn(),
}));

jest.mock('../../src/services/smartRoutingService.js', () => ({
  initSmartRoutingService: jest.fn(),
  getSmartRoutingTools: jest.fn(),
  handleSearchToolsRequest: jest.fn(),
  handleDescribeToolRequest: jest.fn(),
  isSmartRoutingGroup: jest.fn(() => false),
}));

jest.mock('../../src/services/oauthService.js', () => ({
  initializeAllOAuthClients: jest.fn(),
}));

jest.mock('../../src/services/mcpOAuthProvider.js', () => ({
  createOAuthProvider: jest.fn(),
}));

jest.mock('../../src/services/hostedAuthService.js', () => ({
  assertHostedToolAllowed: jest.fn(),
  filterHostedTools: jest.fn((_ctx: any, _name: string, tools: any[]) => tools),
  reserveHostedToolCall: jest.fn(),
  settleHostedToolCall: jest.fn(),
}));

jest.mock('../../src/services/requestContextService.js', () => ({
  RequestContextService: {
    getInstance: jest.fn(() => ({
      getHostedAuthContext: jest.fn(() => null),
      getBearerKeyContext: jest.fn(() => ({})),
      getGroupContext: jest.fn(),
      getUsernameContext: jest.fn(),
      getKeyKindContext: jest.fn(),
      getSessionId: jest.fn(),
      getRequestContext: jest.fn(() => ({})),
    })),
  },
}));

jest.mock('../../src/services/activityLoggingService.js', () => ({
  getActivityLoggingService: jest.fn(() => ({
    log: jest.fn(),
    logToolCall: jest.fn(),
  })),
}));

jest.mock('../../src/services/toolResultCompressionService.js', () => ({
  maybeCompressToolResult: jest.fn((r: any) => r),
}));

jest.mock('../../src/services/keepAliveService.js', () => ({
  setupClientKeepAlive: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/groupService.js', () => ({
  getServerConfigsInGroup: jest.fn(async (group: string) => {
    // Simulate the real behavior: go through getAllGroups → filterData.
    // For non-admin users, admin-owned groups are filtered out → empty result.
    const user = currentUserForFilter;
    if (!user || user.isAdmin) {
      // Admin sees the group
      const found = await mockGroupDao.findByName(group);
      if (!found) {
        const byId = await mockGroupDao.findById(group);
        if (!byId) return [];
        return (byId.servers as any[]) || [];
      }
      return (found.servers as any[]) || [];
    }
    // Non-admin: getAllGroups filters out admin-owned groups (the bug)
    const allGroups = await mockGroupDao.findAll();
    const visible = allGroups.filter(
      (g) => g.owner === user.username || (g as any).visibility === 'public',
    );
    const found = visible.find((g) => g.name === group || g.id === group);
    if (!found) return [];
    return (found.servers as any[]) || [];
  }),
  getServerConfigInGroup: jest.fn(async (group: string, serverName: string) => {
    const user = currentUserForFilter;
    if (!user || user.isAdmin) {
      const found = await mockGroupDao.findByName(group);
      if (!found) return undefined;
      return ((found.servers as any[]) || []).find((s: any) => s.name === serverName);
    }
    const allGroups = await mockGroupDao.findAll();
    const visible = allGroups.filter(
      (g) => g.owner === user.username || (g as any).visibility === 'public',
    );
    const found = visible.find((g) => g.name === group || g.id === group);
    if (!found) return undefined;
    return ((found.servers as any[]) || []).find((s: any) => s.name === serverName);
  }),
  getServersInGroup: jest.fn(async (group: string) => {
    const user = currentUserForFilter;
    if (!user || user.isAdmin) {
      const found = await mockGroupDao.findByName(group);
      if (!found) return [];
      return ((found.servers as any[]) || []).map((s: any) => s.name);
    }
    const allGroups = await mockGroupDao.findAll();
    const visible = allGroups.filter(
      (g) => g.owner === user.username || (g as any).visibility === 'public',
    );
    const found = visible.find((g) => g.name === group || g.id === group);
    if (!found) return [];
    return ((found.servers as any[]) || []).map((s: any) => s.name);
  }),
  normalizeGroupServers: jest.fn((servers: any[]) =>
    servers.map((s: any) =>
      typeof s === 'string'
        ? { name: s, tools: 'all', prompts: 'all', resources: 'all' }
        : { name: s.name, tools: s.tools || 'all', prompts: s.prompts || 'all', resources: s.resources || 'all' },
    ),
  ),
  notifyToolChanged: jest.fn(),
}));

jest.mock('../../src/services/proxy.js', () => ({
  normalizeHeaders: jest.fn((h: any) => h),
  createFetchWithProxy: jest.fn(),
  getProxyConfigFromEnv: jest.fn(),
}));

jest.mock('../../src/config/index.js', () => ({
  __esModule: true,
  default: { mcpHubName: 'test', mcpHubVersion: '1.0.0', basePath: '' },
  expandEnvVars: jest.fn((v: string) => v),
  replaceEnvVars: jest.fn((v: any) => v),
  getNameSeparator: jest.fn(() => '::'),
  loadSettings: jest.fn(),
  getSettingsPath: jest.fn(),
}));

jest.mock('../../src/utils/mcpApps.js', () => ({
  MCP_APPS_CAPABILITIES: {},
  filterModelVisibleTools: jest.fn((_: any, tools: any[]) => tools),
  hasMcpAppsCapability: jest.fn(() => false),
  isAppOnlyTool: jest.fn(() => false),
  stripMcpAppsMetadata: jest.fn((t: any) => t),
}));

jest.mock('../../src/clients/openapi.js', () => ({
  OpenAPIClient: jest.fn(),
}));

jest.mock('../../src/services/cloudService.js', () => ({
  getCloudService: jest.fn(() => ({ isEnabled: false })),
}));

jest.mock('../../src/services/changelogService.js', () => ({
  getChangelogService: jest.fn(() => ({ getChangelog: jest.fn() })),
}));

jest.mock('../../src/services/hostedMode.js', () => ({
  isHostedModeEnabled: jest.fn(() => false),
}));

jest.mock('../../src/services/hostedControlPlaneClient.js', () => ({
  getHostedControlPlaneClient: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  getFilteredServerInfosForGroup,
  handleCallToolRequest,
  handleListToolsRequest,
  setServerInfosForTest,
} from '../../src/services/mcpService.js';
import { getGroup } from '../../src/services/sseService.js';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const aliceUser = { username: 'alice', isAdmin: false, password: '' };

const serverInfosFixture: ServerInfo[] = [
  {
    name: 'ServerA',
    owner: 'admin',
    visibility: 'public',
    status: 'connected',
    error: null,
    tools: [
      {
        name: 'ServerA::doThing',
        description: 'Does a thing',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
    prompts: [],
    resources: [],
    createTime: Date.now(),
    enabled: true,
  },
  {
    name: 'ServerB',
    owner: 'admin',
    visibility: 'private',
    status: 'connected',
    error: null,
    tools: [
      {
        name: 'ServerB::privateThing',
        description: 'Private tool',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
    prompts: [],
    resources: [],
    createTime: Date.now(),
    enabled: true,
  },
  {
    name: 'ServerC',
    owner: 'alice',
    visibility: 'private',
    status: 'connected',
    error: null,
    tools: [
      {
        name: 'ServerC::aliceThing',
        description: 'Alice tool',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
    prompts: [],
    resources: [],
    createTime: Date.now(),
    enabled: true,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getFilteredServerInfosForGroup — issue #914', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setServerInfosForTest(serverInfosFixture);
    currentUserForFilter = aliceUser;

    // Re-establish DAO mock implementations (clearAllMocks resets them)
    mockGroupDao.findAll.mockResolvedValue([adminGroup]);
    mockGroupDao.findById.mockImplementation(async (id: string) =>
      id === adminGroup.id ? adminGroup : null,
    );
    mockGroupDao.findByName.mockImplementation(async (name: string) =>
      name === adminGroup.name ? adminGroup : null,
    );
    mockGroupDao.findByMember.mockResolvedValue([]);
    mockUserContextService.getCurrentUser.mockReturnValue(aliceUser);
    mockUserContextService.isAdmin.mockReturnValue(false);
    mockUserContextService.getEffectiveAccess.mockReturnValue(null);
    mockServerDao.findById.mockResolvedValue({ tools: {} });
    (getGroup as jest.Mock).mockReturnValue(undefined);
  });

  it('hides an admin-owned group from a non-member', async () => {
    const { filteredServerInfos } = await getFilteredServerInfosForGroup('GroupG');
    expect(filteredServerInfos).toEqual([]);
  });

  it('returns every server in a group the user belongs to, including private ones', async () => {
    const memberGroup = { ...adminGroup, members: ['alice'] };
    mockGroupDao.findByName.mockResolvedValue(memberGroup);
    mockGroupDao.findByMember.mockResolvedValue([memberGroup]);

    const { filteredServerInfos } = await getFilteredServerInfosForGroup('GroupG');
    const names = filteredServerInfos.map((s) => s.name);
    expect(names).toContain('ServerA');
    expect(names).toContain('ServerB');
    expect(names).not.toContain('ServerC');
  });

  it('returns empty array when the group does not exist', async () => {
    mockGroupDao.findByName.mockResolvedValue(null);
    mockGroupDao.findById.mockResolvedValue(null);

    const { filteredServerInfos } = await getFilteredServerInfosForGroup('NonExistentGroup');
    expect(filteredServerInfos).toEqual([]);
  });

  it('does not crash when a group has no servers field', async () => {
    // Older or corrupted configurations may lack the servers field entirely.
    mockGroupDao.findByName.mockResolvedValue({
      id: 'group-no-servers',
      name: 'NoServersGroup',
      owner: 'admin',
    } as IGroup);

    const { filteredServerInfos } = await getFilteredServerInfosForGroup('NoServersGroup');
    expect(filteredServerInfos).toEqual([]);
  });

  it('includes user-owned servers that are in a group the user belongs to', async () => {
    const groupWithAliceServer: IGroup = {
      ...adminGroup,
      members: ['alice'],
      servers: [
        { name: 'ServerA', tools: 'all', prompts: 'all', resources: 'all' },
        { name: 'ServerC', tools: 'all', prompts: 'all', resources: 'all' },
      ],
    };
    mockGroupDao.findByName.mockResolvedValue(groupWithAliceServer);
    mockGroupDao.findByMember.mockResolvedValue([groupWithAliceServer]);

    const { filteredServerInfos } = await getFilteredServerInfosForGroup('GroupG');

    const names = filteredServerInfos.map((s) => s.name);
    expect(names).toContain('ServerA');
    expect(names).toContain('ServerC');
  });

  it('returns all servers for admin users', async () => {
    const adminUser = {
      username: 'admin',
      isAdmin: true,
      password: '',
    };
    currentUserForFilter = adminUser;
    mockUserContextService.getCurrentUser.mockReturnValue(adminUser);
    mockUserContextService.isAdmin.mockReturnValue(true);

    const { filteredServerInfos } = await getFilteredServerInfosForGroup('GroupG');

    const names = filteredServerInfos.map((s) => s.name);
    expect(names).toContain('ServerA');
    expect(names).toContain('ServerB');
  });

  it('exposes the member union on the global route and nothing otherwise', async () => {
    const { filteredServerInfos: none } = await getFilteredServerInfosForGroup(undefined);
    expect(none.map((s) => s.name)).toEqual([]);

    const memberGroup = { ...adminGroup, members: ['alice'] };
    mockGroupDao.findByMember.mockResolvedValue([memberGroup]);
    mockUserContextService.getEffectiveAccess.mockReturnValue(null);

    const { filteredServerInfos } = await getFilteredServerInfosForGroup(undefined);
    const names = filteredServerInfos.map((s) => s.name);
    expect(names).toContain('ServerA');
    expect(names).toContain('ServerB');
    expect(names).not.toContain('ServerC');
  });

  it('lists the union of member-group tools on the global route', async () => {
    (getGroup as jest.Mock).mockReturnValue(undefined);
    const memberGroup = {
      ...adminGroup,
      members: ['alice'],
      servers: [{ name: 'ServerA', tools: ['doThing'], prompts: 'all', resources: 'all' }],
    };
    mockGroupDao.findByMember.mockResolvedValue([memberGroup]);
    mockServerDao.findById.mockResolvedValue({ tools: {} });

    const result = await handleListToolsRequest({}, { sessionId: 's1' });
    const toolNames = result.tools.map((tool: { name: string }) => tool.name);
    expect(toolNames).toContain('ServerA::doThing');
    expect(toolNames).not.toContain('ServerB::privateThing');
    expect(toolNames).not.toContain('ServerC::aliceThing');
  });

  it('rejects calling a public-server tool when the user is not a member of any group', async () => {
    (getGroup as jest.Mock).mockReturnValue(undefined);
    mockGroupDao.findByMember.mockResolvedValue([]);

    const result = await handleCallToolRequest(
      { params: { name: 'ServerA::doThing', arguments: {} } },
      { sessionId: 's1' },
    );
    expect(result.isError).toBe(true);
    expect(String(result.content?.[0]?.text || '')).toContain('Tool not available');
  });
});

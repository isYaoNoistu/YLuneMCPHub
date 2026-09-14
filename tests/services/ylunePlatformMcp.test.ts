const mockFindByUsername = jest.fn();
const mockGetUsage = jest.fn();

jest.mock('../../src/dao/index.js', () => ({
  getUserDao: () => ({
    findByUsername: mockFindByUsername,
  }),
  getActivityDao: () => ({
    getUsage: mockGetUsage,
  }),
}));

jest.mock('../../src/config/index.js', () => ({
  getNameSeparator: () => '-',
}));

import { UserContextService } from '../../src/services/userContextService.js';
import {
  YLUNE_PLATFORM_SERVER_NAME,
  canAccessYlunePlatform,
  canSeeYlunePlatformCard,
  callerCanUseYlunePlatform,
  executeYlunePlatformTool,
  matchYlunePlatformTool,
  presentYlunePlatformServer,
} from '../../src/services/ylunePlatformMcp.js';
import { validateServerName } from '../../src/utils/serverNameValidation.js';
import type { ServerInfo } from '../../src/types/index.js';

const sampleServers: ServerInfo[] = [
  {
    name: 'jenkins',
    status: 'connected',
    error: null,
    enabled: true,
    tools: [
      {
        name: 'jenkins-list_jobs',
        description: 'List Jenkins jobs',
        inputSchema: { type: 'object' },
        enabled: true,
      },
    ],
    prompts: [],
    resources: [],
    createTime: 1,
    config: { type: 'stdio', command: '/opt/mcp/jenkins', env: { JENKINS_API_TOKEN: 'secret' } },
  },
  presentYlunePlatformServer(),
];

describe('ylune reserved name', () => {
  it('rejects ylune in any case', () => {
    expect(validateServerName('ylune').valid).toBe(false);
    expect(validateServerName('YLUNE').valid).toBe(false);
    expect(validateServerName('Ylune').message).toContain('reserved');
  });

  it('still accepts nearby names', () => {
    expect(validateServerName('ylune-prod').valid).toBe(true);
    expect(validateServerName('jenkins').valid).toBe(true);
  });
});

describe('canAccessYlunePlatform', () => {
  it('allows an admin with MCP enabled', () => {
    expect(
      canAccessYlunePlatform({
        username: 'admin',
        password: '',
        isAdmin: true,
        mcpEnabled: true,
      }),
    ).toBe(true);
  });

  it('denies demo, regular users, system, and console-only admin', () => {
    expect(
      canAccessYlunePlatform({
        username: 'demo',
        password: '',
        isAdmin: true,
        demo: true,
        mcpEnabled: true,
      }),
    ).toBe(false);
    expect(
      canAccessYlunePlatform({
        username: 'alice',
        password: '',
        isAdmin: false,
        mcpEnabled: true,
      }),
    ).toBe(false);
    expect(canAccessYlunePlatform(null)).toBe(false);
    expect(
      canAccessYlunePlatform({
        username: 'admin',
        password: '',
        isAdmin: true,
        mcpEnabled: false,
      }),
    ).toBe(false);
  });
});

describe('canSeeYlunePlatformCard', () => {
  it('is only for admin or demo console users', () => {
    expect(canSeeYlunePlatformCard({ isAdmin: true })).toBe(true);
    expect(canSeeYlunePlatformCard({ demo: true })).toBe(true);
    expect(canSeeYlunePlatformCard({ isAdmin: false, demo: false })).toBe(false);
    expect(canSeeYlunePlatformCard(null)).toBe(false);
  });
});

describe('callerCanUseYlunePlatform', () => {
  afterEach(() => {
    UserContextService.getInstance().clearCurrentUser();
    mockFindByUsername.mockReset();
  });

  it('requires a persisted admin user, not a synthetic admin flag', async () => {
    UserContextService.getInstance().setCurrentUser({
      username: 'hosted-admin',
      password: '',
      isAdmin: true,
      mcpEnabled: true,
    });
    mockFindByUsername.mockResolvedValueOnce(null);

    expect(await callerCanUseYlunePlatform()).toBe(false);
  });

  it('allows a persisted admin with MCP enabled', async () => {
    UserContextService.getInstance().setCurrentUser({
      username: 'admin',
      password: '',
      isAdmin: true,
    });
    mockFindByUsername.mockResolvedValueOnce({
      username: 'admin',
      password: '',
      isAdmin: true,
      mcpEnabled: true,
    });

    expect(await callerCanUseYlunePlatform()).toBe(true);
  });
});

describe('matchYlunePlatformTool', () => {
  it('only matches qualified ylune tool names', () => {
    expect(matchYlunePlatformTool('ylune-list_servers')).toBe('list_servers');
    expect(matchYlunePlatformTool('ylune-list_tools')).toBe('list_tools');
    expect(matchYlunePlatformTool('list_servers')).toBeNull();
    expect(matchYlunePlatformTool('jenkins-list_servers')).toBeNull();
  });
});

describe('executeYlunePlatformTool', () => {
  it('lists servers without secrets or connection details', async () => {
    const result = (await executeYlunePlatformTool('list_servers', {}, { servers: sampleServers })) as {
      servers: Array<Record<string, unknown>>;
    };

    expect(result.servers).toEqual([
      {
        name: 'jenkins',
        status: 'connected',
        enabled: true,
        type: 'stdio',
        toolCount: 1,
        error: null,
      },
      {
        name: YLUNE_PLATFORM_SERVER_NAME,
        status: 'connected',
        enabled: true,
        type: 'builtin',
        toolCount: 4,
        error: null,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('/opt/mcp/jenkins');
    expect(JSON.stringify(result)).not.toContain('JENKINS_API_TOKEN');
  });

  it('lists tools with an optional server filter', async () => {
    const all = (await executeYlunePlatformTool('list_tools', {}, { servers: sampleServers })) as {
      tools: Array<{ name: string; server: string }>;
    };
    expect(all.tools.some((tool) => tool.name === 'list_jobs' && tool.server === 'jenkins')).toBe(
      true,
    );

    const filtered = (await executeYlunePlatformTool(
      'list_tools',
      { server: 'jenkins' },
      { servers: sampleServers },
    )) as { tools: Array<{ server: string }> };
    expect(filtered.tools.every((tool) => tool.server === 'jenkins')).toBe(true);
  });

  it('returns usage without activity payloads', async () => {
    mockGetUsage.mockResolvedValueOnce({
      since: new Date('2026-09-01T00:00:00.000Z'),
      days: [{ date: '2026-09-01', count: 3, errors: 1 }],
      tools: [{ name: 'jenkins-list_jobs', count: 3, errors: 1 }],
      users: [{ name: 'admin', count: 3, errors: 1 }],
      recentErrors: [
        {
          id: 'err-1',
          timestamp: new Date('2026-09-01T01:00:00.000Z'),
          tool: 'jenkins-list_jobs',
          username: 'admin',
          errorMessage: 'upstream timeout',
        },
      ],
    });

    const usage = (await executeYlunePlatformTool(
      'usage_summary',
      { days: 7, limit: 10 },
      { servers: sampleServers },
    )) as Record<string, unknown>;
    expect(usage.available).toBe(true);
    expect(usage.recentErrors).toBeUndefined();

    mockGetUsage.mockResolvedValueOnce({
      since: new Date('2026-09-01T00:00:00.000Z'),
      days: [],
      tools: [],
      users: [],
      recentErrors: [
        {
          id: 'err-1',
          timestamp: new Date('2026-09-01T01:00:00.000Z'),
          tool: 'jenkins-list_jobs',
          username: 'admin',
          errorMessage: 'upstream timeout',
        },
      ],
    });

    const failures = (await executeYlunePlatformTool(
      'recent_failures',
      { limit: 10 },
      { servers: sampleServers },
    )) as { failures: Array<Record<string, unknown>> };
    expect(failures.failures).toEqual([
      {
        timestamp: new Date('2026-09-01T01:00:00.000Z'),
        tool: 'jenkins-list_jobs',
        username: 'admin',
        errorMessage: 'upstream timeout',
      },
    ]);
    expect(failures.failures[0].id).toBeUndefined();
  });
});

import {
  createMcpToolDispatch,
  type McpToolDispatchDependencies,
} from '../../src/services/mcp/mcpToolDispatch.js';
import type { YlunePlatformToolName } from '../../src/services/ylunePlatformMcp.js';

const platformTools = new Set<YlunePlatformToolName>(['list_servers', 'usage_summary']);

const createDependencies = () => {
  const getServerByTool = jest.fn();
  const getVisibleServerInfos = jest.fn();
  const callToolWithReconnect = jest.fn();
  const executeYlunePlatformTool = jest.fn(async (tool: YlunePlatformToolName) => ({ tool }));
  const logToolCall = jest.fn(async () => undefined);

  const deps: McpToolDispatchDependencies = {
    access: {
      ensureEffectiveAccess: jest.fn(async () => undefined),
      authorizeToolResourceAccess: jest.fn(),
      ResourceBindingDeniedError: class extends Error {},
    },
    context: {
      getRequestContext: () => ({
        getBearerKeyContext: () => ({}),
        getSessionId: () => undefined,
        getGroupContext: () => undefined,
        getUsernameContext: () => undefined,
        getKeyKindContext: () => undefined,
        getRequestContext: () => null,
        getHeaders: () => null,
        getHostedAuthContext: () => undefined,
      }),
      getGroup: () => undefined,
    },
    registry: {
      getServerInfos: () => [],
      getVisibleServerByName: jest.fn(),
      getVisibleServerInfos,
      getServerByName: jest.fn(),
      getServerByTool,
      resolveToolViaAssignedCredential: jest.fn(),
      findToolOnServer: jest.fn(),
    },
    routing: {
      getMcpAppsRouteContext: jest.fn(async () => ({ enabled: false })),
      getGroupLookupName: () => undefined,
      resolveToolInGroup: jest.fn(),
      classifyUnavailableReason: jest.fn(),
      ToolUnavailableError: class extends Error {
        constructor(
          message: string,
          readonly reason: string,
        ) {
          super(message);
        }
      },
      assertToolAvailableForRoute: jest.fn(),
      normalizeToolNameForServer: jest.fn(),
      handleSearchToolsRequest: jest.fn(),
      handleDescribeToolRequest: jest.fn(),
    },
    clients: {
      getOrCreateCredentialClient: jest.fn(),
      getOrCreateIsolatedClient: jest.fn(),
      callToolWithReconnect,
      ensureServerReady: jest.fn(),
      scheduleIdleShutdown: jest.fn(),
    },
    credentials: {
      findUserServerCredential: jest.fn(),
    },
    hosted: {
      assertHostedToolAllowed: jest.fn(),
      reserveHostedToolCall: jest.fn(),
      settleHostedToolCall: jest.fn(async () => undefined),
    },
    ylune: {
      serverName: 'ylune',
      isYlunePlatformServerName: (name) => name === 'ylune',
      matchYlunePlatformTool: (name) => {
        if (typeof name !== 'string') return null;
        const candidate = name.startsWith('ylune-') ? name.slice('ylune-'.length) : name;
        return platformTools.has(candidate as YlunePlatformToolName)
          ? (candidate as YlunePlatformToolName)
          : null;
      },
      callerCanUseYlunePlatform: jest.fn(async () => true),
      executeYlunePlatformTool,
    },
    compression: {
      maybeCompressToolResult: jest.fn(async (result) => result),
    },
    logging: {
      log: jest.fn(),
      error: jest.fn(),
      getActivityLogger: () => ({ logToolCall }),
      summarizeToolRequestForLogging: jest.fn(),
      summarizeArgumentsForLogging: jest.fn(),
      summarizeToolResultForLogging: jest.fn(),
      summarizeErrorForLogging: jest.fn(() => ({})),
      formatErrorForLogging: jest.fn((error) => String(error)),
    },
    runtime: {
      now: () => 100,
      randomUUID: () => 'request-1',
      getNameSeparator: () => '-',
    },
  };

  return {
    dispatch: createMcpToolDispatch(deps),
    executeYlunePlatformTool,
    getServerByTool,
    getVisibleServerInfos,
    callToolWithReconnect,
  };
};

describe('mcpService ylune tool dispatch', () => {
  it.each([
    ['list_servers', 'list_servers'],
    ['usage_summary', 'usage_summary'],
    ['ylune-list_servers', 'list_servers'],
    ['ylune-usage_summary', 'usage_summary'],
  ] as const)('dispatches direct %s before client lookup', async (requestedName, expectedTool) => {
    const harness = createDependencies();

    await harness.dispatch({ params: { name: requestedName, arguments: {} } }, {});

    expect(harness.executeYlunePlatformTool).toHaveBeenCalledWith(
      expectedTool,
      {},
      { servers: [] },
    );
    expect(harness.getServerByTool).not.toHaveBeenCalled();
    expect(harness.getVisibleServerInfos).not.toHaveBeenCalled();
    expect(harness.callToolWithReconnect).not.toHaveBeenCalled();
  });

  it.each([
    ['list_servers', 'list_servers'],
    ['usage_summary', 'usage_summary'],
    ['ylune-list_servers', 'list_servers'],
    ['ylune-usage_summary', 'usage_summary'],
  ] as const)('dispatches wrapped %s before client lookup', async (requestedName, expectedTool) => {
    const harness = createDependencies();

    await harness.dispatch(
      {
        params: {
          name: 'call_tool',
          arguments: { toolName: requestedName, arguments: {} },
        },
      },
      {},
    );

    expect(harness.executeYlunePlatformTool).toHaveBeenCalledWith(
      expectedTool,
      {},
      { servers: [] },
    );
    expect(harness.getServerByTool).not.toHaveBeenCalled();
    expect(harness.getVisibleServerInfos).not.toHaveBeenCalled();
    expect(harness.callToolWithReconnect).not.toHaveBeenCalled();
  });
});

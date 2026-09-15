/// <reference types="jest" />

const mockServerConfig = {
  name: 'jenkins',
  type: 'stdio' as const,
  command: 'node',
  args: ['server.js'],
  env: {
    JENKINS_URL: '${JENKINS_URL}',
    JENKINS_USER: '${JENKINS_USER}',
    JENKINS_API_TOKEN: '${JENKINS_API_TOKEN}',
  },
  enabled: true,
};

const mockCredentialRows = new Map([
  [
    'cred-a',
    {
      id: 'cred-a',
      name: 'first',
      enabled: true,
      keyVersion: 1,
      fields: {
        JENKINS_URL: 'https://a.example.com',
        JENKINS_USER: 'reader-a',
        JENKINS_API_TOKEN: 'actual-token-a',
      },
    },
  ],
  [
    'cred-b',
    {
      id: 'cred-b',
      name: 'second',
      enabled: true,
      keyVersion: 1,
      fields: {
        JENKINS_URL: 'https://b.example.com',
        JENKINS_USER: 'reader-b',
        JENKINS_API_TOKEN: 'actual-token-b',
      },
    },
  ],
]);

const mockFindBindings = jest.fn(async () => [
  { serverName: 'jenkins', credentialId: 'cred-b' },
  { serverName: 'jenkins', credentialId: 'cred-a' },
]);
const mockFindCredentialById = jest.fn(async (id: string) => mockCredentialRows.get(id) || null);

jest.mock('../../src/dao/DaoFactory.js', () => ({
  getResourceDao: () => ({
    findServerCredentialBindings: mockFindBindings,
  }),
  getCredentialDao: () => ({
    findById: mockFindCredentialById,
  }),
  getServerDao: () => ({
    findAll: jest.fn(async () => [mockServerConfig]),
    findById: jest.fn(async () => mockServerConfig),
  }),
}));

const mockFindAllServers = jest.fn(async () => [mockServerConfig]);
const mockFindServerById = jest.fn(async () => mockServerConfig);
jest.mock('../../src/dao/index.js', () => ({
  getServerDao: () => ({
    findAll: mockFindAllServers,
    findById: mockFindServerById,
  }),
  getCredentialDao: () => ({
    findById: mockFindCredentialById,
  }),
  getSystemConfigDao: () => ({
    get: jest.fn(async () => ({})),
  }),
  getGroupDao: () => ({
    findByName: jest.fn(async () => undefined),
    findById: jest.fn(async () => undefined),
  }),
  getBuiltinPromptDao: () => ({
    findEnabled: jest.fn(async () => []),
    findByName: jest.fn(async () => undefined),
  }),
  getBuiltinResourceDao: () => ({
    findEnabled: jest.fn(async () => []),
  }),
  getUserDao: () => ({
    findByUsername: jest.fn(async () => ({ isAdmin: false })),
  }),
}));

jest.mock('../../src/services/credentialService.js', () => ({
  openCredentialFields: (credential: { fields: Record<string, string> }) => ({
    ...credential.fields,
  }),
}));

jest.mock('../../src/config/index.js', () => {
  const replace = (value: any, env: Record<string, string | undefined>): any => {
    if (typeof value === 'string') {
      return value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, key) => env[key] || '');
    }
    if (Array.isArray(value)) {
      return value.map((item) => replace(item, env));
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [key, replace(item, env)]),
      );
    }
    return value;
  };
  return {
    expandEnvVars: jest.fn((value: string, env = process.env) => replace(value, env)),
    replaceEnvVars: jest.fn((value: any, env = process.env) => replace(value, env)),
    getNameSeparator: jest.fn(() => '::'),
    default: {
      mcpHubName: 'test-hub',
      mcpHubVersion: '1.0.0',
      initTimeout: 60000,
    },
  };
});

type MockTransport = {
  options: { env: Record<string, string> };
  close: jest.Mock;
  stderr: { on: jest.Mock };
};
const mockStdioTransports: MockTransport[] = [];
let failNextStdioCreate = false;
jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn().mockImplementation((options) => {
    if (failNextStdioCreate) {
      failNextStdioCreate = false;
      throw new Error('ENOENT: missing spawn binary');
    }
    const transport = {
      options,
      close: jest.fn(),
      stderr: { on: jest.fn() },
    };
    mockStdioTransports.push(transport);
    return transport;
  }),
}));

jest.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: jest.fn().mockImplementation(() => ({
    close: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: jest.fn().mockImplementation(() => ({
    close: jest.fn(),
  })),
}));

jest.mock('../../src/utils/ssrf.js', () => ({
  UnsafeUrlError: class UnsafeUrlError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'UnsafeUrlError';
    }
  },
  assertSafeUrl: jest.fn(async (url: string) => url),
  createRedirectValidatingFetch: jest.fn((fetch) => fetch),
}));

const mockConnectAttempts: string[] = [];
const mockClientInstances: Array<Record<string, any>> = [];
let connectHold: Promise<void> | null = null;
let failAllCredentials = false;
let failListPrompts = false;
jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => {
    const client = {
      connect: jest.fn(async (transport: MockTransport) => {
        if (connectHold) {
          await connectHold;
        }
        const token = transport.options?.env?.JENKINS_API_TOKEN;
        const credentialId =
          token === 'actual-token-a'
            ? 'cred-a'
            : token === 'actual-token-b'
              ? 'cred-b'
              : 'base';
        mockConnectAttempts.push(credentialId);
        if (failAllCredentials || credentialId === 'cred-a') {
          throw new Error(`Credential rejected: ${token}`);
        }
        if (credentialId === 'base') {
          throw new Error('Missing Jenkins environment');
        }
      }),
      close: jest.fn(),
      getServerCapabilities: jest.fn(() => ({ tools: {}, prompts: {}, resources: {} })),
      getServerVersion: jest.fn(() => ({ version: '2.0.0' })),
      getInstructions: jest.fn(() => 'Jenkins operations'),
      listTools: jest.fn(async () => ({
        tools: [{ name: 'build', description: 'Build', inputSchema: { type: 'object' } }],
      })),
      listPrompts: jest.fn(async () => {
        if (failListPrompts) {
          throw new Error('prompts unavailable');
        }
        return {
          prompts: [{ name: 'diagnose', description: 'Diagnose a build' }],
        };
      }),
      listResources: jest.fn(async () => ({
        resources: [{ uri: 'jenkins://jobs', name: 'Jobs' }],
      })),
    };
    mockClientInstances.push(client);
    return client;
  }),
}));

jest.mock('../../src/services/oauthService.js', () => ({
  initializeAllOAuthClients: jest.fn(),
}));

jest.mock('../../src/services/oauthClientRegistration.js', () => ({
  registerOAuthClient: jest.fn(),
}));

jest.mock('../../src/services/mcpOAuthProvider.js', () => ({
  createOAuthProvider: jest.fn(async () => undefined),
}));

jest.mock('../../src/services/groupService.js', () => ({
  getServersInGroup: jest.fn(),
  getServerConfigInGroup: jest.fn(),
}));

jest.mock('../../src/services/sseService.js', () => ({
  getGroup: jest.fn(() => ''),
}));

jest.mock('../../src/services/vectorSearchService.js', () => ({
  removeServerToolEmbeddings: jest.fn(),
  saveToolsAsVectorEmbeddings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../src/services/services.js', () => ({
  getDataService: jest.fn(() => ({
    filterData: (data: any) => data,
  })),
}));

jest.mock('../../src/services/smartRoutingService.js', () => ({
  initSmartRoutingService: jest.fn(),
  getSmartRoutingTools: jest.fn(),
  handleSearchToolsRequest: jest.fn(),
  handleDescribeToolRequest: jest.fn(),
  isSmartRoutingGroup: jest.fn(() => false),
}));

const mockSetupKeepAlive = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/services/keepAliveService.js', () => ({
  setupClientKeepAlive: mockSetupKeepAlive,
}));

jest.mock('../../src/services/activityLoggingService.js', () => ({
  getActivityLoggingService: jest.fn(() => ({
    logToolCall: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../../src/services/proxy.js', () => ({
  createFetchWithProxy: jest.fn(() => jest.fn()),
  getProxyConfigFromEnv: jest.fn(() => undefined),
}));

import {
  closeServer,
  getServerByName,
  getServersInfo,
  initializeClientsFromSettings,
  invalidateCredentialClients,
  reconnectServer,
  setServerInfosForTest,
} from '../../src/services/mcpService.js';

const flushConnectionWork = async (): Promise<void> => {
  for (let index = 0; index < 10; index += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
};

const emitStderr = (transport: MockTransport | undefined, line: string): void => {
  const listener = transport?.stderr.on.mock.calls.find(([event]) => event === 'data')?.[1] as
    | ((chunk: Buffer) => void)
    | undefined;
  listener?.(Buffer.from(`${line}\n`));
};

const expectPersistentCredentialConnection = async (): Promise<void> => {
  const serverInfo = getServerByName('jenkins');
  expect(mockConnectAttempts).toEqual(['cred-a', 'cred-b']);
  expect(serverInfo).toMatchObject({
    status: 'connected',
    error: null,
    version: '2.0.0',
    instructions: 'Jenkins operations',
    discoveryCredentialId: 'cred-b',
    config: {
      env: expect.objectContaining({
        JENKINS_URL: '',
        JENKINS_USER: '',
        JENKINS_API_TOKEN: '',
      }),
    },
  });
  expect(JSON.stringify(serverInfo?.config)).not.toContain('actual-token-a');
  expect(JSON.stringify(serverInfo?.config)).not.toContain('actual-token-b');
  expect(serverInfo?.client).toBeDefined();
  expect(serverInfo?.transport).toBeDefined();
  expect((serverInfo?.client as any).close).not.toHaveBeenCalled();
  expect((serverInfo?.transport as any).close).not.toHaveBeenCalled();
  expect(serverInfo?.tools.map((tool) => tool.name)).toEqual(['jenkins::build']);
  expect(serverInfo?.prompts.map((prompt) => prompt.name)).toEqual(['jenkins::diagnose']);
  expect(serverInfo?.resources.map((resource) => resource.uri)).toEqual(['jenkins://jobs']);
  expect(mockSetupKeepAlive).toHaveBeenCalledWith(
    serverInfo,
    expect.objectContaining({
      env: expect.objectContaining({ JENKINS_API_TOKEN: '' }),
    }),
    expect.anything(),
  );
  expect(JSON.stringify(mockSetupKeepAlive.mock.calls.map((call) => call[1]))).not.toContain(
    'actual-token-b',
  );

  emitStderr(mockStdioTransports[0], 'authentication failed: actual-token-a');
  emitStderr(mockStdioTransports[1], 'connected with actual-token-b');

  const response = await getServersInfo();
  expect(JSON.stringify(response)).not.toContain('actual-token-a');
  expect(JSON.stringify(response)).not.toContain('actual-token-b');
};

describe('bound credential persistent stdio startup', () => {
  const envKeys = ['JENKINS_URL', 'JENKINS_USER', 'JENKINS_API_TOKEN'] as const;
  const originalEnv = new Map<string, string | undefined>();
  let consoleSpies: jest.SpiedFunction<typeof console.log>[];

  beforeAll(() => {
    for (const key of envKeys) {
      originalEnv.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterAll(() => {
    for (const key of envKeys) {
      const value = originalEnv.get(key);
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectAttempts.length = 0;
    mockClientInstances.length = 0;
    mockStdioTransports.length = 0;
    failNextStdioCreate = false;
    failAllCredentials = false;
    failListPrompts = false;
    connectHold = null;
    mockFindAllServers.mockResolvedValue([mockServerConfig]);
    mockFindServerById.mockResolvedValue(mockServerConfig);
    mockFindBindings.mockResolvedValue([
      { serverName: 'jenkins', credentialId: 'cred-b' },
      { serverName: 'jenkins', credentialId: 'cred-a' },
    ]);
    setServerInfosForTest([]);
    consoleSpies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'info').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
      jest.spyOn(console, 'debug').mockImplementation(() => undefined),
    ] as jest.SpiedFunction<typeof console.log>[];
  });

  afterEach(() => {
    const serializedLogs = JSON.stringify(consoleSpies.flatMap((spy) => spy.mock.calls));
    expect(serializedLogs).not.toContain('actual-token-a');
    expect(serializedLogs).not.toContain('actual-token-b');
    jest.restoreAllMocks();
  });

  it('tries enabled bindings in credential-id order and keeps the first successful client alive', async () => {
    await initializeClientsFromSettings(true);
    await flushConnectionWork();

    await expectPersistentCredentialConnection();
  });

  it('reuses the same persistent credential fallback during reconnect', async () => {
    await initializeClientsFromSettings(true);
    await flushConnectionWork();
    mockConnectAttempts.length = 0;
    mockSetupKeepAlive.mockClear();

    await reconnectServer('jenkins');
    await flushConnectionWork();

    await expectPersistentCredentialConnection();
  });

  it('keeps a working stdio connection when optional capability listing fails', async () => {
    failListPrompts = true;
    await initializeClientsFromSettings(true);
    await flushConnectionWork();

    const serverInfo = getServerByName('jenkins');
    expect(serverInfo?.status).toBe('connected');
    expect(serverInfo?.client).toBeDefined();
    expect((serverInfo?.client as any).close).not.toHaveBeenCalled();
    expect(serverInfo?.tools.map((tool) => tool.name)).toEqual(['jenkins::build']);
    expect(serverInfo?.prompts).toEqual([]);
  });

  it('surfaces the last sanitized error when every bound credential fails', async () => {
    failAllCredentials = true;
    await initializeClientsFromSettings(true);
    await flushConnectionWork();

    const serverInfo = getServerByName('jenkins');
    expect(serverInfo?.status).toBe('disconnected');
    expect(serverInfo?.error).toEqual(expect.stringContaining('Credential rejected'));
    expect(serverInfo?.error).toEqual(expect.stringContaining('[REDACTED]'));
    expect(serverInfo?.error).not.toContain('actual-token-a');
    expect(serverInfo?.error).not.toContain('actual-token-b');
  });

  it('still tries bound stdio credentials when creating the base transport fails', async () => {
    process.env.JENKINS_URL = 'https://env.example.com';
    process.env.JENKINS_USER = 'env-user';
    process.env.JENKINS_API_TOKEN = 'env-token';
    failNextStdioCreate = true;

    try {
      await initializeClientsFromSettings(true);
      await flushConnectionWork();
      expect(mockConnectAttempts).toEqual(['base', 'cred-a', 'cred-b']);
      expect(getServerByName('jenkins')?.status).toBe('connected');
      expect(getServerByName('jenkins')?.discoveryCredentialId).toBe('cred-b');
    } finally {
      delete process.env.JENKINS_URL;
      delete process.env.JENKINS_USER;
      delete process.env.JENKINS_API_TOKEN;
    }
  });

  it('does not use bound credentials for HTTP servers', async () => {
    const httpServer = {
      name: 'remote-http',
      type: 'streamable-http' as const,
      url: 'https://example.com/mcp',
      headers: { Authorization: 'Bearer ${JENKINS_API_TOKEN}' },
      enabled: true,
    };
    mockFindAllServers.mockResolvedValue([httpServer]);
    mockFindServerById.mockResolvedValue(httpServer);

    await initializeClientsFromSettings(true);
    await flushConnectionWork();

    expect(mockFindBindings).not.toHaveBeenCalled();
    expect(mockConnectAttempts).toEqual(['base']);
    expect(getServerByName('remote-http')?.status).toBe('disconnected');
  });

  it('closes an in-flight stdio attempt on reload and never assigns it later', async () => {
    let release: (() => void) | undefined;
    connectHold = new Promise<void>((resolve) => {
      release = resolve;
    });

    const initPromise = initializeClientsFromSettings(true);
    await flushConnectionWork();
    expect(mockStdioTransports.length).toBeGreaterThan(0);
    const firstTransport = mockStdioTransports[0];

    closeServer('jenkins');
    release?.();
    await initPromise;
    await flushConnectionWork();

    const serverInfo = getServerByName('jenkins');
    expect(firstTransport.close).toHaveBeenCalled();
    expect(serverInfo?.client).toBeUndefined();
    expect(mockSetupKeepAlive).not.toHaveBeenCalled();
  });

  it('rebuilds the persistent discovery connection when its credential is invalidated', async () => {
    await initializeClientsFromSettings(true);
    await flushConnectionWork();
    const firstClient = getServerByName('jenkins')?.client as { close: jest.Mock };
    expect(firstClient).toBeDefined();
    mockConnectAttempts.length = 0;

    invalidateCredentialClients({ credentialId: 'cred-b' });
    await flushConnectionWork();

    expect(firstClient.close).toHaveBeenCalled();
    expect(mockConnectAttempts).toEqual(['cred-a', 'cred-b']);
    expect(getServerByName('jenkins')?.status).toBe('connected');
    expect(getServerByName('jenkins')?.discoveryCredentialId).toBe('cred-b');
    expect(getServerByName('jenkins')?.client).not.toBe(firstClient);
  });
});

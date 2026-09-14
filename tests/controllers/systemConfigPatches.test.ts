import {
  hasSystemConfigUpdate,
  initializeSystemConfig,
  patchActivityLogConfig,
  patchAuthConfig,
  patchInstallConfig,
  patchMcpRouterConfig,
  patchOAuthServerConfig,
  patchRoutingConfig,
  patchSmartRoutingConfig,
  patchToolResultCompressionConfig,
} from '../../src/controllers/systemConfigPatches.js';

describe('systemConfigPatches', () => {
  it('initializes missing domains while preserving existing configuration', () => {
    const current = {
      routing: {
        enableGlobalRoute: false,
        bearerAuthKey: 'existing-secret',
      },
      nameSeparator: '::',
    };

    const result = initializeSystemConfig(current);

    expect(result.routing).toEqual(current.routing);
    expect(result.install).toEqual({
      pythonIndexUrl: '',
      npmRegistry: '',
      baseUrl: 'http://localhost:3000',
    });
    expect(result.smartRouting.embeddingProvider).toBe('openai');
    expect(result.oauthServer.dynamicRegistration).toBeDefined();
    expect(result.auth.betterAuth).toEqual({});
    expect(result.nameSeparator).toBe('::');
    expect(result).not.toBe(current);
  });

  it('detects only supported field-level updates', () => {
    expect(hasSystemConfigUpdate({ routing: { skipAuth: false } })).toBe(true);
    expect(hasSystemConfigUpdate({ smartRouting: { embeddingDimensions: null } })).toBe(true);
    expect(hasSystemConfigUpdate({ auth: { betterAuth: { providers: {} } } })).toBe(false);
    expect(hasSystemConfigUpdate({ routing: { skipAuth: 'false' } })).toBe(false);
    expect(hasSystemConfigUpdate({ unknown: true })).toBe(false);
  });

  it('patches routing and install with their existing trimming rules', () => {
    const config = initializeSystemConfig(undefined);

    const routing = patchRoutingConfig(config.routing, {
      bearerAuthHeaderName: ' X-MCP-Key ',
      jsonBodyLimit: ' 2mb ',
    });
    const install = patchInstallConfig(config.install, {
      pythonIndexUrl: ' https://pypi.example/simple ',
    });

    expect(routing).toEqual(
      expect.objectContaining({
        bearerAuthHeaderName: 'X-MCP-Key',
        jsonBodyLimit: '2mb',
        enableGlobalRoute: true,
      }),
    );
    expect(install.pythonIndexUrl).toBe(' https://pypi.example/simple ');
  });

  it('patches smart routing normalization, explicit clears, validation, and sync state', () => {
    const config = initializeSystemConfig({
      smartRouting: {
        enabled: true,
        dbUrl: 'postgres://localhost/test',
        embeddingProvider: 'openai',
        embeddingDimensions: 768,
        llmProviderBaseUrl: 'https://api.openai.com/v1',
        llmProviderApiKey: 'secret',
        embeddingModel: 'text-embedding-3-small',
        embeddingMaxTokens: 4000,
      },
    });

    const patched = patchSmartRoutingConfig(
      config.smartRouting,
      {
        embeddingProvider: ' OPENAI ',
        embeddingEncodingFormat: 'invalid',
        embeddingDimensions: null,
        llmProviderApiKey: ' new-secret ',
        embeddingMaxTokens: null,
      },
      '',
    );

    expect(patched.error).toBeUndefined();
    expect(patched.needsSync).toBe(true);
    expect(patched.config).toEqual(
      expect.objectContaining({
        embeddingProvider: 'openai',
        embeddingEncodingFormat: 'auto',
        embeddingDimensions: undefined,
        llmProviderApiKey: 'new-secret',
        embeddingMaxTokens: undefined,
      }),
    );

    const rejected = patchSmartRoutingConfig(
      initializeSystemConfig(undefined).smartRouting,
      { enabled: true },
      '',
    );
    expect(rejected.error).toBe(
      'Smart routing cannot be enabled without Database URL. Please provide DB URL.',
    );
  });

  it('patches compression and MCP router without changing field-specific semantics', () => {
    const config = initializeSystemConfig(undefined);

    const compression = patchToolResultCompressionConfig(config.toolResultCompression, {
      minTokens: 12.8,
      maxOutputTokens: 0,
      strategy: ' UNKNOWN ',
    });
    const mcpRouter = patchMcpRouterConfig(config.mcpRouter, {
      apiKey: '',
      title: ' Router ',
    });

    expect(compression).toEqual(
      expect.objectContaining({
        minTokens: 12,
        maxOutputTokens: 1200,
        strategy: 'auto',
      }),
    );
    expect(mcpRouter.apiKey).toBe('');
    expect(mcpRouter.title).toBe(' Router ');
  });

  it('patches OAuth server arrays and nested dynamic registration partially', () => {
    const config = initializeSystemConfig(undefined);

    const result = patchOAuthServerConfig(config.oauthServer, {
      allowedScopes: [' read ', '', 42],
      dynamicRegistration: {
        enabled: true,
        allowedGrantTypes: [' authorization_code ', null],
      },
    });

    expect(result.allowedScopes).toEqual(['read']);
    expect(result.dynamicRegistration).toEqual(
      expect.objectContaining({
        enabled: true,
        allowedGrantTypes: ['authorization_code'],
        requiresAuthentication: false,
      }),
    );
  });

  it('patches Better Auth providers while preserving secrets and clearing OIDC prompt', () => {
    const config = initializeSystemConfig({
      auth: {
        betterAuth: {
          baseUrl: 'https://old.example',
          providers: {
            google: { enabled: false, clientId: 'google-id', clientSecret: 'google-secret' },
            oidc: { enabled: true, prompt: 'login', clientSecret: 'oidc-secret' },
          },
        },
      },
    } as any);

    const result = patchAuthConfig(config.auth, {
      betterAuth: {
        trustedOrigins: [' https://new.example ', ' '],
        providers: {
          google: { enabled: true },
          oidc: { prompt: null },
        },
      },
    });

    expect(result.betterAuth).toEqual(
      expect.objectContaining({
        baseUrl: 'https://old.example',
        trustedOrigins: ['https://new.example'],
        providers: expect.objectContaining({
          google: expect.objectContaining({
            enabled: true,
            clientId: 'google-id',
            clientSecret: 'google-secret',
          }),
          oidc: expect.objectContaining({
            enabled: true,
            prompt: undefined,
            clientSecret: 'oidc-secret',
          }),
        }),
      }),
    );
  });

  it('patches activity logging without dropping adjacent fields', () => {
    expect(
      patchActivityLogConfig(
        { storeToolPayload: true, retentionDays: 30 } as any,
        { storeToolPayload: false },
      ),
    ).toEqual({
      storeToolPayload: false,
      retentionDays: 30,
    });
  });
});

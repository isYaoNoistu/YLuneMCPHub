import { cloneDefaultOAuthServerConfig } from '../constants/oauthServerDefaults.js';
import type { BetterAuthConfig, OAuthServerConfig, SystemConfig } from '../types/index.js';

type LooseConfig = Record<string, any>;
type RoutingConfig = NonNullable<SystemConfig['routing']>;
type InstallConfig = NonNullable<SystemConfig['install']>;
type SmartRoutingConfig = NonNullable<SystemConfig['smartRouting']>;
type ToolResultCompressionConfig = NonNullable<SystemConfig['toolResultCompression']>;
type McpRouterConfig = NonNullable<SystemConfig['mcpRouter']>;
type AuthConfig = {
  betterAuth: BetterAuthConfig;
};

export type InitializedSystemConfig = SystemConfig & {
  routing: RoutingConfig;
  install: InstallConfig;
  smartRouting: SmartRoutingConfig;
  toolResultCompression: ToolResultCompressionConfig;
  mcpRouter: McpRouterConfig;
  oauthServer: OAuthServerConfig;
  auth: AuthConfig;
};

const createDefaultRoutingConfig = (): RoutingConfig => ({
  enableGlobalRoute: true,
  enableGroupNameRoute: true,
  enableBearerAuth: true,
  bearerAuthKey: '',
  bearerAuthHeaderName: 'Authorization',
  jsonBodyLimit: '1mb',
  skipAuth: false,
});

const createDefaultInstallConfig = (): InstallConfig => ({
  pythonIndexUrl: '',
  npmRegistry: '',
  baseUrl: 'http://localhost:3000',
});

const createDefaultSmartRoutingConfig = (): SmartRoutingConfig => ({
  enabled: false,
  dbUrl: '',
  basePacingDelayMs: undefined,
  embeddingProvider: 'openai',
  embeddingDimensions: undefined,
  llmProviderBaseUrl: '',
  llmProviderApiKey: '',
  embeddingModel: '',
  azureOpenaiEndpoint: '',
  azureOpenaiApiKey: '',
  azureOpenaiApiVersion: '',
  azureOpenaiEmbeddingDeployment: '',
});

const createDefaultToolResultCompressionConfig = (): ToolResultCompressionConfig => ({
  enabled: false,
  minTokens: 2000,
  maxOutputTokens: 1200,
  strategy: 'auto',
});

const createDefaultMcpRouterConfig = (): McpRouterConfig => ({
  apiKey: '',
  referer: 'https://www.mcphub.app',
  title: 'MCPHub',
  baseUrl: 'https://api.mcprouter.to/v1',
});

export const initializeSystemConfig = (
  current: SystemConfig | null | undefined,
): InitializedSystemConfig => {
  const systemConfig: SystemConfig = current
    ? { ...current }
    : {
        routing: createDefaultRoutingConfig(),
        install: createDefaultInstallConfig(),
        smartRouting: createDefaultSmartRoutingConfig(),
        toolResultCompression: createDefaultToolResultCompressionConfig(),
        mcpRouter: createDefaultMcpRouterConfig(),
        oauthServer: cloneDefaultOAuthServerConfig(),
        auth: {
          betterAuth: {},
        },
      };

  const oauthServer = systemConfig.oauthServer
    ? { ...systemConfig.oauthServer }
    : cloneDefaultOAuthServerConfig();
  if (!oauthServer.dynamicRegistration) {
    const defaultConfig = cloneDefaultOAuthServerConfig();
    const defaultDynamic = defaultConfig.dynamicRegistration ?? {
      enabled: false,
      allowedGrantTypes: [],
      requiresAuthentication: false,
    };
    oauthServer.dynamicRegistration = {
      enabled: defaultDynamic.enabled ?? false,
      allowedGrantTypes: [
        ...(Array.isArray(defaultDynamic.allowedGrantTypes)
          ? defaultDynamic.allowedGrantTypes
          : []),
      ],
      requiresAuthentication: defaultDynamic.requiresAuthentication ?? false,
    };
  } else {
    oauthServer.dynamicRegistration = {
      ...oauthServer.dynamicRegistration,
      allowedGrantTypes: Array.isArray(oauthServer.dynamicRegistration.allowedGrantTypes)
        ? [...oauthServer.dynamicRegistration.allowedGrantTypes]
        : oauthServer.dynamicRegistration.allowedGrantTypes,
    };
  }

  const betterAuth = systemConfig.auth?.betterAuth
    ? { ...systemConfig.auth.betterAuth }
    : {};

  return {
    ...systemConfig,
    routing: systemConfig.routing ? { ...systemConfig.routing } : createDefaultRoutingConfig(),
    install: systemConfig.install ? { ...systemConfig.install } : createDefaultInstallConfig(),
    smartRouting: systemConfig.smartRouting
      ? { ...systemConfig.smartRouting }
      : createDefaultSmartRoutingConfig(),
    toolResultCompression: systemConfig.toolResultCompression
      ? { ...systemConfig.toolResultCompression }
      : createDefaultToolResultCompressionConfig(),
    mcpRouter: systemConfig.mcpRouter
      ? { ...systemConfig.mcpRouter }
      : createDefaultMcpRouterConfig(),
    oauthServer,
    auth: {
      ...(systemConfig.auth || {}),
      betterAuth,
    },
  };
};

const hasRoutingUpdate = (routing: LooseConfig | undefined): boolean =>
  Boolean(
    routing &&
      (typeof routing.enableGlobalRoute === 'boolean' ||
        typeof routing.enableGroupNameRoute === 'boolean' ||
        typeof routing.enableBearerAuth === 'boolean' ||
        typeof routing.bearerAuthKey === 'string' ||
        typeof routing.bearerAuthHeaderName === 'string' ||
        typeof routing.jsonBodyLimit === 'string' ||
        typeof routing.skipAuth === 'boolean'),
  );

const hasInstallUpdate = (install: LooseConfig | undefined): boolean =>
  Boolean(
    install &&
      (typeof install.pythonIndexUrl === 'string' ||
        typeof install.npmRegistry === 'string' ||
        typeof install.baseUrl === 'string'),
  );

const hasSmartRoutingUpdate = (smartRouting: LooseConfig | undefined): boolean =>
  Boolean(
    smartRouting &&
      (typeof smartRouting.enabled === 'boolean' ||
        typeof smartRouting.dbUrl === 'string' ||
        typeof smartRouting.basePacingDelayMs === 'number' ||
        smartRouting.basePacingDelayMs === null ||
        typeof smartRouting.embeddingProvider === 'string' ||
        typeof smartRouting.embeddingEncodingFormat === 'string' ||
        typeof smartRouting.embeddingDimensions === 'number' ||
        smartRouting.embeddingDimensions === null ||
        typeof smartRouting.embeddingDimensionsApiPassthrough === 'boolean' ||
        typeof smartRouting.llmProviderBaseUrl === 'string' ||
        typeof smartRouting.llmProviderApiKey === 'string' ||
        typeof smartRouting.embeddingModel === 'string' ||
        typeof smartRouting.azureOpenaiEndpoint === 'string' ||
        typeof smartRouting.azureOpenaiApiKey === 'string' ||
        typeof smartRouting.azureOpenaiApiVersion === 'string' ||
        typeof smartRouting.azureOpenaiEmbeddingDeployment === 'string' ||
        typeof smartRouting.progressiveDisclosure === 'boolean' ||
        typeof smartRouting.embeddingMaxTokens === 'number' ||
        smartRouting.embeddingMaxTokens === null),
  );

const hasToolResultCompressionUpdate = (
  toolResultCompression: LooseConfig | undefined,
): boolean =>
  Boolean(
    toolResultCompression &&
      (typeof toolResultCompression.enabled === 'boolean' ||
        typeof toolResultCompression.minTokens === 'number' ||
        typeof toolResultCompression.maxOutputTokens === 'number' ||
        typeof toolResultCompression.strategy === 'string'),
  );

const hasMcpRouterUpdate = (mcpRouter: LooseConfig | undefined): boolean =>
  Boolean(
    mcpRouter &&
      (typeof mcpRouter.apiKey === 'string' ||
        typeof mcpRouter.referer === 'string' ||
        typeof mcpRouter.title === 'string' ||
        typeof mcpRouter.baseUrl === 'string'),
  );

const hasOAuthServerUpdate = (oauthServer: LooseConfig | undefined): boolean =>
  Boolean(
    oauthServer &&
      (typeof oauthServer.enabled === 'boolean' ||
        typeof oauthServer.accessTokenLifetime === 'number' ||
        typeof oauthServer.refreshTokenLifetime === 'number' ||
        typeof oauthServer.authorizationCodeLifetime === 'number' ||
        typeof oauthServer.requireClientSecret === 'boolean' ||
        typeof oauthServer.requireState === 'boolean' ||
        Array.isArray(oauthServer.allowedScopes) ||
        (oauthServer.dynamicRegistration &&
          (typeof oauthServer.dynamicRegistration.enabled === 'boolean' ||
            typeof oauthServer.dynamicRegistration.requiresAuthentication === 'boolean' ||
            Array.isArray(oauthServer.dynamicRegistration.allowedGrantTypes)))),
  );

const hasAuthUpdate = (auth: LooseConfig | undefined): boolean =>
  Boolean(
    auth?.betterAuth &&
      (typeof auth.betterAuth.enabled === 'boolean' ||
        typeof auth.betterAuth.baseUrl === 'string' ||
        typeof auth.betterAuth.basePath === 'string' ||
        Array.isArray(auth.betterAuth.trustedOrigins) ||
        (auth.betterAuth.providers &&
          (typeof auth.betterAuth.providers.google?.enabled === 'boolean' ||
            typeof auth.betterAuth.providers.github?.enabled === 'boolean' ||
            (auth.betterAuth.providers.oidc &&
              (typeof auth.betterAuth.providers.oidc.enabled === 'boolean' ||
                typeof auth.betterAuth.providers.oidc.providerId === 'string' ||
                typeof auth.betterAuth.providers.oidc.discoveryUrl === 'string' ||
                Array.isArray(auth.betterAuth.providers.oidc.scopes) ||
                typeof auth.betterAuth.providers.oidc.pkce === 'boolean' ||
                typeof auth.betterAuth.providers.oidc.prompt === 'string' ||
                auth.betterAuth.providers.oidc.prompt === null))))),
  );

export const hasSystemConfigUpdate = (request: LooseConfig): boolean =>
  hasRoutingUpdate(request.routing) ||
  hasInstallUpdate(request.install) ||
  hasSmartRoutingUpdate(request.smartRouting) ||
  hasToolResultCompressionUpdate(request.toolResultCompression) ||
  hasMcpRouterUpdate(request.mcpRouter) ||
  typeof request.nameSeparator === 'string' ||
  typeof request.enableSessionRebuild === 'boolean' ||
  hasOAuthServerUpdate(request.oauthServer) ||
  hasAuthUpdate(request.auth) ||
  Boolean(request.activityLog && typeof request.activityLog.storeToolPayload === 'boolean');

export const patchRoutingConfig = (
  current: RoutingConfig,
  request: LooseConfig | undefined,
): RoutingConfig => {
  const target = { ...current };
  if (!request) {
    return target;
  }
  if (typeof request.enableGlobalRoute === 'boolean') {
    target.enableGlobalRoute = request.enableGlobalRoute;
  }
  if (typeof request.enableGroupNameRoute === 'boolean') {
    target.enableGroupNameRoute = request.enableGroupNameRoute;
  }
  if (typeof request.enableBearerAuth === 'boolean') {
    target.enableBearerAuth = request.enableBearerAuth;
  }
  if (typeof request.bearerAuthKey === 'string') {
    target.bearerAuthKey = request.bearerAuthKey;
  }
  if (typeof request.bearerAuthHeaderName === 'string') {
    target.bearerAuthHeaderName = request.bearerAuthHeaderName.trim();
  }
  if (typeof request.jsonBodyLimit === 'string') {
    target.jsonBodyLimit = request.jsonBodyLimit.trim();
  }
  if (typeof request.skipAuth === 'boolean') {
    target.skipAuth = request.skipAuth;
  }
  return target;
};

export const patchInstallConfig = (
  current: InstallConfig,
  request: LooseConfig | undefined,
): InstallConfig => {
  const target = { ...current };
  if (!request) {
    return target;
  }
  if (typeof request.pythonIndexUrl === 'string') {
    target.pythonIndexUrl = request.pythonIndexUrl;
  }
  if (typeof request.npmRegistry === 'string') {
    target.npmRegistry = request.npmRegistry;
  }
  if (typeof request.baseUrl === 'string') {
    target.baseUrl = request.baseUrl;
  }
  return target;
};

export type SmartRoutingPatchResult = {
  config: SmartRoutingConfig;
  needsSync: boolean;
  error?: string;
};

export const patchSmartRoutingConfig = (
  current: SmartRoutingConfig,
  request: LooseConfig | undefined,
  dbUrlEnv: string,
): SmartRoutingPatchResult => {
  const target = { ...current };
  const wasEnabled = current.enabled || false;
  const previous = { ...current };

  if (!request) {
    return { config: target, needsSync: false };
  }

  if (typeof request.embeddingProvider === 'string') {
    const normalized = request.embeddingProvider.trim().toLowerCase();
    target.embeddingProvider =
      normalized === 'azure' || normalized === 'azure_openai' ? 'azure_openai' : 'openai';
  }

  if (typeof request.embeddingEncodingFormat === 'string') {
    const normalized = request.embeddingEncodingFormat.trim().toLowerCase();
    target.embeddingEncodingFormat =
      normalized === 'base64' || normalized === 'float' ? normalized : 'auto';
  }

  if (
    typeof request.embeddingDimensions === 'number' &&
    Number.isSafeInteger(request.embeddingDimensions) &&
    request.embeddingDimensions > 0
  ) {
    target.embeddingDimensions = request.embeddingDimensions;
  } else if (request.embeddingDimensions === null) {
    target.embeddingDimensions = undefined;
  }

  if (typeof request.embeddingDimensionsApiPassthrough === 'boolean') {
    target.embeddingDimensionsApiPassthrough = request.embeddingDimensionsApiPassthrough;
  }

  if (typeof request.enabled === 'boolean') {
    if (request.enabled) {
      const currentDbUrl = dbUrlEnv || request.dbUrl || target.dbUrl;
      if (!currentDbUrl) {
        return {
          config: target,
          needsSync: false,
          error: 'Smart routing cannot be enabled without Database URL. Please provide DB URL.',
        };
      }

      const effectiveProvider =
        (typeof request.embeddingProvider === 'string'
          ? request.embeddingProvider
          : target.embeddingProvider) || 'openai';

      if (effectiveProvider === 'azure_openai') {
        const currentAzureEndpoint = request.azureOpenaiEndpoint || target.azureOpenaiEndpoint;
        const currentAzureKey = request.azureOpenaiApiKey || target.azureOpenaiApiKey;
        const currentAzureDeployment =
          request.azureOpenaiEmbeddingDeployment || target.azureOpenaiEmbeddingDeployment;
        const currentAzureApiVersion = request.azureOpenaiApiVersion || target.azureOpenaiApiVersion;

        if (
          !currentAzureEndpoint ||
          !currentAzureKey ||
          !currentAzureApiVersion ||
          !currentAzureDeployment
        ) {
          return {
            config: target,
            needsSync: false,
            error:
              'Smart routing cannot be enabled without Azure OpenAI configuration. Please provide endpoint, API key, embedding deployment, and API version.',
          };
        }
      } else {
        const currentLlmProviderApiKey =
          typeof request.llmProviderApiKey === 'string'
            ? request.llmProviderApiKey.trim()
            : (target.llmProviderApiKey || '').trim();
        const currentLlmProviderBaseUrl =
          typeof request.llmProviderBaseUrl === 'string'
            ? request.llmProviderBaseUrl.trim()
            : (target.llmProviderBaseUrl || '').trim();
        const currentEmbeddingModel =
          typeof request.embeddingModel === 'string'
            ? request.embeddingModel.trim()
            : (target.embeddingModel || '').trim();

        if (!currentLlmProviderApiKey || !currentLlmProviderBaseUrl || !currentEmbeddingModel) {
          return {
            config: target,
            needsSync: false,
            error:
              'Smart routing cannot be enabled without LLM provider configuration. Please provide API key, API base URL, and embedding model.',
          };
        }
      }
    }
    target.enabled = request.enabled;
  }

  if (typeof request.dbUrl === 'string') {
    target.dbUrl = request.dbUrl.trim();
  }
  if (
    typeof request.basePacingDelayMs === 'number' &&
    !isNaN(request.basePacingDelayMs) &&
    request.basePacingDelayMs >= 0
  ) {
    target.basePacingDelayMs = Math.floor(request.basePacingDelayMs);
  } else if (request.basePacingDelayMs === null) {
    target.basePacingDelayMs = undefined;
  }
  if (typeof request.llmProviderBaseUrl === 'string') {
    target.llmProviderBaseUrl = request.llmProviderBaseUrl.trim();
  }
  if (typeof request.llmProviderApiKey === 'string') {
    target.llmProviderApiKey = request.llmProviderApiKey.trim();
  }
  if (typeof request.embeddingModel === 'string') {
    target.embeddingModel = request.embeddingModel.trim();
  }
  if (typeof request.azureOpenaiEndpoint === 'string') {
    target.azureOpenaiEndpoint = request.azureOpenaiEndpoint.trim();
  }
  if (typeof request.azureOpenaiApiKey === 'string') {
    target.azureOpenaiApiKey = request.azureOpenaiApiKey.trim();
  }
  if (typeof request.azureOpenaiApiVersion === 'string') {
    target.azureOpenaiApiVersion = request.azureOpenaiApiVersion.trim();
  }
  if (typeof request.azureOpenaiEmbeddingDeployment === 'string') {
    target.azureOpenaiEmbeddingDeployment = request.azureOpenaiEmbeddingDeployment.trim();
  }
  if (typeof request.progressiveDisclosure === 'boolean') {
    target.progressiveDisclosure = request.progressiveDisclosure;
  }
  if (typeof request.embeddingMaxTokens === 'number' && !isNaN(request.embeddingMaxTokens)) {
    target.embeddingMaxTokens = request.embeddingMaxTokens;
  } else if (request.embeddingMaxTokens === null) {
    target.embeddingMaxTokens = undefined;
  }

  const isNowEnabled = target.enabled || false;
  const hasConfigChanged =
    previous.dbUrl !== target.dbUrl ||
    previous.embeddingProvider !== target.embeddingProvider ||
    previous.embeddingEncodingFormat !== target.embeddingEncodingFormat ||
    previous.embeddingDimensions !== target.embeddingDimensions ||
    previous.embeddingDimensionsApiPassthrough !== target.embeddingDimensionsApiPassthrough ||
    previous.llmProviderBaseUrl !== target.llmProviderBaseUrl ||
    previous.llmProviderApiKey !== target.llmProviderApiKey ||
    previous.embeddingModel !== target.embeddingModel ||
    previous.azureOpenaiEndpoint !== target.azureOpenaiEndpoint ||
    previous.azureOpenaiApiKey !== target.azureOpenaiApiKey ||
    previous.azureOpenaiApiVersion !== target.azureOpenaiApiVersion ||
    previous.azureOpenaiEmbeddingDeployment !== target.azureOpenaiEmbeddingDeployment ||
    previous.embeddingMaxTokens !== target.embeddingMaxTokens;

  return {
    config: target,
    needsSync: (!wasEnabled && isNowEnabled) || (isNowEnabled && hasConfigChanged),
  };
};

export const patchToolResultCompressionConfig = (
  current: ToolResultCompressionConfig,
  request: LooseConfig | undefined,
): ToolResultCompressionConfig => {
  const target = { ...current };
  if (!request) {
    return target;
  }
  if (typeof request.enabled === 'boolean') {
    target.enabled = request.enabled;
  }
  if (
    typeof request.minTokens === 'number' &&
    Number.isFinite(request.minTokens) &&
    request.minTokens > 0
  ) {
    target.minTokens = Math.floor(request.minTokens);
  }
  if (
    typeof request.maxOutputTokens === 'number' &&
    Number.isFinite(request.maxOutputTokens) &&
    request.maxOutputTokens > 0
  ) {
    target.maxOutputTokens = Math.floor(request.maxOutputTokens);
  }
  if (typeof request.strategy === 'string') {
    const normalized = request.strategy.trim().toLowerCase();
    target.strategy = ['auto', 'json', 'log', 'search', 'diff', 'text'].includes(normalized)
      ? (normalized as ToolResultCompressionConfig['strategy'])
      : 'auto';
  }
  return target;
};

export const patchMcpRouterConfig = (
  current: McpRouterConfig,
  request: LooseConfig | undefined,
): McpRouterConfig => {
  const target = { ...current };
  if (!request) {
    return target;
  }
  if (typeof request.apiKey === 'string') {
    target.apiKey = request.apiKey;
  }
  if (typeof request.referer === 'string') {
    target.referer = request.referer;
  }
  if (typeof request.title === 'string') {
    target.title = request.title;
  }
  if (typeof request.baseUrl === 'string') {
    target.baseUrl = request.baseUrl;
  }
  return target;
};

export const patchOAuthServerConfig = (
  current: OAuthServerConfig,
  request: LooseConfig | undefined,
): OAuthServerConfig => {
  const target = {
    ...current,
    dynamicRegistration: current.dynamicRegistration
      ? { ...current.dynamicRegistration }
      : current.dynamicRegistration,
  };
  if (!request) {
    return target;
  }
  if (typeof request.enabled === 'boolean') {
    target.enabled = request.enabled;
  }
  if (typeof request.accessTokenLifetime === 'number') {
    target.accessTokenLifetime = request.accessTokenLifetime;
  }
  if (typeof request.refreshTokenLifetime === 'number') {
    target.refreshTokenLifetime = request.refreshTokenLifetime;
  }
  if (typeof request.authorizationCodeLifetime === 'number') {
    target.authorizationCodeLifetime = request.authorizationCodeLifetime;
  }
  if (typeof request.requireClientSecret === 'boolean') {
    target.requireClientSecret = request.requireClientSecret;
  }
  if (typeof request.requireState === 'boolean') {
    target.requireState = request.requireState;
  }
  if (Array.isArray(request.allowedScopes)) {
    target.allowedScopes = request.allowedScopes
      .filter((scope: any): scope is string => typeof scope === 'string')
      .map((scope: string) => scope.trim())
      .filter((scope: string) => scope.length > 0);
  }

  if (request.dynamicRegistration) {
    const dynamicTarget = target.dynamicRegistration || {
      enabled: false,
      allowedGrantTypes: ['authorization_code', 'refresh_token'],
      requiresAuthentication: false,
    };
    if (typeof request.dynamicRegistration.enabled === 'boolean') {
      dynamicTarget.enabled = request.dynamicRegistration.enabled;
    }
    if (Array.isArray(request.dynamicRegistration.allowedGrantTypes)) {
      dynamicTarget.allowedGrantTypes = request.dynamicRegistration.allowedGrantTypes
        .filter((grant: any): grant is string => typeof grant === 'string')
        .map((grant: string) => grant.trim())
        .filter((grant: string) => grant.length > 0);
    }
    if (typeof request.dynamicRegistration.requiresAuthentication === 'boolean') {
      dynamicTarget.requiresAuthentication = request.dynamicRegistration.requiresAuthentication;
    }
    target.dynamicRegistration = dynamicTarget;
  }

  return target;
};

export const patchAuthConfig = (
  current: AuthConfig,
  request: LooseConfig | undefined,
): AuthConfig => {
  const target = {
    ...current,
    betterAuth: {
      ...current.betterAuth,
    },
  };
  if (!request?.betterAuth) {
    return target;
  }

  const betterAuthRequest = request.betterAuth;
  const betterAuthTarget = target.betterAuth;
  const providersTarget: LooseConfig = {
    ...(betterAuthTarget.providers || {}),
  };

  if (typeof betterAuthRequest.enabled === 'boolean') {
    betterAuthTarget.enabled = betterAuthRequest.enabled;
  }
  if (typeof betterAuthRequest.baseUrl === 'string') {
    betterAuthTarget.baseUrl = betterAuthRequest.baseUrl.trim();
  }
  if (typeof betterAuthRequest.basePath === 'string') {
    betterAuthTarget.basePath = betterAuthRequest.basePath.trim();
  }
  if (Array.isArray(betterAuthRequest.trustedOrigins)) {
    betterAuthTarget.trustedOrigins = betterAuthRequest.trustedOrigins
      .filter((origin: any): origin is string => typeof origin === 'string')
      .map((origin: string) => origin.trim())
      .filter((origin: string) => origin.length > 0);
  }

  if (betterAuthRequest.providers) {
    if (typeof betterAuthRequest.providers.google?.enabled === 'boolean') {
      providersTarget.google = {
        ...(providersTarget.google || {}),
        enabled: betterAuthRequest.providers.google.enabled,
      };
    }
    if (typeof betterAuthRequest.providers.github?.enabled === 'boolean') {
      providersTarget.github = {
        ...(providersTarget.github || {}),
        enabled: betterAuthRequest.providers.github.enabled,
      };
    }
    if (betterAuthRequest.providers.oidc) {
      const oidcTarget: LooseConfig = {
        ...(providersTarget.oidc || {}),
      };
      if (typeof betterAuthRequest.providers.oidc.enabled === 'boolean') {
        oidcTarget.enabled = betterAuthRequest.providers.oidc.enabled;
      }
      if (typeof betterAuthRequest.providers.oidc.providerId === 'string') {
        oidcTarget.providerId = betterAuthRequest.providers.oidc.providerId.trim();
      }
      if (typeof betterAuthRequest.providers.oidc.discoveryUrl === 'string') {
        oidcTarget.discoveryUrl = betterAuthRequest.providers.oidc.discoveryUrl.trim();
      }
      if (Array.isArray(betterAuthRequest.providers.oidc.scopes)) {
        oidcTarget.scopes = betterAuthRequest.providers.oidc.scopes
          .filter((scope: any): scope is string => typeof scope === 'string')
          .map((scope: string) => scope.trim())
          .filter((scope: string) => scope.length > 0);
      }
      if (typeof betterAuthRequest.providers.oidc.pkce === 'boolean') {
        oidcTarget.pkce = betterAuthRequest.providers.oidc.pkce;
      }
      if (typeof betterAuthRequest.providers.oidc.prompt === 'string') {
        const promptValue = betterAuthRequest.providers.oidc.prompt.trim();
        oidcTarget.prompt = promptValue || undefined;
      } else if (betterAuthRequest.providers.oidc.prompt === null) {
        oidcTarget.prompt = undefined;
      }
      providersTarget.oidc = oidcTarget;
    }
    betterAuthTarget.providers = providersTarget;
  }

  return target;
};

export const patchActivityLogConfig = (
  current: SystemConfig['activityLog'],
  request: LooseConfig | undefined,
): SystemConfig['activityLog'] => {
  if (!request || typeof request.storeToolPayload !== 'boolean') {
    return current ? { ...current } : current;
  }
  return {
    ...current,
    storeToolPayload: request.storeToolPayload,
  };
};

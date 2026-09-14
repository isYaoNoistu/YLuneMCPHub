import { isDeepStrictEqual } from 'node:util';
import { Request, Response } from 'express';
import {
  ApiResponse,
  AddServerRequest,
  McpSettings,
  BatchCreateServersRequest,
  BatchCreateServersResponse,
  BatchServerResult,
  ServerConfig,
  ServerInfo,
} from '../types/index.js';
import {
  getServersInfo,
  addServer,
  addOrUpdateServer,
  removeServer,
  closeServer,
  getServerByName,
  notifyToolChanged,
  broadcastToolListChanged,
  broadcastPromptListChanged,
  broadcastResourceListChanged,
  syncToolEmbedding,
  toggleServerStatus,
  reconnectServer,
  reinstallServer,
  updateServerInfoVisibility,
} from '../services/mcpService.js';
import { clearAllCaches } from '../utils/cacheUtils.js';
import {
  removeServerToolEmbeddings,
  syncAllServerToolsEmbeddings,
} from '../services/vectorSearchService.js';
import { createSafeJSON } from '../utils/serialization.js';
import {
  getBearerKeyDao,
  getGroupDao,
  getOAuthClientDao,
  getOAuthTokenDao,
  getServerDao,
  getSystemConfigDao,
  getUserConfigDao,
  getUserDao,
} from '../dao/DaoFactory.js';
import { migrateLegacySmartRoutingConfig } from '../dao/SystemConfigDao.js';
import { UserContextService } from '../services/userContextService.js';
import {
  authorizationService,
  isVisibilitySharedWith,
} from '../services/authorizationService.js';
import {
  presentServerForPrincipal,
  presentServerInfoForPrincipal,
} from '../services/serverConfigPresenter.js';
import { disconnectUpstreamOAuth } from '../services/upstreamOAuthDisconnectService.js';
import type { UpstreamOAuthDisconnectScope } from '../services/upstreamOAuthDisconnectService.js';
import { normalizeServerConfigForPersistence } from '../utils/serverConfigPersistence.js';
import { isPrivilegedServerConfig } from '../utils/serverConfigValidation.js';
import { validateServerName } from '../utils/serverNameValidation.js';
import { isYlunePlatformServerName } from '../constants/ylunePlatform.js';
import { setCachedSystemConfig } from '../utils/systemConfigCache.js';
import { DEFAULT_INSTALL_BASE_URL, withResolvedInstallBaseUrl } from '../utils/installBaseUrl.js';
import { previewOpenApiToolStats } from '../services/openApiToolStatsService.js';
import { logger } from '../utils/logger.js';
import { buildEnvPreflight } from '../utils/envPreflight.js';
import { recordAdminAuditFromRequest } from '../services/adminAuditService.js';
import { requireAdmin } from '../utils/requireAdmin.js';
import { createCapabilityHandlers } from './capabilityHandlers.js';
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
} from './systemConfigPatches.js';

type ServerRecord = ServerConfig & { name: string };

type RequestUser = {
  username: string;
  isAdmin?: boolean;
  demo?: boolean;
};

const getRequestUser = (req: Request): RequestUser | null => {
  return ((req as any).user as RequestUser | undefined) || null;
};

const canAccessServer = (user: RequestUser | null, server: ServerRecord): boolean => {
  if (!user) {
    return false;
  }

  if (user.isAdmin) {
    return true;
  }

  return server.owner === user.username;
};

const loadAuthorizedServer = async (
  req: Request,
  res: Response,
  serverName: string,
): Promise<ServerRecord | null> => {
  if (isYlunePlatformServerName(serverName)) {
    res.status(403).json({
      success: false,
      message: 'The built-in ylune platform MCP cannot be modified',
    });
    return null;
  }

  const serverDao = getServerDao();
  const server = await serverDao.findById(serverName);

  if (!server) {
    res.status(404).json({
      success: false,
      message: 'Server not found',
    });
    return null;
  }

  if (!canAccessServer(getRequestUser(req), server)) {
    res.status(403).json({
      success: false,
      message: 'Forbidden',
    });
    return null;
  }

  return server;
};

const ensureNonAdminCanManageConfig = (
  req: Request,
  res: Response,
  config: ServerConfig,
): boolean => {
  const currentUser = getRequestUser(req);
  if (currentUser?.isAdmin) {
    return true;
  }

  if (isPrivilegedServerConfig(config)) {
    res.status(403).json({
      success: false,
      message: 'Only admins can create or modify stdio-based servers',
    });
    return false;
  }

  return true;
};

const assignServerOwner = (req: Request, config: ServerConfig, existingOwner?: string): void => {
  const currentUser = getRequestUser(req);
  if (!currentUser) {
    return;
  }

  if (currentUser.isAdmin) {
    config.owner = config.owner || existingOwner || currentUser.username;
    return;
  }

  config.owner = currentUser.username;
};

const stripUndefinedDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .map(([key, nestedValue]) => [key, stripUndefinedDeep(nestedValue)]),
    );
  }

  return value;
};

// Fields baked into the live MCP client/transport at connect time. Editing any
// of these requires tearing down and re-establishing the runtime. Everything
// else in ServerConfig (description, owner, visibility, sharedWithUsers,
// `enabled`, and the tools/prompts/resources per-item overrides) is read-time
// or access metadata that can be applied without a reconnect.
const CONNECTION_RELEVANT_CONFIG_FIELDS = [
  'type',
  'url',
  'command',
  'args',
  'env',
  'headers',
  'passthroughHeaders',
  'options',
  'oauth',
  'openapi',
  'perSessionClient',
  'startOnDemand',
  'idleTimeoutMs',
  'enableKeepAlive',
  'keepAliveInterval',
  'proxy',
] as const;

type ConnectionRelevantServerConfig = Pick<
  ServerConfig,
  (typeof CONNECTION_RELEVANT_CONFIG_FIELDS)[number]
>;

const toConnectionRelevantConfig = (
  config: ServerConfig | ServerRecord,
): ConnectionRelevantServerConfig => {
  const normalized = normalizeServerConfigForPersistence(config) as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const field of CONNECTION_RELEVANT_CONFIG_FIELDS) {
    picked[field] = normalized[field];
  }
  const comparable = stripUndefinedDeep(picked) as Record<string, unknown>;
  // Treat the default request timeout (60000, the dashboard form default) as
  // equivalent to "not set": an explicit 60000 stored via API/file import and an
  // absent timeout resolve to the same effective connect timeout. Without this, a
  // stored explicit 60000 (or the dashboard echoing 60000 back) would look like a
  // connection change on unrelated edits and reload the runtime for nothing.
  const options = comparable.options as { timeout?: number } | undefined;
  if (options && options.timeout === 60000) {
    delete options.timeout;
    if (Object.keys(options).length === 0) {
      delete comparable.options;
    }
  }
  return comparable as ConnectionRelevantServerConfig;
};

// True when an edit touches at least one field the live connection depends on,
// i.e. the runtime must be torn down and reconnected.
const hasConnectionRelevantChange = (
  existingServer: ServerRecord,
  nextConfig: ServerConfig,
): boolean =>
  !isDeepStrictEqual(
    toConnectionRelevantConfig(existingServer),
    toConnectionRelevantConfig(nextConfig),
  );

export const getAllServers = async (req: Request, res: Response): Promise<void> => {
  try {
    // Parse pagination parameters from query string
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    // Validate pagination parameters
    if (page < 1) {
      res.status(400).json({
        success: false,
        message: 'Page number must be greater than 0',
      });
      return;
    }

    if (limit !== undefined && (limit < 1 || limit > 1000)) {
      res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 1000',
      });
      return;
    }

    // Get current user for filtering
    const currentUser = UserContextService.getInstance().getCurrentUser();
    const isAdmin = !currentUser || currentUser.isAdmin;
    const canListAllServers = isAdmin || Boolean(currentUser?.demo);

    // Get servers info with pagination if limit is specified
    let serversInfo: Omit<ServerInfo, 'client' | 'transport'>[];
    let allServers: Omit<ServerInfo, 'client' | 'transport'>[] | undefined;
    let pagination = undefined;

    if (limit !== undefined) {
      // Use DAO layer pagination with proper filtering
      const serverDao = getServerDao();
      const paginatedResult = canListAllServers
        ? await serverDao.findAllPaginated(page, limit)
        : await serverDao.findVisibleToUserPaginated(currentUser!.username, page, limit);

      // Get runtime info for paginated servers
      serversInfo = await getServersInfo(page, limit, currentUser);
      allServers = await getServersInfo(undefined, undefined, currentUser);

      pagination = {
        page: paginatedResult.page,
        limit: paginatedResult.limit,
        total: paginatedResult.total,
        totalPages: paginatedResult.totalPages,
        hasNextPage: paginatedResult.page < paginatedResult.totalPages,
        hasPrevPage: paginatedResult.page > 1,
      };
    } else {
      // No pagination, get all servers (will be filtered by mcpService)
      serversInfo = await getServersInfo();
    }

    // #1036 Phase 1: withhold OAuth session-recovery fields from principals
    // who may not read the full server configuration (defense in depth; the
    // config block on list entries is already narrowed to safe metadata).
    const presentedServersInfo = serversInfo.map((info) =>
      presentServerInfoForPrincipal(info, currentUser),
    );
    const presentedAllServers = allServers?.map((info) =>
      presentServerInfoForPrincipal(info, currentUser),
    );

    const response: ApiResponse & {
      pagination?: typeof pagination;
      allServers?: Omit<ServerInfo, 'client' | 'transport'>[];
    } = {
      success: true,
      data: createSafeJSON(presentedServersInfo),
      ...(presentedAllServers && { allServers: createSafeJSON(presentedAllServers) }),
      ...(pagination && { pagination }),
    };
    res.json(response);
  } catch (error) {
    logger.error('Failed to get servers information:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get servers information',
    });
  }
};

export const getServerShareCandidates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const server = await loadAuthorizedServer(req, res, name);
    if (!server) {
      return;
    }

    const users = await getUserDao().findAll();
    // Treat a missing/empty owner as 'admin' so the candidate list is
    // consistent before and after the first edit (which assigns the owner).
    const effectiveOwner = server.owner?.trim() || 'admin';
    const usernames = users
      .map((user) => user.username)
      .filter((username) => username !== effectiveOwner)
      .sort((left, right) => left.localeCompare(right));

    res.json({ success: true, data: usernames });
  } catch (error) {
    logger.error('Failed to get server share candidates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get server share candidates',
    });
  }
};

export const getAllSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const [
      servers,
      users,
      groups,
      systemConfigResult,
      userConfigs,
      oauthClients,
      oauthTokens,
      bearerKeys,
    ] = await Promise.all([
      getServerDao().findAll(),
      getUserDao().findAll(),
      getGroupDao().findAll(),
      getSystemConfigDao().get(),
      getUserConfigDao().getAll(),
      getOAuthClientDao().findAll(),
      getOAuthTokenDao().findAll(),
      getBearerKeyDao().findAll(),
    ]);

    // Convert servers array to mcpServers map format
    const mcpServers: McpSettings['mcpServers'] = {};
    for (const server of servers) {
      const { name, ...config } = server;
      mcpServers[name] = config;
    }

    const systemConfig = systemConfigResult || {};

    // Ensure smart routing config has DB URL set if environment variable is present
    const dbUrlEnv = process.env.DB_URL || '';
    if (!systemConfig.smartRouting) {
      systemConfig.smartRouting = {
        enabled: false,
        dbUrl: dbUrlEnv ? '${DB_URL}' : '',
        llmProviderBaseUrl: '',
        llmProviderApiKey: '',
        embeddingModel: '',
      };
    } else if (!systemConfig.smartRouting.dbUrl) {
      systemConfig.smartRouting.dbUrl = dbUrlEnv ? '${DB_URL}' : '';
    }

    if (!systemConfig.toolResultCompression) {
      systemConfig.toolResultCompression = {
        enabled: false,
        minTokens: 2000,
        maxOutputTokens: 1200,
        strategy: 'auto',
      };
    }

    const systemConfigForResponse = withResolvedInstallBaseUrl(
      systemConfig,
      DEFAULT_INSTALL_BASE_URL,
    );

    const settings: McpSettings = {
      users,
      mcpServers,
      groups,
      systemConfig: systemConfigForResponse,
      userConfigs,
      oauthClients,
      oauthTokens,
      bearerKeys: bearerKeys.map((key) => ({
        ...key,
        kind: key.kind ?? 'system',
        token:
          key.token.length > 12 ? `${key.token.slice(0, 8)}...${key.token.slice(-4)}` : '********',
      })),
    };

    const response: ApiResponse = {
      success: true,
      data: createSafeJSON(
        (req as any).user?.isAdmin
          ? settings
          : {
              mcpServers: {},
              systemConfig: {
                install: {
                  baseUrl: systemConfigForResponse.install?.baseUrl,
                },
              },
              bearerKeys: getRequestUser(req)?.demo
                ? []
                : settings.bearerKeys?.filter(
                    (key) => key.kind === 'user' && key.owner === getRequestUser(req)?.username,
                  ),
            },
      ),
    };
    res.json(response);
  } catch (error) {
    logger.error('Failed to get server settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get server settings',
    });
  }
};

/**
 * Preview the tool list an OpenAPI import would generate, without persisting
 * anything (#1082). Large specs can silently produce a tools/list that does
 * not fit in a model's context window; this endpoint lets the form surface
 * the numbers at the point of confirming the import.
 */
export const previewOpenApiToolStatsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { config } = req.body as AddServerRequest;
    if (!config || typeof config !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Server configuration is required',
      });
      return;
    }

    const normalizedConfig = normalizeServerConfigForPersistence(config);

    if (!normalizedConfig.openapi?.url && !normalizedConfig.openapi?.schema) {
      res.status(400).json({
        success: false,
        message: 'OpenAPI specification URL or schema is required',
      });
      return;
    }

    // Assign the requesting user as owner so initialize()'s admin check (and
    // therefore the internal-network SSRF allowance) matches what a real
    // add-server request would produce for the same caller.
    assignServerOwner(req, normalizedConfig);

    const stats = await previewOpenApiToolStats(normalizedConfig);
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.warn('Failed to preview OpenAPI tool stats:', error);
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to analyze OpenAPI specification',
    });
  }
};

export const createServer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, config } = req.body as AddServerRequest;
    const nameValidation = validateServerName(name);
    if (!nameValidation.valid) {
      res.status(400).json({
        success: false,
        message: nameValidation.message,
      });
      return;
    }
    const serverName = nameValidation.normalized as string;

    if (!config || typeof config !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Server configuration is required',
      });
      return;
    }

    const normalizedConfig = normalizeServerConfigForPersistence(config);

    if (
      !normalizedConfig.url &&
      !normalizedConfig.openapi?.url &&
      !normalizedConfig.openapi?.schema &&
      !normalizedConfig.command
    ) {
      res.status(400).json({
        success: false,
        message:
          'Server configuration must include either a URL, OpenAPI specification URL or schema, or command',
      });
      return;
    }

    // Validate the server type if specified
    if (
      normalizedConfig.type &&
      !['stdio', 'sse', 'streamable-http', 'openapi'].includes(normalizedConfig.type)
    ) {
      res.status(400).json({
        success: false,
        message: 'Server type must be one of: stdio, sse, streamable-http, openapi',
      });
      return;
    }

    // Validate that URL is provided for sse and streamable-http types
    if (
      (normalizedConfig.type === 'sse' || normalizedConfig.type === 'streamable-http') &&
      !normalizedConfig.url
    ) {
      res.status(400).json({
        success: false,
        message: `URL is required for ${normalizedConfig.type} server type`,
      });
      return;
    }

    // Validate that OpenAPI specification URL or schema is provided for openapi type
    if (
      normalizedConfig.type === 'openapi' &&
      !normalizedConfig.openapi?.url &&
      !normalizedConfig.openapi?.schema
    ) {
      res.status(400).json({
        success: false,
        message: 'OpenAPI specification URL or schema is required for openapi server type',
      });
      return;
    }

    // Validate headers if provided
    if (normalizedConfig.headers && typeof normalizedConfig.headers !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Headers must be an object',
      });
      return;
    }

    // Validate that headers are only used with sse, streamable-http, and openapi types
    if (normalizedConfig.headers && normalizedConfig.type === 'stdio') {
      res.status(400).json({
        success: false,
        message: 'Headers are not supported for stdio server type',
      });
      return;
    }

    if (!ensureNonAdminCanManageConfig(req, res, normalizedConfig)) {
      return;
    }

    // Set default keep-alive interval for SSE servers if not specified
    if (
      (normalizedConfig.type === 'sse' || (!normalizedConfig.type && normalizedConfig.url)) &&
      !normalizedConfig.keepAliveInterval
    ) {
      normalizedConfig.keepAliveInterval = 60000; // Default 60 seconds for SSE servers
    }

    assignServerOwner(req, normalizedConfig);

    const result = await addServer(serverName, normalizedConfig);
    if (result.success) {
      await recordAdminAuditFromRequest(req, {
        action: 'server.create',
        resourceType: 'server',
        resourceId: serverName,
        after: { name: serverName, type: normalizedConfig.type },
      });
      res.json({
        success: true,
        message: 'Server added successfully',
      });
      notifyToolChanged(serverName, { reportEmbeddingProgress: true }).catch((error) => {
        logger.error('Failed to trigger embedding sync for created server:', error);
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Failed to add server',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// Batch create servers - validates and creates multiple servers in one request
export const batchCreateServers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { servers } = req.body as BatchCreateServersRequest;

    // Validate request body
    if (!servers || !Array.isArray(servers)) {
      res.status(400).json({
        success: false,
        message: 'Request body must contain a "servers" array',
      });
      return;
    }

    if (servers.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Servers array cannot be empty',
      });
      return;
    }

    // Helper function to validate a single server configuration
    const validateServerConfig = (
      name: string,
      config: ServerConfig,
    ): { valid: boolean; message?: string; normalizedName?: string } => {
      const nameValidation = validateServerName(name);
      if (!nameValidation.valid) {
        return { valid: false, message: nameValidation.message };
      }

      if (!config || typeof config !== 'object') {
        return { valid: false, message: 'Server configuration is required and must be an object' };
      }

      const normalizedConfig = normalizeServerConfigForPersistence(config);

      if (
        !normalizedConfig.url &&
        !normalizedConfig.openapi?.url &&
        !normalizedConfig.openapi?.schema &&
        !normalizedConfig.command
      ) {
        return {
          valid: false,
          message:
            'Server configuration must include either a URL, OpenAPI specification URL or schema, or command',
        };
      }

      // Validate server type if specified
      if (
        normalizedConfig.type &&
        !['stdio', 'sse', 'streamable-http', 'openapi'].includes(normalizedConfig.type)
      ) {
        return {
          valid: false,
          message: 'Server type must be one of: stdio, sse, streamable-http, openapi',
        };
      }

      // Validate URL is provided for sse and streamable-http types
      if (
        (normalizedConfig.type === 'sse' || normalizedConfig.type === 'streamable-http') &&
        !normalizedConfig.url
      ) {
        return {
          valid: false,
          message: `URL is required for ${normalizedConfig.type} server type`,
        };
      }

      // Validate OpenAPI specification URL or schema is provided for openapi type
      if (
        normalizedConfig.type === 'openapi' &&
        !normalizedConfig.openapi?.url &&
        !normalizedConfig.openapi?.schema
      ) {
        return {
          valid: false,
          message: 'OpenAPI specification URL or schema is required for openapi server type',
        };
      }

      // Validate headers if provided
      if (normalizedConfig.headers && typeof normalizedConfig.headers !== 'object') {
        return { valid: false, message: 'Headers must be an object' };
      }

      // Validate that headers are only used with sse, streamable-http, and openapi types
      if (normalizedConfig.headers && normalizedConfig.type === 'stdio') {
        return { valid: false, message: 'Headers are not supported for stdio server type' };
      }

      return { valid: true, normalizedName: nameValidation.normalized };
    };

    // Process each server
    const results: BatchServerResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Get current user for owner field
    const currentUser = getRequestUser(req);
    const defaultOwner = currentUser?.username || 'admin';

    for (const server of servers) {
      const { name, config } = server;

      // Validate server configuration
      const validation = validateServerConfig(name, config);
      if (!validation.valid) {
        results.push({
          name: name || 'unknown',
          success: false,
          message: validation.message,
        });
        failureCount++;
        continue;
      }

      const serverName = validation.normalizedName ?? name;

      try {
        // Set default keep-alive interval for SSE servers if not specified
        const normalizedConfig = normalizeServerConfigForPersistence(config);

        if (
          (normalizedConfig.type === 'sse' || (!normalizedConfig.type && normalizedConfig.url)) &&
          !normalizedConfig.keepAliveInterval
        ) {
          normalizedConfig.keepAliveInterval = 60000; // Default 60 seconds for SSE servers
        }

        if (isPrivilegedServerConfig(normalizedConfig) && currentUser?.isAdmin !== true) {
          results.push({
            name: serverName,
            success: false,
            message: 'Only admins can create or modify stdio-based servers',
          });
          failureCount++;
          continue;
        }

        // Set owner property if not provided
        normalizedConfig.owner = currentUser?.isAdmin
          ? normalizedConfig.owner || defaultOwner
          : defaultOwner;

        // Attempt to add server
        const result = await addServer(serverName, normalizedConfig);
        if (result.success) {
          results.push({
            name: serverName,
            success: true,
          });
          successCount++;
        } else {
          results.push({
            name: serverName,
            success: false,
            message: result.message || 'Failed to add server',
          });
          failureCount++;
        }
      } catch (error) {
        results.push({
          name: serverName,
          success: false,
          message: error instanceof Error ? error.message : 'Internal server error',
        });
        failureCount++;
      }
    }

    // Prepare response
    const response: ApiResponse<BatchCreateServersResponse> = {
      success: successCount > 0, // Success if at least one server was created
      data: {
        success: successCount > 0,
        successCount,
        failureCount,
        results,
      },
    };

    // Return 207 Multi-Status if there were partial failures, 200 if all succeeded, 400 if all failed
    const statusCode = failureCount === 0 ? 200 : successCount === 0 ? 400 : 207;
    res.status(statusCode).json(response);

    if (successCount > 0) {
      const successfulServerNames = results
        .filter(
          (result): result is BatchServerResult & { name: string; success: true } => result.success,
        )
        .map((result) => result.name);

      Promise.all(
        successfulServerNames.map((serverName) =>
          notifyToolChanged(serverName, { reportEmbeddingProgress: true }),
        ),
      ).catch((error) => {
        logger.error('Failed to trigger embedding sync for batch-created servers:', error);
      });
    }
  } catch (error) {
    logger.error('Batch create servers error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deleteServer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Server name is required',
      });
      return;
    }

    const existingServer = await loadAuthorizedServer(req, res, name);
    if (!existingServer) {
      return;
    }

    const result = await removeServer(existingServer.name);
    if (result.success) {
      await recordAdminAuditFromRequest(req, {
        action: 'server.delete',
        resourceType: 'server',
        resourceId: existingServer.name,
      });
      notifyToolChanged();
      res.json({
        success: true,
        message: 'Server removed successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message || 'Server not found or failed to remove',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const cloneServer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const newNameRaw = typeof req.body?.newName === 'string' ? req.body.newName : '';
    const existingServer = await loadAuthorizedServer(req, res, name);
    if (!existingServer) {
      return;
    }
    const nameValidation = validateServerName(newNameRaw);
    if (!nameValidation.valid) {
      res.status(400).json({
        success: false,
        message: nameValidation.message || 'Invalid server name',
      });
      return;
    }
    const newName = nameValidation.normalized as string;
    const serverDao = getServerDao();
    if (await serverDao.findById(newName)) {
      res.status(400).json({ success: false, message: 'Server name already exists' });
      return;
    }
    const { name: _ignored, ...config } = existingServer;
    // Copies command/args/env only. Credential bindings and user grants stay on the original.
    const cloned: ServerConfig = {
      ...config,
      enabled: false,
      description: config.description
        ? `${config.description} (copy of ${existingServer.name})`
        : `Copy of ${existingServer.name}`,
    };
    assignServerOwner(req, cloned);
    const result = await addServer(newName, cloned);
    if (!result.success) {
      res.status(400).json({ success: false, message: result.message || 'Failed to clone server' });
      return;
    }
    await recordAdminAuditFromRequest(req, {
      action: 'server.clone',
      resourceType: 'server',
      resourceId: newName,
      before: { name: existingServer.name },
      after: { name: newName },
    });
    notifyToolChanged(newName, { reportEmbeddingProgress: true }).catch((error) => {
      logger.error('Failed to trigger embedding sync for cloned server:', error);
    });
    res.status(201).json({ success: true, data: { name: newName } });
  } catch (error) {
    logger.error('Failed to clone server:', error);
    res.status(500).json({ success: false, message: 'Failed to clone server' });
  }
};

export const getServerEnvPreflight = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const serverDao = getServerDao();
    const serverRecord = await serverDao.findById(name);
    if (!serverRecord) {
      res.status(404).json({ success: false, message: 'Server not found' });
      return;
    }
    const principal = getRequestUser(req);
    const canReadFullConfig = authorizationService.can(
      'server.config.read',
      serverRecord,
      principal,
    );
    if (!canReadFullConfig && !(await requireAdmin(req, res))) {
      return;
    }
    const { name: _name, ...config } = serverRecord;
    res.json({
      success: true,
      data: {
        server: serverRecord.name,
        variables: buildEnvPreflight({
          env: config.env,
          headers: config.headers,
          url: config.url,
          args: config.args,
          command: config.command,
        }),
      },
    });
  } catch (error) {
    logger.error('Failed to build env preflight:', error);
    res.status(500).json({ success: false, message: 'Failed to build env preflight' });
  }
};

export const updateServer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const { config, newName } = req.body;
    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Server name is required',
      });
      return;
    }

    if (!config || typeof config !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Server configuration is required',
      });
      return;
    }

    const normalizedConfig = normalizeServerConfigForPersistence(config);

    if (
      !normalizedConfig.url &&
      !normalizedConfig.openapi?.url &&
      !normalizedConfig.openapi?.schema &&
      !normalizedConfig.command
    ) {
      res.status(400).json({
        success: false,
        message:
          'Server configuration must include either a URL, OpenAPI specification URL or schema, or command',
      });
      return;
    }

    // Validate the server type if specified
    if (
      normalizedConfig.type &&
      !['stdio', 'sse', 'streamable-http', 'openapi'].includes(normalizedConfig.type)
    ) {
      res.status(400).json({
        success: false,
        message: 'Server type must be one of: stdio, sse, streamable-http, openapi',
      });
      return;
    }

    // Validate that URL is provided for sse and streamable-http types
    if (
      (normalizedConfig.type === 'sse' || normalizedConfig.type === 'streamable-http') &&
      !normalizedConfig.url
    ) {
      res.status(400).json({
        success: false,
        message: `URL is required for ${normalizedConfig.type} server type`,
      });
      return;
    }

    // Validate that OpenAPI specification URL or schema is provided for openapi type
    if (
      normalizedConfig.type === 'openapi' &&
      !normalizedConfig.openapi?.url &&
      !normalizedConfig.openapi?.schema
    ) {
      res.status(400).json({
        success: false,
        message: 'OpenAPI specification URL or schema is required for openapi server type',
      });
      return;
    }

    // Validate headers if provided
    if (normalizedConfig.headers && typeof normalizedConfig.headers !== 'object') {
      res.status(400).json({
        success: false,
        message: 'Headers must be an object',
      });
      return;
    }

    // Validate that headers are only used with sse, streamable-http, and openapi types
    if (normalizedConfig.headers && normalizedConfig.type === 'stdio') {
      res.status(400).json({
        success: false,
        message: 'Headers are not supported for stdio server type',
      });
      return;
    }

    const existingServer = await loadAuthorizedServer(req, res, name);
    if (!existingServer) {
      return;
    }

    if (!ensureNonAdminCanManageConfig(req, res, normalizedConfig)) {
      return;
    }

    // Set default keep-alive interval for SSE servers if not specified
    if (
      (normalizedConfig.type === 'sse' || (!normalizedConfig.type && normalizedConfig.url)) &&
      !normalizedConfig.keepAliveInterval
    ) {
      normalizedConfig.keepAliveInterval = 60000; // Default 60 seconds for SSE servers
    }

    // Set owner property if not provided - use current user's username, default to 'admin'
    assignServerOwner(req, normalizedConfig, existingServer.owner);

    // Check if server name is being changed
    const isRenaming = newName && newName !== name;

    // Final server name used for the rest of the update flow (the new name when
    // renaming, otherwise the original name).
    let finalName = name;

    // If renaming, validate the new name and update references
    if (isRenaming) {
      const serverDao = getServerDao();
      const nameValidation = validateServerName(newName);
      if (!nameValidation.valid) {
        res.status(400).json({
          success: false,
          message: nameValidation.message,
        });
        return;
      }
      const targetName = nameValidation.normalized as string;
      finalName = targetName;

      // Check if new name already exists
      if (await serverDao.exists(targetName)) {
        res.status(400).json({
          success: false,
          message: `Server name '${targetName}' already exists`,
        });
        return;
      }

      // Rename the server
      const renamed = await serverDao.rename(name, targetName);
      if (!renamed) {
        res.status(404).json({
          success: false,
          message: 'Server not found',
        });
        return;
      }

      // Close the runtime still keyed by the OLD name. addOrUpdateServer below
      // closes by `finalName` (the new name), which finds nothing - the entry is
      // still registered under the old name until initializeClientsFromSettings
      // rebuilds serverInfos. Without this explicit close the old stdio child
      // process tree is orphaned and leaks until the process restarts.
      closeServer(name);

      // Update references in groups
      const groupDao = getGroupDao();
      await groupDao.updateServerName(name, targetName);

      // Update references in bearer keys
      const bearerKeyDao = getBearerKeyDao();
      await bearerKeyDao.updateServerName(name, targetName);

      // Drop embeddings stored under the old name so search_tools does not
      // advertise phantom tools; addOrUpdateServer below regenerates them
      // under the new name. A failure here must not abort the rename.
      try {
        await removeServerToolEmbeddings(name);
      } catch (error) {
        logger.warn('Failed to remove embeddings for renamed server', {
          serverName: name,
          error,
        });
      }
    }

    // Fast path: if no connection-relevant field changed, persist and update
    // in-memory access metadata without tearing down the runtime. This covers
    // visibility/sharedWithUsers edits, description-only edits, owner changes,
    // and no-op edits alike - none of them need a reconnect.
    if (!isRenaming && !hasConnectionRelevantChange(existingServer, normalizedConfig)) {
      const serverDao = getServerDao();
      const updatedServer = await serverDao.update(name, normalizedConfig);

      if (!updatedServer) {
        res.status(404).json({
          success: false,
          message: 'Server not found or failed to update',
        });
        return;
      }

      updateServerInfoVisibility(
        finalName,
        normalizedConfig.visibility ?? 'private',
        normalizedConfig.sharedWithUsers,
      );
      broadcastToolListChanged();

      res.json({
        success: true,
        message: 'Server updated successfully',
      });
      return;
    }

    const result = await addOrUpdateServer(finalName, normalizedConfig, true); // Allow override for updates
    if (result.success) {
      // On-demand servers repopulate their tool cache via primeOnDemandServers
      // inside initializeClientsFromSettings, which is awaited for a targeted
      // reload. Await it here too: the dashboard refreshes the server list as
      // soon as the PUT responds, and without this the refresh would race ahead
      // of the prime and show an empty tool list until the next 30s poll (or a
      // manual refresh). Non-on-demand servers keep the existing fire-and-forget
      // behavior since their connect is already async. See #1032.
      if (normalizedConfig.startOnDemand === true) {
        await notifyToolChanged(finalName);
      } else {
        notifyToolChanged(finalName);
      }
      res.json({
        success: true,
        message: isRenaming
          ? `Server renamed and updated successfully`
          : 'Server updated successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message || 'Server not found or failed to update',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getServerConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;

    if (isYlunePlatformServerName(name)) {
      res.status(404).json({
        success: false,
        message: 'Server not found',
      });
      return;
    }

    const serverDao = getServerDao();
    const serverRecord = await serverDao.findById(name);
    if (!serverRecord) {
      res.status(404).json({
        success: false,
        message: 'Server not found',
      });
      return;
    }

    // #1036 Phase 1: config read and server use are separate decisions.
    // Owner/admin get the full configuration; visibility-admitted shared users
    // (public / group members) get a safe view without secret-bearing fields;
    // everyone else is rejected exactly as before.
    const principal = getRequestUser(req);
    const canReadFullConfig = authorizationService.can(
      'server.config.read',
      serverRecord,
      principal,
    );
    if (
      !canReadFullConfig &&
      !isVisibilitySharedWith(serverRecord, principal) &&
      !(await authorizationService.canInvoke({ ...serverRecord, name }, principal))
    ) {
      res.status(403).json({
        success: false,
        message: 'Forbidden',
      });
      return;
    }

    // Get runtime info (status, tools) from getServersInfo
    const allServers = await getServersInfo();
    const serverInfo = allServers.find((s) => s.name === name);

    // Extract config without the name field
    const { name: serverName, ...config } = serverRecord;
    const presented = presentServerForPrincipal(config, principal);

    // OpenAPI tools can carry circular $ref cycles left by SwaggerParser.dereference
    // (recursive schemas), which would make res.json throw. Mirror the list endpoint
    // and sanitize via createSafeJSON. See #959.
    const response: ApiResponse = {
      success: true,
      data: createSafeJSON({
        name: serverName,
        status: serverInfo?.status || 'disconnected',
        tools: serverInfo?.tools || [],
        config: presented.data,
      }),
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get server configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get server configuration',
    });
  }
};

export const toggleServer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    const { enabled } = req.body;
    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Server name is required',
      });
      return;
    }

    if (typeof enabled !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'Enabled status must be a boolean',
      });
      return;
    }

    const existingServer = await loadAuthorizedServer(req, res, name);
    if (!existingServer) {
      return;
    }

    const result = await toggleServerStatus(existingServer.name, enabled);
    if (result.success) {
      // On disable, toggleServerStatus synchronously closes the server and
      // updates serverInfos, so we broadcast the now-removed tools/prompts/
      // resources here. On enable, the connection completes asynchronously
      // inside initializeClientsFromSettings, which broadcasts itself once the
      // tools/prompts/resources are actually loaded — broadcasting here would
      // race ahead of that and push a stale (empty) list. See #938 / #942.
      if (!enabled) {
        broadcastToolListChanged();
        broadcastPromptListChanged();
        broadcastResourceListChanged();
      }
      res.json({
        success: true,
        message: result.message || `Server ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message || 'Server not found or failed to toggle status',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const reloadServer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Server name is required',
      });
      return;
    }

    const existingServer = await loadAuthorizedServer(req, res, name);
    if (!existingServer) {
      return;
    }

    await reconnectServer(existingServer.name);

    res.json({
      success: true,
      message: `Server ${name} reloaded successfully`,
    });
  } catch (error) {
    logger.error('Failed to reload server:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reload server',
    });
  }
};

const parseOAuthDisconnectScope = (scope: unknown): UpstreamOAuthDisconnectScope | null => {
  if (scope === undefined) {
    return 'tokens';
  }

  if (scope === 'tokens' || scope === 'all') {
    return scope;
  }

  return null;
};

export const disconnectServerOAuth = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Server name is required',
      });
      return;
    }

    const scope = parseOAuthDisconnectScope(req.body?.scope);
    if (!scope) {
      res.status(400).json({
        success: false,
        message: 'OAuth disconnect scope must be "tokens" or "all"',
      });
      return;
    }

    const existingServer = await loadAuthorizedServer(req, res, name);
    if (!existingServer) {
      return;
    }

    const result = await disconnectUpstreamOAuth(existingServer.name, { scope });
    const { success: _success, ...data } = result;

    res.json({
      success: true,
      message: `Server ${name} OAuth disconnected successfully`,
      data,
    });
  } catch (error) {
    logger.error('Failed to disconnect server OAuth:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect server OAuth',
    });
  }
};

// Reinstall server: clear package cache and reconnect
export const reinstallServerHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.params;
    if (!name) {
      res.status(400).json({
        success: false,
        message: 'Server name is required',
      });
      return;
    }

    const existingServer = await loadAuthorizedServer(req, res, name);
    if (!existingServer) {
      return;
    }

    await reinstallServer(existingServer.name);

    res.json({
      success: true,
      message: `Server ${name} reinstall initiated`,
    });
  } catch (error) {
    logger.error('Failed to reinstall server:', error);
    const message = error instanceof Error ? error.message : 'Failed to reinstall server';
    // Validation errors (unsupported command, disabled server) → 400
    if (message.includes('does not support cache refresh') || message.includes('disabled server')) {
      res.status(400).json({ success: false, message });
    } else {
      res.status(500).json({ success: false, message: 'Failed to reinstall server' });
    }
  }
};

// Clear all runner caches (npm + uv). Admin-only.
export const clearCache = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user?.isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Only admins can clear runner caches',
      });
      return;
    }

    const results = await clearAllCaches();

    res.json({
      success: true,
      message: 'Cache clear completed',
      results,
    });
  } catch (error) {
    logger.error('Failed to clear cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear cache',
    });
  }
};

const toolCapabilityHandlers = createCapabilityHandlers<ServerRecord>({
  displayName: 'Tool',
  itemParam: 'toolName',
  missingNamesMessage: 'Server name and tool name are required',
  loadServer: loadAuthorizedServer,
  getItems: (server) => server.tools || {},
  persistItems: (serverName, tools) => getServerDao().updateTools(serverName, tools),
  afterPersist: (operation, serverName, toolName) => {
    notifyToolChanged();
    if (operation !== 'toggle') {
      syncToolEmbedding(serverName, toolName);
    }
  },
  getDefaultDescription: (serverName, toolName) =>
    getServerByName(serverName)?.tools.find((tool) => tool.name === toolName)?.description || '',
});

const promptCapabilityHandlers = createCapabilityHandlers<ServerRecord>({
  displayName: 'Prompt',
  itemParam: 'promptName',
  missingNamesMessage: 'Server name and prompt name are required',
  loadServer: loadAuthorizedServer,
  getItems: (server) => server.prompts || {},
  persistItems: (serverName, prompts) => getServerDao().updatePrompts(serverName, prompts),
  afterPersist: () => {
    notifyToolChanged();
  },
  getDefaultDescription: (serverName, promptName) =>
    getServerByName(serverName)?.prompts.find((prompt) => prompt.name === promptName)?.description ||
    '',
});

const resourceCapabilityHandlers = createCapabilityHandlers<ServerRecord>({
  displayName: 'Resource',
  itemParam: 'resourceUri',
  missingNamesMessage: 'Server name and resource URI are required',
  loadServer: loadAuthorizedServer,
  getItems: (server) => server.resources || {},
  persistItems: (serverName, resources) => getServerDao().updateResources(serverName, resources),
  afterPersist: () => {
    notifyToolChanged();
  },
  getDefaultDescription: (serverName, resourceUri) =>
    getServerByName(serverName)?.resources.find((resource) => resource.uri === resourceUri)
      ?.description || '',
});

export const toggleTool = toolCapabilityHandlers.toggle;
export const updateToolDescription = toolCapabilityHandlers.updateDescription;
export const resetToolDescription = toolCapabilityHandlers.resetDescription;

export const updateSystemConfig = async (req: Request, res: Response): Promise<void> => {
  const user = getRequestUser(req);
  if (!user?.isAdmin) {
    res.status(403).json({
      success: false,
      message: 'Admin privileges required',
    });
    return;
  }

  try {
    const {
      routing,
      install,
      smartRouting: requestSmartRouting,
      toolResultCompression,
      mcpRouter,
      nameSeparator,
      enableSessionRebuild,
      oauthServer,
      auth,
      activityLog,
    } = req.body;
    const { smartRouting } = migrateLegacySmartRoutingConfig(requestSmartRouting);
    const request = {
      ...req.body,
      smartRouting,
    };

    if (!hasSystemConfigUpdate(request)) {
      res.status(400).json({
        success: false,
        message: 'Invalid system configuration provided',
      });
      return;
    }

    // Get system config from DAO (supports both file and database modes)
    const systemConfigDao = getSystemConfigDao();
    const systemConfig = initializeSystemConfig(await systemConfigDao.get());

    systemConfig.routing = patchRoutingConfig(systemConfig.routing, routing);
    systemConfig.install = patchInstallConfig(systemConfig.install, install);

    const smartRoutingPatch = patchSmartRoutingConfig(
      systemConfig.smartRouting,
      smartRouting,
      process.env.DB_URL || '',
    );
    if (smartRoutingPatch.error) {
      res.status(400).json({
        message: smartRoutingPatch.error,
      });
      return;
    }
    systemConfig.smartRouting = smartRoutingPatch.config;
    const needsSync = smartRoutingPatch.needsSync;

    systemConfig.mcpRouter = patchMcpRouterConfig(systemConfig.mcpRouter, mcpRouter);
    systemConfig.toolResultCompression = patchToolResultCompressionConfig(
      systemConfig.toolResultCompression,
      toolResultCompression,
    );

    systemConfig.oauthServer = patchOAuthServerConfig(systemConfig.oauthServer, oauthServer);

    systemConfig.auth = patchAuthConfig(systemConfig.auth, auth);

    if (typeof nameSeparator === 'string') {
      systemConfig.nameSeparator = nameSeparator;
    }

    if (typeof enableSessionRebuild === 'boolean') {
      systemConfig.enableSessionRebuild = enableSessionRebuild;
    }

    if (activityLog && typeof activityLog.storeToolPayload === 'boolean') {
      systemConfig.activityLog = patchActivityLogConfig(systemConfig.activityLog, activityLog);
    }

    // Save using DAO (supports both file and database modes)
    try {
      await systemConfigDao.update(systemConfig);
      setCachedSystemConfig(systemConfig);
      res.json({
        success: true,
        data: systemConfig,
        message: 'System configuration updated successfully',
      });

      // If smart routing configuration changed, sync all existing server tools
      if (needsSync) {
        logger.log('SmartRouting configuration changed - syncing all existing server tools...');
        // Run sync asynchronously to avoid blocking the response
        syncAllServerToolsEmbeddings().catch((error) => {
          logger.error('Failed to sync server tools embeddings:', error);
        });
      }
    } catch (saveError) {
      logger.error('Failed to save system configuration:', saveError);
      res.status(500).json({
        success: false,
        message: 'Failed to save system configuration',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const togglePrompt = promptCapabilityHandlers.toggle;
export const updatePromptDescription = promptCapabilityHandlers.updateDescription;
export const resetPromptDescription = promptCapabilityHandlers.resetDescription;

export const toggleResource = resourceCapabilityHandlers.toggle;
export const updateResourceDescription = resourceCapabilityHandlers.updateDescription;
export const resetResourceDescription = resourceCapabilityHandlers.resetDescription;

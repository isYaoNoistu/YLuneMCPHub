import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  ActivityStatus,
  IActivityChain,
  ServerConfig,
  ServerInfo,
  Tool,
} from '../../types/index.js';
import type { HostedAuthContext, HostedCreditReservation } from '../hostedAuthService.js';
import type { YlunePlatformToolName } from '../ylunePlatformMcp.js';
import type { McpAppsRouteContext } from './mcpListHandlers.js';

export type ToolCallClientContext = {
  sessionId: string;
  client: Client;
  transport: any;
  overlayConfig?: ServerConfig;
  credentialCacheKey?: string;
};

type ToolUnavailableErrorLike = Error & { reason: string };
type ToolUnavailableErrorConstructor = new (
  message: string,
  reason: string,
) => ToolUnavailableErrorLike;
type ResourceBindingDeniedErrorConstructor = new (...args: any[]) => Error;

type ActivityToolCallParams = {
  server: string;
  tool: string;
  duration: number;
  status: ActivityStatus;
  input?: unknown;
  output?: unknown;
  group?: string;
  username?: string;
  keyId?: string;
  keyName?: string;
  sourceIp?: string;
  errorMessage?: string;
} & IActivityChain;

type RequestContextReader = {
  getBearerKeyContext: () => { keyId?: string; keyName?: string };
  getSessionId: () => string | undefined;
  getGroupContext: () => string | undefined;
  getUsernameContext: () => string | undefined;
  getKeyKindContext: () => string | undefined;
  getRequestContext: () => { remoteAddress?: string } | null;
  getHeaders: () => Record<string, string | string[] | undefined> | null;
  getHostedAuthContext: () => HostedAuthContext | undefined;
};

type ToolResolution = {
  serverInfo: ServerInfo;
  toolName: string;
  tool: Tool;
};

type AssignedCredentialToolResolution = {
  serverInfo: ServerInfo;
  tool: Tool;
  routeToolName: string;
};

export type McpToolDispatchDependencies = {
  access: {
    ensureEffectiveAccess: () => Promise<unknown>;
    authorizeToolResourceAccess: (input: {
      username?: string;
      serverName: string;
      args: unknown;
    }) => Promise<{ chain: IActivityChain; sanitizedArgs: unknown }>;
    ResourceBindingDeniedError: ResourceBindingDeniedErrorConstructor;
  };
  context: {
    getRequestContext: () => RequestContextReader;
    getGroup: (sessionId: string) => string | undefined;
  };
  registry: {
    getServerInfos: () => ServerInfo[];
    getVisibleServerByName: (name: string) => ServerInfo | undefined;
    getVisibleServerInfos: () => ServerInfo[];
    getServerByName: (name: string) => ServerInfo | undefined;
    getServerByTool: (toolName: string) => ServerInfo | undefined;
    resolveToolViaAssignedCredential: (
      toolName: string,
    ) => Promise<AssignedCredentialToolResolution | undefined>;
    findToolOnServer: (
      serverInfo: ServerInfo,
      toolName: string,
      allowRawName: boolean,
    ) => Tool | undefined;
  };
  routing: {
    getMcpAppsRouteContext: (
      sessionId: string,
      group: string | undefined,
    ) => Promise<McpAppsRouteContext>;
    getGroupLookupName: (group: string | undefined) => string | undefined;
    resolveToolInGroup: (
      group: string | undefined,
      toolName: string,
      allowRawName: boolean,
    ) => Promise<ToolResolution | undefined>;
    classifyUnavailableReason: (qualifiedName: string) => string;
    ToolUnavailableError: ToolUnavailableErrorConstructor;
    assertToolAvailableForRoute: (tool: Tool, context: McpAppsRouteContext) => void;
    normalizeToolNameForServer: (serverName: string, toolName: string) => string;
    handleSearchToolsRequest: (query: string, limit: number, sessionId: string) => Promise<any>;
    handleDescribeToolRequest: (toolName: string, sessionId: string) => Promise<any>;
  };
  clients: {
    getOrCreateCredentialClient: (
      serverInfo: ServerInfo,
      credentialId: string,
    ) => Promise<ToolCallClientContext>;
    getOrCreateIsolatedClient: (
      sessionId: string,
      serverInfo: ServerInfo,
    ) => Promise<{ client: Client; transport: any }>;
    callToolWithReconnect: (
      serverInfo: ServerInfo,
      toolParams: any,
      options: any,
      maxRetries: number,
      isolated?: ToolCallClientContext,
    ) => Promise<any>;
    ensureServerReady: (serverInfo: ServerInfo) => Promise<void>;
    scheduleIdleShutdown: (serverInfo: ServerInfo) => void;
  };
  credentials: {
    findUserServerCredential: (
      username: string,
      serverName: string,
    ) => Promise<{ credentialId?: string } | null | undefined>;
  };
  hosted: {
    assertHostedToolAllowed: (
      context: HostedAuthContext | undefined,
      serverName: string,
      toolName: string,
    ) => void;
    reserveHostedToolCall: (
      context: HostedAuthContext | undefined,
      serverName: string,
      toolName: string,
    ) => Promise<HostedCreditReservation | null>;
    settleHostedToolCall: (
      reservation: HostedCreditReservation | null,
      input: {
        success: boolean;
        latencyMs: number;
        requestContent?: unknown;
        responseContent?: unknown;
      },
    ) => Promise<void>;
  };
  ylune: {
    serverName: string;
    isYlunePlatformServerName: (name: string) => boolean;
    matchYlunePlatformTool: (name: unknown) => YlunePlatformToolName | null;
    callerCanUseYlunePlatform: () => Promise<boolean>;
    executeYlunePlatformTool: (
      tool: YlunePlatformToolName,
      args: Record<string, unknown>,
      context: { servers: ServerInfo[] },
    ) => Promise<unknown>;
  };
  compression: {
    maybeCompressToolResult: (
      result: any,
      context: { serverName: string; toolName: string; group?: string },
    ) => Promise<any>;
  };
  logging: {
    log: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
    getActivityLogger: () => {
      logToolCall: (params: ActivityToolCallParams) => Promise<void>;
    };
    summarizeToolRequestForLogging: (params: unknown) => unknown;
    summarizeArgumentsForLogging: (args: unknown) => unknown;
    summarizeToolResultForLogging: (result: unknown) => unknown;
    summarizeErrorForLogging: (error: unknown) => Record<string, unknown>;
    formatErrorForLogging: (error: unknown) => string;
  };
  runtime: {
    now: () => number;
    randomUUID: () => string;
    getNameSeparator: () => string;
  };
};

const getActivityInputFromToolRequest = (request: any): unknown => {
  if (request?.params?.name === 'call_tool') {
    return request?.params?.arguments?.arguments;
  }
  return request?.params?.arguments;
};

const getActivityToolNameFromRequest = (request: any): string => {
  if (request?.params?.name === 'call_tool') {
    const nestedToolName = request?.params?.arguments?.toolName;
    return typeof nestedToolName === 'string' ? nestedToolName : 'call_tool';
  }
  return typeof request?.params?.name === 'string' ? request.params.name : 'unknown';
};

export const createMcpToolDispatch = (deps: McpToolDispatchDependencies) => {
  const {
    access,
    context,
    registry,
    routing,
    clients,
    credentials,
    hosted,
    ylune,
    compression,
    logging,
    runtime,
  } = deps;

  return async (request: any, extra: any) => {
    logging.log(
      'Handling CallToolRequest for tool',
      logging.summarizeToolRequestForLogging(request.params),
    );
    const startTime = runtime.now();
    const activityLogger = logging.getActivityLogger();

    await access.ensureEffectiveAccess();
    const requestContextService = context.getRequestContext();
    const bearerKeyContext = requestContextService.getBearerKeyContext();
    const sessionId = extra.sessionId || '';

    const isSyntheticSessionFallback = (id: string) =>
      id === 'api-session' || id === 'openapi-session';
    const explicitXSessionId = extra?.headers?.['x-session-id'];
    const cookieSessionId = [
      requestContextService.getSessionId(),
      typeof explicitXSessionId === 'string' ? explicitXSessionId : undefined,
      typeof extra?.sessionId === 'string' ? extra.sessionId : undefined,
    ].find(
      (id): id is string =>
        typeof id === 'string' && id.length > 0 && !isSyntheticSessionFallback(id),
    );

    const group =
      requestContextService.getGroupContext() ||
      extra?.group ||
      context.getGroup(sessionId) ||
      undefined;
    const username =
      requestContextService.getUsernameContext() ||
      extra?.username ||
      (requestContextService.getKeyKindContext() === 'system' ? 'system' : undefined) ||
      undefined;
    let appsRouteContext: McpAppsRouteContext = { enabled: false };
    const keyId = bearerKeyContext.keyId || extra?.keyId || undefined;
    const keyName = bearerKeyContext.keyName || extra?.keyName || undefined;
    const sourceIp = requestContextService.getRequestContext()?.remoteAddress || undefined;
    const requestId = runtime.randomUUID();
    let resourceChain: IActivityChain = { requestId };
    const applyResourceAccess = async (serverName: string, args: unknown) => {
      const resourceAccess = await access.authorizeToolResourceAccess({
        username,
        serverName,
        args,
      });
      resourceChain = { requestId, ...resourceAccess.chain };
      return resourceAccess.sanitizedArgs;
    };
    const resolveCallClient = async (
      serverInfo: ServerInfo,
    ): Promise<ToolCallClientContext | undefined> => {
      if (resourceChain.credentialId) {
        return clients.getOrCreateCredentialClient(serverInfo, resourceChain.credentialId);
      }
      if (username) {
        const pick = await credentials.findUserServerCredential(username, serverInfo.name);
        if (pick?.credentialId) {
          return clients.getOrCreateCredentialClient(serverInfo, pick.credentialId);
        }
      }
      if (serverInfo.config?.perSessionClient && sessionId) {
        const isolated = await clients.getOrCreateIsolatedClient(sessionId, serverInfo);
        return { sessionId, client: isolated.client, transport: isolated.transport };
      }
      if (serverInfo.builtin || ylune.isYlunePlatformServerName(serverInfo.name)) {
        return undefined;
      }
      if (!serverInfo.client) {
        throw new Error(`Client not found for server: ${serverInfo.name}`);
      }
      return undefined;
    };
    const logToolCall = (params: ActivityToolCallParams) =>
      activityLogger.logToolCall({ ...params, ...resourceChain });
    let hostedReservation: HostedCreditReservation | null = null;

    const reserveHostedIfNeeded = async (serverName: string, toolName: string) => {
      const hostedAuth = requestContextService.getHostedAuthContext();
      hosted.assertHostedToolAllowed(hostedAuth, serverName, toolName);
      hostedReservation = await hosted.reserveHostedToolCall(hostedAuth, serverName, toolName);
    };

    const settleHostedIfNeeded = async (input: {
      success: boolean;
      requestContent?: unknown;
      responseContent?: unknown;
    }) => {
      const reservation = hostedReservation;
      hostedReservation = null;
      await hosted.settleHostedToolCall(reservation, {
        success: input.success,
        latencyMs: runtime.now() - startTime,
        requestContent: input.requestContent,
        responseContent: input.responseContent,
      });
    };

    try {
      appsRouteContext = await routing.getMcpAppsRouteContext(sessionId, group);

      const requestedToolName =
        request.params.name === 'call_tool'
          ? request.params.arguments?.toolName
          : request.params.name;
      const fulfillYlunePlatformCall = async (
        yluneTool: YlunePlatformToolName,
        rawArgs: unknown,
        listedName: string,
      ) => {
        if (!(await ylune.callerCanUseYlunePlatform())) {
          throw new routing.ToolUnavailableError(
            `Tool not available: ${listedName}`,
            'tool-not-found',
          );
        }
        const toolArgs =
          rawArgs && typeof rawArgs === 'object' ? (rawArgs as Record<string, unknown>) : {};
        const payload = await ylune.executeYlunePlatformTool(yluneTool, toolArgs, {
          servers: registry.getServerInfos(),
        });
        const result = {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload),
            },
          ],
        };
        const duration = runtime.now() - startTime;
        await logToolCall({
          server: ylune.serverName,
          tool: yluneTool,
          duration,
          status: 'success',
          input: toolArgs,
          output: { ok: true },
          group,
          username,
          keyId,
          keyName,
          sourceIp,
        });
        return result;
      };
      const yluneTool = ylune.matchYlunePlatformTool(requestedToolName);
      if (yluneTool) {
        const toolArgs =
          request.params.name === 'call_tool'
            ? request.params.arguments?.arguments
            : request.params.arguments;
        return fulfillYlunePlatformCall(yluneTool, toolArgs, requestedToolName);
      }

      if (request.params.name === 'search_tools') {
        const { query, limit = 10 } = request.params.arguments || {};
        return await routing.handleSearchToolsRequest(query, limit, sessionId);
      }

      if (request.params.name === 'describe_tool') {
        const { toolName } = request.params.arguments || {};
        return await routing.handleDescribeToolRequest(toolName, sessionId);
      }

      if (request.params.name === 'call_tool') {
        const { toolName } = request.params.arguments || {};
        if (!toolName) {
          throw new Error('toolName parameter is required');
        }

        const { arguments: toolArgs } = request.params.arguments || {};
        const singleServerAppsRoute = !!appsRouteContext.serverInfo;
        let targetServerInfo: ServerInfo | undefined;
        let targetToolName = toolName;
        let targetTool: Tool | undefined;
        if (singleServerAppsRoute) {
          targetServerInfo = appsRouteContext.serverInfo;
        } else if (extra && extra.server) {
          targetServerInfo = registry.getVisibleServerByName(extra.server);
        } else if (routing.getGroupLookupName(group)) {
          const groupTool = await routing.resolveToolInGroup(group, toolName, false);
          if (groupTool) {
            targetServerInfo = groupTool.serverInfo;
            targetToolName = groupTool.toolName;
            targetTool = groupTool.tool;
          }
        } else {
          targetServerInfo = registry
            .getVisibleServerInfos()
            .find(
              (serverInfo) =>
                serverInfo.enabled !== false &&
                (serverInfo.status === 'connected' || serverInfo.config?.startOnDemand === true) &&
                serverInfo.tools.some((tool) => tool.name === toolName),
            );
        }

        if (!targetServerInfo) {
          throw new routing.ToolUnavailableError(
            `Tool not available: ${toolName}`,
            routing.classifyUnavailableReason(toolName),
          );
        }

        if (targetServerInfo.builtin || ylune.isYlunePlatformServerName(targetServerInfo.name)) {
          const routed =
            ylune.matchYlunePlatformTool(targetToolName) || ylune.matchYlunePlatformTool(toolName);
          if (!routed) {
            throw new routing.ToolUnavailableError(
              `Tool not available: ${toolName}`,
              'tool-not-found',
            );
          }
          return fulfillYlunePlatformCall(routed, toolArgs, toolName);
        }

        targetServerInfo.lastUsedAt = runtime.now();

        const tool =
          targetTool ??
          registry.findToolOnServer(targetServerInfo, targetToolName, singleServerAppsRoute);
        if (!tool) {
          throw new routing.ToolUnavailableError(
            `Tool not available: ${toolName}`,
            'tool-not-found',
          );
        }
        routing.assertToolAvailableForRoute(tool, appsRouteContext);

        if (targetServerInfo.openApiClient) {
          if (targetServerInfo.config?.startOnDemand && targetServerInfo.status !== 'connected') {
            await clients.ensureServerReady(targetServerInfo);
          }
          const openApiClient = targetServerInfo.openApiClient;
          const finalArgs = await applyResourceAccess(
            targetServerInfo.name,
            toolArgs && typeof toolArgs === 'object' ? toolArgs : {},
          );

          logging.log('Invoking OpenAPI tool', {
            toolName: targetToolName,
            serverName: targetServerInfo.name,
            arguments: logging.summarizeArgumentsForLogging(finalArgs),
          });

          const cleanToolName = routing.normalizeToolNameForServer(
            targetServerInfo.name,
            targetToolName,
          );
          let passthroughHeaders: Record<string, string> | undefined;
          let requestHeaders: Record<string, string | string[] | undefined> | null = null;

          if (extra?.headers) {
            requestHeaders = extra.headers;
          } else {
            requestHeaders = requestContextService.getHeaders();
          }

          if (requestHeaders && targetServerInfo.config?.openapi?.passthroughHeaders) {
            passthroughHeaders = {};
            for (const headerName of targetServerInfo.config.openapi.passthroughHeaders) {
              const headerValue =
                requestHeaders[headerName] || requestHeaders[headerName.toLowerCase()];
              if (headerValue) {
                passthroughHeaders[headerName] = Array.isArray(headerValue)
                  ? headerValue[0]
                  : String(headerValue);
              }
            }
          }

          await reserveHostedIfNeeded(targetServerInfo.name, cleanToolName);
          const result = await openApiClient.callTool(
            cleanToolName,
            finalArgs,
            passthroughHeaders,
            false,
            cookieSessionId,
          );
          await settleHostedIfNeeded({
            success: true,
            requestContent: finalArgs,
            responseContent: result,
          });

          logging.log('OpenAPI tool invocation result', {
            serverName: targetServerInfo.name,
            toolName: cleanToolName,
            result: logging.summarizeToolResultForLogging(result),
          });

          const duration = runtime.now() - startTime;
          await logToolCall({
            server: targetServerInfo.name,
            tool: cleanToolName,
            duration,
            status: 'success',
            input: finalArgs,
            output: result,
            group,
            username,
            keyId,
            keyName,
            sourceIp,
          });

          return await compression.maybeCompressToolResult(
            {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result),
                },
              ],
            },
            {
              serverName: targetServerInfo.name,
              toolName: cleanToolName,
              group,
            },
          );
        }

        const finalArgs = await applyResourceAccess(
          targetServerInfo.name,
          toolArgs && typeof toolArgs === 'object' ? toolArgs : {},
        );
        if (
          !resourceChain.credentialId &&
          targetServerInfo.config?.startOnDemand &&
          targetServerInfo.status !== 'connected'
        ) {
          await clients.ensureServerReady(targetServerInfo);
          if ((targetServerInfo as ServerInfo).status !== 'connected') {
            throw new Error(
              `Failed to start on-demand server '${targetServerInfo.name}' — check server logs`,
            );
          }
        }
        const isolatedCtx = await resolveCallClient(targetServerInfo);

        logging.log('Invoking tool', {
          toolName: targetToolName,
          serverName: targetServerInfo.name,
          arguments: logging.summarizeArgumentsForLogging(finalArgs),
          perSessionClient: !!targetServerInfo.config?.perSessionClient,
        });

        const cleanToolName = routing.normalizeToolNameForServer(
          targetServerInfo.name,
          targetToolName,
        );
        await reserveHostedIfNeeded(targetServerInfo.name, cleanToolName);
        const result = await clients.callToolWithReconnect(
          targetServerInfo,
          {
            name: cleanToolName,
            arguments: finalArgs,
          },
          targetServerInfo.options || {},
          1,
          isolatedCtx,
        );
        await settleHostedIfNeeded({
          success: !result.isError,
          requestContent: finalArgs,
          responseContent: result,
        });

        logging.log('Tool invocation result', {
          serverName: targetServerInfo.name,
          toolName: cleanToolName,
          result: logging.summarizeToolResultForLogging(result),
        });

        clients.scheduleIdleShutdown(targetServerInfo);

        const duration = runtime.now() - startTime;
        await logToolCall({
          server: targetServerInfo.name,
          tool: cleanToolName,
          duration,
          status: result.isError ? 'error' : 'success',
          input: finalArgs,
          output: result,
          group,
          username,
          keyId,
          keyName,
          sourceIp,
          errorMessage: result.isError ? 'Tool returned error response' : undefined,
        });

        return await compression.maybeCompressToolResult(result, {
          serverName: targetServerInfo.name,
          toolName: cleanToolName,
          group,
        });
      }

      const lookupGroup = routing.getGroupLookupName(group);
      const singleServerAppsRoute = !!appsRouteContext.serverInfo;
      const groupTool =
        !singleServerAppsRoute && lookupGroup
          ? await routing.resolveToolInGroup(lookupGroup, request.params.name, false)
          : undefined;
      let serverInfo = singleServerAppsRoute
        ? appsRouteContext.serverInfo
        : (groupTool?.serverInfo ??
          (lookupGroup ? undefined : registry.getServerByTool(request.params.name)));
      let routeToolName = groupTool?.toolName ?? request.params.name;
      let tool =
        groupTool?.tool ??
        (serverInfo
          ? registry.findToolOnServer(serverInfo, routeToolName, singleServerAppsRoute)
          : undefined);
      if (!serverInfo || !tool) {
        const viaCredential = await registry.resolveToolViaAssignedCredential(request.params.name);
        if (viaCredential) {
          serverInfo = viaCredential.serverInfo;
          tool = viaCredential.tool;
          routeToolName = viaCredential.routeToolName;
        }
      }
      if (!serverInfo || !tool) {
        throw new routing.ToolUnavailableError(
          `Tool not available: ${request.params.name}`,
          routing.classifyUnavailableReason(request.params.name),
        );
      }
      if (serverInfo.builtin || ylune.isYlunePlatformServerName(serverInfo.name)) {
        const routed =
          ylune.matchYlunePlatformTool(routeToolName) ||
          ylune.matchYlunePlatformTool(request.params.name);
        if (!routed) {
          throw new routing.ToolUnavailableError(
            `Tool not available: ${request.params.name}`,
            'tool-not-found',
          );
        }
        return fulfillYlunePlatformCall(routed, request.params.arguments, request.params.name);
      }
      routing.assertToolAvailableForRoute(tool, appsRouteContext);

      serverInfo.lastUsedAt = runtime.now();

      if (serverInfo.openApiClient) {
        if (serverInfo.config?.startOnDemand && serverInfo.status !== 'connected') {
          await clients.ensureServerReady(serverInfo);
        }
        const openApiClient = serverInfo.openApiClient;
        const cleanToolName = routing.normalizeToolNameForServer(serverInfo.name, routeToolName);
        const finalArgs = await applyResourceAccess(serverInfo.name, request.params.arguments);

        logging.log('Invoking OpenAPI tool', {
          toolName: cleanToolName,
          serverName: serverInfo.name,
          arguments: logging.summarizeArgumentsForLogging(finalArgs),
        });

        let passthroughHeaders: Record<string, string> | undefined;
        let requestHeaders: Record<string, string | string[] | undefined> | null = null;

        if (extra?.headers) {
          requestHeaders = extra.headers;
        } else {
          requestHeaders = requestContextService.getHeaders();
        }

        if (requestHeaders && serverInfo.config?.openapi?.passthroughHeaders) {
          passthroughHeaders = {};
          for (const headerName of serverInfo.config.openapi.passthroughHeaders) {
            const headerValue =
              requestHeaders[headerName] || requestHeaders[headerName.toLowerCase()];
            if (headerValue) {
              passthroughHeaders[headerName] = Array.isArray(headerValue)
                ? headerValue[0]
                : String(headerValue);
            }
          }
        }

        await reserveHostedIfNeeded(serverInfo.name, cleanToolName);
        const result = await openApiClient.callTool(
          cleanToolName,
          finalArgs,
          passthroughHeaders,
          false,
          cookieSessionId,
        );
        await settleHostedIfNeeded({
          success: true,
          requestContent: finalArgs,
          responseContent: result,
        });

        logging.log('OpenAPI tool invocation result', {
          serverName: serverInfo.name,
          toolName: cleanToolName,
          result: logging.summarizeToolResultForLogging(result),
        });

        const duration = runtime.now() - startTime;
        await logToolCall({
          server: serverInfo.name,
          tool: cleanToolName,
          duration,
          status: 'success',
          input: finalArgs,
          output: result,
          group,
          username,
          keyId,
          keyName,
          sourceIp,
        });

        return await compression.maybeCompressToolResult(
          {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result),
              },
            ],
          },
          {
            serverName: serverInfo.name,
            toolName: cleanToolName,
            group,
          },
        );
      }

      const cleanToolName = routing.normalizeToolNameForServer(serverInfo.name, routeToolName);
      const finalArgs = await applyResourceAccess(serverInfo.name, request.params.arguments);
      if (
        !resourceChain.credentialId &&
        serverInfo.config?.startOnDemand &&
        serverInfo.status !== 'connected'
      ) {
        await clients.ensureServerReady(serverInfo);
      }
      const isolatedCtx = await resolveCallClient(serverInfo);
      await reserveHostedIfNeeded(serverInfo.name, cleanToolName);
      const result = await clients.callToolWithReconnect(
        serverInfo,
        { ...request.params, name: cleanToolName, arguments: finalArgs },
        serverInfo.options || {},
        1,
        isolatedCtx,
      );
      await settleHostedIfNeeded({
        success: !result.isError,
        requestContent: finalArgs,
        responseContent: result,
      });
      logging.log('Tool call result', {
        serverName: serverInfo.name,
        toolName: cleanToolName,
        result: logging.summarizeToolResultForLogging(result),
      });

      clients.scheduleIdleShutdown(serverInfo);

      const duration = runtime.now() - startTime;
      await logToolCall({
        server: serverInfo.name,
        tool: cleanToolName,
        duration,
        status: result.isError ? 'error' : 'success',
        input: finalArgs,
        output: result,
        group,
        username,
        keyId,
        keyName,
        sourceIp,
        errorMessage: result.isError ? 'Tool returned error response' : undefined,
      });

      return await compression.maybeCompressToolResult(result, {
        serverName: serverInfo.name,
        toolName: cleanToolName,
        group,
      });
    } catch (error) {
      const unavailable =
        error instanceof routing.ToolUnavailableError
          ? { message: error.message, reason: error.reason }
          : undefined;
      logging.error('Error handling CallToolRequest', {
        ...logging.summarizeErrorForLogging(error),
        ...(unavailable ? { reason: unavailable.reason } : {}),
      });

      const duration = runtime.now() - startTime;
      await settleHostedIfNeeded({
        success: false,
        requestContent: getActivityInputFromToolRequest(request),
        responseContent: { error: logging.formatErrorForLogging(error) },
      });
      const activityToolName = getActivityToolNameFromRequest(request);
      const serverInfo =
        (typeof extra?.server === 'string' ? registry.getServerByName(extra.server) : undefined) ||
        registry.getServerByTool(activityToolName);
      const separator = runtime.getNameSeparator();
      const prefix = serverInfo ? `${serverInfo.name}${separator}` : undefined;
      const cleanToolName =
        prefix && activityToolName.startsWith(prefix)
          ? activityToolName.substring(prefix.length)
          : activityToolName;

      await logToolCall({
        server: serverInfo?.name || 'unknown',
        tool: cleanToolName,
        duration,
        status: 'error',
        input: getActivityInputFromToolRequest(request),
        group,
        username,
        keyId,
        keyName,
        sourceIp,
        errorMessage: unavailable
          ? `${unavailable.message} (reason: ${unavailable.reason})`
          : error instanceof access.ResourceBindingDeniedError
            ? error.message
            : logging.formatErrorForLogging(error),
      });

      const safeErrorText = unavailable
        ? unavailable.message
        : logging.formatErrorForLogging(error);

      return {
        content: [
          {
            type: 'text',
            text: `Error: ${safeErrorText}`,
          },
        ],
        isError: true,
      };
    }
  };
};

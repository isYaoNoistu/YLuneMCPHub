import type {
  BuiltinPrompt,
  BuiltinResource,
  IGroupServerConfig,
  Prompt,
  Resource,
  ServerConfig,
  ServerInfo,
  Tool,
} from '../../types/index.js';
import {
  filterPromptsByEnabledConfig,
  filterResourcesByEnabledConfig,
  getGroupLookupName,
  normalizePromptForList,
  normalizeQualifiedNameForServer,
  normalizeResourceForList,
  projectQualifiedNameForGroup,
} from './capabilityFilters.js';

export type FilteredGroupServersResult = {
  filteredServerInfos: ServerInfo[];
  serverConfigsByName: Map<string, IGroupServerConfig>;
};

export type McpAppsRouteContext = {
  enabled: boolean;
  serverInfo?: ServerInfo;
  serverInfos?: ServerInfo[];
};

type ToolUnavailableErrorLike = Error & { reason: string };
type ToolUnavailableErrorConstructor = new (
  message: string,
  reason: string,
) => ToolUnavailableErrorLike;

type PromptResolution = {
  serverInfo: ServerInfo;
  promptName: string;
};

export type McpListHandlerDependencies = {
  ensureEffectiveAccess: () => Promise<unknown>;
  getGroup: (sessionId: string) => string | undefined;
  log: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
  getNameSeparator: () => string;
  isSmartRoutingGroup: (group?: string) => boolean;
  getSmartRoutingTools: (group?: string) => Promise<any> | any;
  getFilteredServerInfosForGroup: (
    group: string | undefined,
    options?: { requireClient?: boolean },
  ) => Promise<FilteredGroupServersResult>;
  getMcpAppsRouteContext: (
    sessionId: string,
    group: string | undefined,
  ) => Promise<McpAppsRouteContext>;
  callerCanUseYlunePlatform: () => Promise<boolean>;
  isYlunePlatformServerName: (name: string) => boolean;
  listToolsViaAssignedCredential: (
    serverInfo: ServerInfo,
  ) => Promise<Tool[] | null | undefined>;
  summarizeErrorForLogging: (error: unknown) => unknown;
  formatErrorForLogging: (error: unknown) => string;
  getServerConfig: (serverName: string) => Promise<ServerConfig | null | undefined>;
  filterToolsByConfig: (serverName: string, tools: Tool[]) => Promise<Tool[]>;
  filterToolsByGroup: (
    group: string | undefined,
    serverName: string,
    tools: Tool[],
    serverConfig?: IGroupServerConfig,
  ) => Promise<Tool[]>;
  filterPromptsByGroup: (
    group: string | undefined,
    serverName: string,
    prompts: Prompt[],
    serverConfig?: IGroupServerConfig,
  ) => Promise<Prompt[]>;
  filterResourcesByGroup: (
    group: string | undefined,
    serverName: string,
    resources: Resource[],
    serverConfig?: IGroupServerConfig,
  ) => Promise<Resource[]>;
  resolveDescriptionOverride: (
    defaultDescription: string | undefined,
    config?: { description?: string },
  ) => string;
  isAppOnlyTool: (tool: Tool) => boolean;
  stripMcpAppsMetadata: <T extends { _meta?: Record<string, unknown> }>(value: T) => T;
  getBuiltinPrompts: () => Promise<BuiltinPrompt[]>;
  getBuiltinPromptByName: (name: string) => Promise<BuiltinPrompt | null | undefined>;
  getBuiltinResources: () => Promise<BuiltinResource[]>;
  getBuiltinResourceByUri: (uri: string) => Promise<BuiltinResource | null | undefined>;
  getVisibleServerByName: (name: string) => ServerInfo | undefined;
  getVisibleServerInfos: () => ServerInfo[];
  resolvePromptInGroup: (
    group: string | undefined,
    promptName: string,
  ) => Promise<PromptResolution | undefined>;
  classifyUnavailableReason: (qualifiedName: string) => string;
  ToolUnavailableError: ToolUnavailableErrorConstructor;
  summarizeArgumentsForLogging: (args: unknown) => unknown;
  summarizePromptForLogging: (prompt: unknown) => unknown;
};

export const createMcpListHandlers = (deps: McpListHandlerDependencies) => {
  const projectToolForDownstream = (
    serverName: string,
    tool: Tool,
    appsRouteContext: McpAppsRouteContext,
    serverConfig?: IGroupServerConfig,
  ): Tool | undefined => {
    if (!appsRouteContext.enabled && deps.isAppOnlyTool(tool)) {
      return undefined;
    }

    const projectedTool = appsRouteContext.enabled ? tool : deps.stripMcpAppsMetadata(tool);
    if (appsRouteContext.serverInfo) {
      return {
        ...projectedTool,
        name: normalizeQualifiedNameForServer(
          serverName,
          projectedTool.name,
          deps.getNameSeparator(),
        ),
      };
    }

    return {
      ...projectedTool,
      name: projectQualifiedNameForGroup(
        projectedTool.name,
        serverName,
        deps.getNameSeparator(),
        serverConfig,
      ),
    };
  };

  const handleListToolsRequest = async (_request: any, extra: any) => {
    await deps.ensureEffectiveAccess();
    const sessionId = extra.sessionId || '';
    const group = deps.getGroup(sessionId);
    deps.log(`Handling ListToolsRequest for group: ${group}`);

    if (deps.isSmartRoutingGroup(group)) {
      return deps.getSmartRoutingTools(group);
    }

    const { filteredServerInfos, serverConfigsByName } =
      await deps.getFilteredServerInfosForGroup(group);
    const appsRouteContext = await deps.getMcpAppsRouteContext(sessionId, group);

    await Promise.allSettled(
      filteredServerInfos
        .filter(
          (serverInfo) =>
            serverInfo.config?.startOnDemand === true &&
            serverInfo.tools.length === 0 &&
            serverInfo.spawningPromise,
        )
        .map((serverInfo) => serverInfo.spawningPromise as Promise<void>),
    );

    const allTools: Tool[] = [];
    const allowYlunePlatform = await deps.callerCanUseYlunePlatform();
    for (const serverInfo of filteredServerInfos) {
      if (deps.isYlunePlatformServerName(serverInfo.name) && !allowYlunePlatform) {
        continue;
      }

      let runtimeTools = serverInfo.tools || [];
      if (runtimeTools.length === 0 && !deps.isYlunePlatformServerName(serverInfo.name)) {
        try {
          runtimeTools = (await deps.listToolsViaAssignedCredential(serverInfo)) || [];
        } catch (error) {
          deps.warn('Failed to list tools via assigned credential', {
            serverName: serverInfo.name,
            error: deps.summarizeErrorForLogging(error),
          });
        }
      }
      if (runtimeTools.length === 0) {
        continue;
      }

      const groupServerConfig = serverConfigsByName.get(serverInfo.name);
      let tools = await deps.filterToolsByConfig(serverInfo.name, runtimeTools);
      tools = await deps.filterToolsByGroup(
        group,
        serverInfo.name,
        tools,
        groupServerConfig,
      );

      const serverConfig = await deps.getServerConfig(serverInfo.name);
      const toolsWithCustomDescriptions = tools.map((tool) => ({
        ...tool,
        description: deps.resolveDescriptionOverride(
          tool.description,
          serverConfig?.tools?.[tool.name],
        ),
      }));

      allTools.push(
        ...toolsWithCustomDescriptions.flatMap((tool) => {
          const projectedTool = projectToolForDownstream(
            serverInfo.name,
            tool,
            appsRouteContext,
            groupServerConfig,
          );
          return projectedTool ? [projectedTool] : [];
        }),
      );
    }

    return { tools: allTools };
  };

  const handleGetPromptRequest = async (request: any, extra: any) => {
    try {
      await deps.ensureEffectiveAccess();
      const { name, arguments: promptArgs } = request.params;
      const sessionId = extra?.sessionId || '';
      const group = extra?.group || deps.getGroup(sessionId) || undefined;

      const builtinPrompt = await deps.getBuiltinPromptByName(name);
      if (builtinPrompt && builtinPrompt.enabled !== false) {
        let content = builtinPrompt.template;
        if (promptArgs) {
          for (const [key, value] of Object.entries(promptArgs)) {
            content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), String(value));
          }
        }
        return {
          messages: [
            {
              role: 'user',
              content: { type: 'text', text: content },
            },
          ],
        };
      }

      let server: ServerInfo | undefined;
      let promptNameForServer = name;
      const lookupGroup = getGroupLookupName(group);
      if (extra?.server) {
        server = deps.getVisibleServerByName(extra.server);
      } else if (lookupGroup) {
        const groupPrompt = await deps.resolvePromptInGroup(lookupGroup, name);
        if (groupPrompt) {
          server = groupPrompt.serverInfo;
          promptNameForServer = groupPrompt.promptName;
        }
      } else {
        server = deps
          .getVisibleServerInfos()
          .find(
            (serverInfo) =>
              serverInfo.status === 'connected' &&
              serverInfo.enabled !== false &&
              serverInfo.prompts.find((prompt) => prompt.name === name),
          );
      }
      if (!server) {
        throw new deps.ToolUnavailableError(
          `Prompt not available: ${name}`,
          deps.classifyUnavailableReason(name),
        );
      }

      const cleanPromptName = normalizeQualifiedNameForServer(
        server.name,
        promptNameForServer,
        deps.getNameSeparator(),
      );
      const promptParams = {
        name: cleanPromptName || '',
        arguments: promptArgs,
      };
      deps.log('Calling getPrompt with params', {
        name: cleanPromptName || '',
        arguments: deps.summarizeArgumentsForLogging(promptArgs),
      });
      const prompt = await server.client?.getPrompt(promptParams);
      deps.log('Received prompt', deps.summarizePromptForLogging(prompt));
      if (!prompt) {
        throw new Error(`Prompt not found: ${cleanPromptName}`);
      }

      return prompt;
    } catch (error) {
      const unavailable =
        error instanceof deps.ToolUnavailableError
          ? { message: error.message, reason: error.reason }
          : undefined;
      deps.error('Error handling GetPromptRequest', {
        ...(deps.summarizeErrorForLogging(error) as Record<string, unknown>),
        ...(unavailable ? { reason: unavailable.reason } : {}),
      });
      const safeErrorText = unavailable
        ? unavailable.message
        : deps.formatErrorForLogging(error);
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

  const handleListPromptsRequest = async (_request: any, extra: any) => {
    await deps.ensureEffectiveAccess();
    const sessionId = extra.sessionId || '';
    const group = deps.getGroup(sessionId);
    const lookupGroup = getGroupLookupName(group);
    deps.log(`Handling ListPromptsRequest for group: ${group}`);

    const builtinPrompts = await deps.getBuiltinPrompts();
    const allPrompts: any[] = builtinPrompts.map((prompt) =>
      normalizePromptForList({
        name: prompt.name,
        title: prompt.title,
        description: prompt.description,
        arguments: prompt.arguments,
      }),
    );

    const { filteredServerInfos, serverConfigsByName } =
      await deps.getFilteredServerInfosForGroup(lookupGroup);

    for (const serverInfo of filteredServerInfos) {
      if (!serverInfo.prompts?.length) {
        continue;
      }

      const groupServerConfig = serverConfigsByName.get(serverInfo.name);
      const serverConfig = await deps.getServerConfig(serverInfo.name);
      let enabledPrompts = filterPromptsByEnabledConfig(
        serverInfo.prompts,
        serverConfig?.prompts,
      );

      enabledPrompts = await deps.filterPromptsByGroup(
        lookupGroup,
        serverInfo.name,
        enabledPrompts,
        groupServerConfig,
      );

      allPrompts.push(
        ...enabledPrompts.map((prompt) => {
          const promptConfig = serverConfig?.prompts?.[prompt.name];
          return normalizePromptForList({
            ...prompt,
            name: projectQualifiedNameForGroup(
              prompt.name,
              serverInfo.name,
              deps.getNameSeparator(),
              groupServerConfig,
            ),
            description: promptConfig?.description || prompt.description,
          });
        }),
      );
    }

    return { prompts: allPrompts };
  };

  const handleListResourcesRequest = async (_request: any, extra: any) => {
    await deps.ensureEffectiveAccess();
    const sessionId = extra.sessionId || '';
    const group = deps.getGroup(sessionId);
    const lookupGroup = getGroupLookupName(group);
    deps.log(`Handling ListResourcesRequest for group: ${group}`);
    const appsRouteContext = await deps.getMcpAppsRouteContext(sessionId, group);

    const builtinResources = await deps.getBuiltinResources();
    const allResources: any[] = builtinResources.map((resource) =>
      normalizeResourceForList({
        uri: resource.uri,
        name: resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      }),
    );

    const { filteredServerInfos, serverConfigsByName } =
      await deps.getFilteredServerInfosForGroup(lookupGroup);

    for (const serverInfo of filteredServerInfos) {
      if (!serverInfo.resources?.length) {
        continue;
      }

      const serverConfig = await deps.getServerConfig(serverInfo.name);
      let enabledResources = filterResourcesByEnabledConfig(
        serverInfo.resources,
        serverConfig?.resources,
      );

      enabledResources = await deps.filterResourcesByGroup(
        lookupGroup,
        serverInfo.name,
        enabledResources,
        serverConfigsByName.get(serverInfo.name),
      );

      allResources.push(
        ...enabledResources.map((resource) => {
          const resourceConfig = serverConfig?.resources?.[resource.uri];
          const normalizedResource = normalizeResourceForList({
            ...resource,
            description: resourceConfig?.description || resource.description,
          });
          return appsRouteContext.enabled
            ? normalizedResource
            : deps.stripMcpAppsMetadata(normalizedResource);
        }),
      );
    }

    return { resources: allResources };
  };

  const handleReadResourceRequest = async (request: any, extra: any) => {
    try {
      await deps.ensureEffectiveAccess();
      const { uri } = request.params;
      const sessionId = extra.sessionId || '';
      const group = deps.getGroup(sessionId);
      const lookupGroup = getGroupLookupName(group);
      const appsRouteContext = await deps.getMcpAppsRouteContext(sessionId, group);

      const builtinResource = await deps.getBuiltinResourceByUri(uri);
      if (builtinResource && builtinResource.enabled !== false) {
        return {
          contents: [
            {
              uri: builtinResource.uri,
              mimeType: builtinResource.mimeType || 'text/plain',
              text: builtinResource.content,
            },
          ],
        };
      }

      const { filteredServerInfos, serverConfigsByName } =
        await deps.getFilteredServerInfosForGroup(lookupGroup);

      let server: ServerInfo | undefined;
      for (const serverInfo of filteredServerInfos) {
        if (serverInfo.status !== 'connected') {
          continue;
        }
        const serverConfig = await deps.getServerConfig(serverInfo.name);
        let enabledResources = filterResourcesByEnabledConfig(
          serverInfo.resources,
          serverConfig?.resources,
        );
        enabledResources = await deps.filterResourcesByGroup(
          lookupGroup,
          serverInfo.name,
          enabledResources,
          serverConfigsByName.get(serverInfo.name),
        );
        if (enabledResources.some((resource) => resource.uri === uri)) {
          server = serverInfo;
          break;
        }
      }

      let result: any;
      if (server?.client) {
        result = await server.client.readResource({ uri });
        if (!result || !Array.isArray(result.contents)) {
          throw new Error(`Failed to read resource: ${uri}`);
        }
      } else if (appsRouteContext.enabled && uri.startsWith('ui://')) {
        const candidates = appsRouteContext.serverInfo
          ? [appsRouteContext.serverInfo]
          : (appsRouteContext.serverInfos ?? []);

        for (const candidate of candidates) {
          if (!candidate.client) {
            continue;
          }
          try {
            const candidateResult = await candidate.client.readResource({ uri });
            if (candidateResult && Array.isArray(candidateResult.contents)) {
              result = candidateResult;
              break;
            }
          } catch {
            // This candidate does not own the resource; try the next one.
          }
        }

        if (!result) {
          throw new Error(`Resource not found: ${uri}`);
        }
      } else {
        throw new Error(`Resource not found: ${uri}`);
      }

      return appsRouteContext.enabled
        ? result
        : {
            ...result,
            contents: result.contents.map((content: { _meta?: Record<string, unknown> }) =>
              deps.stripMcpAppsMetadata(content),
            ),
          };
    } catch (error) {
      deps.error('Error handling ReadResourceRequest', deps.summarizeErrorForLogging(error));
      const safeErrorText = deps.formatErrorForLogging(error);
      return {
        contents: [
          {
            uri: request.params?.uri || '',
            mimeType: 'text/plain',
            text: `Error: ${safeErrorText}`,
          },
        ],
      };
    }
  };

  return {
    handleGetPromptRequest,
    handleListPromptsRequest,
    handleListResourcesRequest,
    handleListToolsRequest,
    handleReadResourceRequest,
  };
};

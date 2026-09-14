import type { IGroupServerConfig, Resource, Tool } from '../../types/index.js';

type PromptForList = {
  name: string;
  title?: string;
  description?: string;
  arguments?: any[];
  [key: string]: unknown;
};

type ResourceForList = {
  uri: string;
  name?: string | null;
  description?: string | null;
  mimeType?: string | null;
  [key: string]: unknown;
};

type ResourceTemplate = {
  uriTemplate?: string;
  _meta?: Record<string, unknown>;
};

type CapabilityConfig = {
  enabled?: boolean;
};

export const normalizePromptForList = (prompt: PromptForList) => ({
  ...prompt,
  name: prompt.name,
  title: prompt.title || prompt.name,
  description: prompt.description || '',
  arguments: Array.isArray(prompt.arguments) ? prompt.arguments : [],
});

export const normalizeResourceForList = (resource: ResourceForList): Resource => ({
  ...resource,
  uri: resource.uri,
  name: resource.name || '',
  description: resource.description || '',
  mimeType: resource.mimeType || '',
});

export const getGroupLookupName = (group: string | undefined): string | undefined => {
  if (group === '$smart') {
    return undefined;
  }
  if (group?.startsWith('$smart/')) {
    return group.substring(7) || undefined;
  }
  return group;
};

export const normalizeQualifiedNameForServer = (
  serverName: string,
  name: string,
  separator: string,
): string => {
  const prefix = `${serverName}${separator}`;
  return name.startsWith(prefix) ? name.substring(prefix.length) : name;
};

const getExposedServerName = (
  serverName: string,
  serverConfig?: IGroupServerConfig,
): string => serverConfig?.alias?.trim() || serverName;

const replacePrefixedServerName = (
  name: string,
  fromServerName: string,
  toServerName: string,
  separator: string,
): string => {
  if (fromServerName === toServerName) {
    return name;
  }

  const prefix = `${fromServerName}${separator}`;
  return name.startsWith(prefix)
    ? `${toServerName}${separator}${name.substring(prefix.length)}`
    : name;
};

export const projectQualifiedNameForGroup = (
  name: string,
  serverName: string,
  separator: string,
  serverConfig?: IGroupServerConfig,
): string =>
  replacePrefixedServerName(
    name,
    serverName,
    getExposedServerName(serverName, serverConfig),
    separator,
  );

export const resolveQualifiedNameFromGroup = (
  name: string,
  serverName: string,
  separator: string,
  serverConfig?: IGroupServerConfig,
): string =>
  replacePrefixedServerName(
    name,
    getExposedServerName(serverName, serverConfig),
    serverName,
    separator,
  );

export const filterToolsByEnabledConfig = (
  tools: Tool[],
  toolConfigs?: Record<string, CapabilityConfig>,
): Tool[] => {
  if (!toolConfigs) {
    return tools;
  }
  return tools.filter((tool) => toolConfigs[tool.name]?.enabled !== false);
};

export const filterPromptsByEnabledConfig = <TPrompt extends { name: string }>(
  prompts: TPrompt[],
  promptConfigs?: Record<string, CapabilityConfig>,
): TPrompt[] => {
  if (!promptConfigs) {
    return prompts;
  }
  return prompts.filter((prompt) => promptConfigs[prompt.name]?.enabled !== false);
};

export const filterResourcesByEnabledConfig = <TResource extends { uri: string }>(
  resources: TResource[],
  resourceConfigs?: Record<string, CapabilityConfig>,
): TResource[] => {
  if (!resourceConfigs) {
    return resources;
  }
  return resources.filter((resource) => resourceConfigs[resource.uri]?.enabled !== false);
};

export const filterToolsByGroupSelection = (
  serverName: string,
  tools: Tool[],
  serverConfig: IGroupServerConfig | undefined,
  separator: string,
): Tool[] => {
  if (serverConfig?.tools === 'all' || !Array.isArray(serverConfig?.tools)) {
    return tools;
  }

  const allowedToolNames = new Set(
    serverConfig.tools.map((toolName) => `${serverName}${separator}${toolName}`),
  );
  return tools.filter((tool) => allowedToolNames.has(tool.name));
};

export const filterPromptsByGroupSelection = <TPrompt extends { name: string }>(
  serverName: string,
  prompts: TPrompt[],
  serverConfig: IGroupServerConfig | undefined,
  separator: string,
): TPrompt[] => {
  if (serverConfig?.prompts === 'all' || !Array.isArray(serverConfig?.prompts)) {
    return prompts;
  }

  const allowedPromptNames = new Set(serverConfig.prompts);
  return prompts.filter((prompt) =>
    allowedPromptNames.has(normalizeQualifiedNameForServer(serverName, prompt.name, separator)),
  );
};

export const filterResourcesByGroupSelection = <TResource extends { uri: string }>(
  resources: TResource[],
  serverConfig?: IGroupServerConfig,
): TResource[] => {
  if (serverConfig?.resources === 'all' || !Array.isArray(serverConfig?.resources)) {
    return resources;
  }

  const allowedResources = new Set(serverConfig.resources);
  return resources.filter((resource) => allowedResources.has(resource.uri));
};

const resourceTemplateMatchesSelection = (
  uriTemplate: string,
  allowedResources: Set<string>,
): boolean => {
  if (allowedResources.has(uriTemplate)) {
    return true;
  }

  const dynamicSegmentIndex = uriTemplate.search(/[{*]/);
  if (dynamicSegmentIndex === -1) {
    return false;
  }

  const staticPrefix = uriTemplate.slice(0, dynamicSegmentIndex);
  if (!staticPrefix) {
    return false;
  }

  for (const resourceUri of allowedResources) {
    if (resourceUri.startsWith(staticPrefix)) {
      return true;
    }
  }

  return false;
};

export const filterResourceTemplatesByGroupSelection = <
  TResourceTemplate extends ResourceTemplate,
>(
  group: string | undefined,
  resourceTemplates: TResourceTemplate[],
  serverConfig?: IGroupServerConfig,
): TResourceTemplate[] => {
  if (
    !group ||
    serverConfig?.resources === 'all' ||
    !Array.isArray(serverConfig?.resources)
  ) {
    return resourceTemplates;
  }
  if (serverConfig.resources.length === 0) {
    return [];
  }

  const allowedResources = new Set(serverConfig.resources);
  return resourceTemplates.filter(
    (resourceTemplate) =>
      typeof resourceTemplate.uriTemplate === 'string' &&
      resourceTemplateMatchesSelection(resourceTemplate.uriTemplate, allowedResources),
  );
};

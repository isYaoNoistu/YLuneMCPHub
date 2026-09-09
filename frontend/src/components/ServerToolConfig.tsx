import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { IGroupServerConfig, Prompt, Resource, Server, ServerCost, Tool } from '@/types';
import { MessageSquare, FileText, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useSettingsData } from '@/hooks/useSettingsData';
import { formatTokens } from '@/utils/contextCost';
import { getToolDescriptionInfo } from '@/utils/toolDescription';

type CapabilityKey = 'tools' | 'prompts' | 'resources';

const EMPTY_SELECTIONS: Pick<IGroupServerConfig, CapabilityKey> = {
  tools: [],
  prompts: [],
  resources: [],
};

const FULL_SELECTIONS: Pick<IGroupServerConfig, CapabilityKey> = {
  tools: 'all',
  prompts: 'all',
  resources: 'all',
};

interface ServerToolConfigProps {
  servers: Server[];
  value: string[] | IGroupServerConfig[];
  onChange: (value: IGroupServerConfig[]) => void;
  className?: string;
  serverCosts?: ServerCost[];
}

interface CapabilityItem {
  key: string;
  value: string;
  description?: string;
  defaultDescription?: string;
  hasDescriptionOverride?: boolean;
}

export const ServerToolConfig: React.FC<ServerToolConfigProps> = ({
  servers,
  value,
  onChange,
  className,
  serverCosts = [],
}) => {
  const { t } = useTranslation();
  const { nameSeparator } = useSettingsData();
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set());

  // Normalize current value to IGroupServerConfig[] format
  const normalizedValue: IGroupServerConfig[] = React.useMemo(() => {
    return value.map((item) => {
      if (typeof item === 'string') {
        return { name: item, ...FULL_SELECTIONS };
      }
      return {
        ...item,
        tools: item.tools || 'all',
        prompts: item.prompts || 'all',
        resources: item.resources || 'all',
      };
    });
  }, [value]);

  // Get available servers (enabled only)
  const availableServers = React.useMemo(
    () => servers.filter((server) => server.enabled !== false),
    [servers],
  );

  // Clean up expanded servers when servers are removed from configuration
  // But keep servers that were explicitly expanded even if they have no configuration
  React.useEffect(() => {
    const configuredServerNames = new Set(normalizedValue.map((config) => config.name));
    const availableServerNames = new Set(availableServers.map((server) => server.name));

    setExpandedServers((prev) => {
      const newSet = new Set<string>();
      prev.forEach((serverName) => {
        // Keep expanded if server is configured OR if server exists and user manually expanded it
        if (configuredServerNames.has(serverName) || availableServerNames.has(serverName)) {
          newSet.add(serverName);
        }
      });
      return newSet;
    });
  }, [normalizedValue, availableServers]);

  const toggleServer = (serverName: string) => {
    const existingIndex = normalizedValue.findIndex((config) => config.name === serverName);

    if (existingIndex >= 0) {
      // Remove server - this also removes all capability selections
      const newValue = normalizedValue.filter((config) => config.name !== serverName);
      onChange(newValue);
    } else {
      // Add server with all capabilities by default
      const newValue = [...normalizedValue, { name: serverName, ...FULL_SELECTIONS }];
      onChange(newValue);
    }
  };

  const toggleServerExpanded = (serverName: string) => {
    setExpandedServers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(serverName)) {
        newSet.delete(serverName);
      } else {
        newSet.add(serverName);
      }
      return newSet;
    });
  };

  const hasAnyCapabilitySelection = (config: IGroupServerConfig) => {
    return (['tools', 'prompts', 'resources'] as CapabilityKey[]).some((capability) => {
      const selection = config[capability];
      return selection === 'all' || (Array.isArray(selection) && selection.length > 0);
    });
  };

  const updateServerCapability = (
    serverName: string,
    capability: CapabilityKey,
    selection: string[] | 'all',
    keepExpanded = false,
  ) => {
    const existingServer = normalizedValue.find((config) => config.name === serverName);
    const baseConfig: IGroupServerConfig = existingServer
      ? { ...existingServer }
      : { name: serverName, ...EMPTY_SELECTIONS };
    const nextConfig: IGroupServerConfig = {
      ...baseConfig,
      [capability]: selection,
    };

    if (!hasAnyCapabilitySelection(nextConfig)) {
      const newValue = normalizedValue.filter((config) => config.name !== serverName);
      onChange(newValue);
      if (!keepExpanded) {
        setExpandedServers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(serverName);
          return newSet;
        });
      }
      return;
    }

    if (existingServer) {
      onChange(normalizedValue.map((config) => (config.name === serverName ? nextConfig : config)));
      return;
    }

    onChange([...normalizedValue, nextConfig]);
  };

  const updateServerAlias = (serverName: string, alias: string) => {
    const existingServer = normalizedValue.find((config) => config.name === serverName);
    if (!existingServer) return;

    const nextConfig: IGroupServerConfig = { ...existingServer };
    if (alias) {
      nextConfig.alias = alias;
    } else {
      delete nextConfig.alias;
    }

    onChange(normalizedValue.map((config) => (config.name === serverName ? nextConfig : config)));
  };

  const normalizeNamedCapability = (serverName: string, name: string) => {
    const prefix = `${serverName}${nameSeparator}`;
    return name.startsWith(prefix) ? name.slice(prefix.length) : name;
  };

  const getCapabilityItems = (server: Server, capability: CapabilityKey): CapabilityItem[] => {
    if (capability === 'tools') {
      return (server.tools || [])
        .filter((tool) => tool.enabled !== false)
        .map((tool: Tool) => ({
          key: tool.name,
          value: normalizeNamedCapability(server.name, tool.name),
          description: tool.description,
          defaultDescription: tool.defaultDescription,
          hasDescriptionOverride: tool.hasDescriptionOverride,
        }));
    }

    if (capability === 'prompts') {
      return (server.prompts || [])
        .filter((prompt) => prompt.enabled !== false)
        .map((prompt: Prompt) => ({
          key: prompt.name,
          value: normalizeNamedCapability(server.name, prompt.name),
          description: prompt.description,
        }));
    }

    return (server.resources || [])
      .filter((resource) => resource.enabled !== false)
      .map((resource: Resource) => ({
        key: resource.uri,
        value: resource.uri,
        description: resource.description,
      }));
  };

  // Build one nested map (server -> item name -> cost) once per serverCosts change,
  // so per-render lookups don't rebuild a Map on every call (avoids O(N^2) churn).
  const serverCostsMap = React.useMemo(() => {
    const outerMap = new Map<string, Map<string, number>>();
    serverCosts.forEach((sc) => {
      const innerMap = new Map<string, number>();
      sc.items.forEach((i) => innerMap.set(i.name, i.cost));
      outerMap.set(sc.name, innerMap);
    });
    return outerMap;
  }, [serverCosts]);

  const costMapForServer = (serverName: string): Map<string, number> =>
    serverCostsMap.get(serverName) ?? new Map<string, number>();

  const getSelectedCapabilityCost = (server: Server, capability: CapabilityKey): number => {
    const costMap = costMapForServer(server.name);
    return getCapabilityItems(server, capability)
      .filter((item) => isCapabilityItemSelected(server.name, capability, item.value))
      .reduce((sum, item) => sum + (costMap.get(item.key) ?? 0), 0);
  };

  const getServerSelectedCost = (server: Server): number =>
    (['tools', 'prompts', 'resources'] as CapabilityKey[]).reduce(
      (sum, cap) => sum + getSelectedCapabilityCost(server, cap),
      0,
    );

  const toggleCapabilityItem = (
    serverName: string,
    capability: CapabilityKey,
    itemValue: string,
  ) => {
    const server = availableServers.find((s) => s.name === serverName);
    if (!server) return;

    const allItems = getCapabilityItems(server, capability).map((item) => item.value);
    const serverConfig = normalizedValue.find((config) => config.name === serverName);

    if (!serverConfig) {
      updateServerCapability(serverName, capability, [itemValue]);
      return;
    }

    const currentSelection = serverConfig[capability];
    if (currentSelection === 'all') {
      const nextSelection = allItems.filter((value) => value !== itemValue);
      updateServerCapability(serverName, capability, nextSelection);
      return;
    }

    if (Array.isArray(currentSelection)) {
      if (currentSelection.includes(itemValue)) {
        updateServerCapability(
          serverName,
          capability,
          currentSelection.filter((value) => value !== itemValue),
        );
        return;
      }

      const nextSelection = [...currentSelection, itemValue];
      updateServerCapability(
        serverName,
        capability,
        nextSelection.length === allItems.length ? 'all' : nextSelection,
      );
      return;
    }

    updateServerCapability(serverName, capability, [itemValue]);
  };

  const isServerSelected = (serverName: string) => {
    const serverConfig = normalizedValue.find((config) => config.name === serverName);
    return Boolean(serverConfig && hasAnyCapabilitySelection(serverConfig));
  };

  const isServerPartiallySelected = (serverName: string) => {
    const serverConfig = normalizedValue.find((config) => config.name === serverName);
    if (!serverConfig) return false;

    return (['tools', 'prompts', 'resources'] as CapabilityKey[]).some((capability) => {
      const selection = serverConfig[capability];
      return Array.isArray(selection) && selection.length > 0;
    });
  };

  const isCapabilityItemSelected = (
    serverName: string,
    capability: CapabilityKey,
    itemValue: string,
  ) => {
    const serverConfig = normalizedValue.find((config) => config.name === serverName);
    if (!serverConfig) return false;

    const selection = serverConfig[capability];
    if (selection === 'all') return true;
    return Array.isArray(selection) ? selection.includes(itemValue) : false;
  };

  const getSelectedCapabilityCount = (server: Server, capability: CapabilityKey) => {
    const serverConfig = normalizedValue.find((config) => config.name === server.name);
    if (!serverConfig) return 0;

    const items = getCapabilityItems(server, capability);
    const selection = serverConfig[capability];
    if (selection === 'all') return items.length;
    if (Array.isArray(selection)) {
      const itemSet = new Set(items.map((item) => item.value));
      return selection.filter((item) => itemSet.has(item)).length;
    }
    return 0;
  };

  const capabilityConfigs: Array<{
    key: CapabilityKey;
    titleKey: string;
    countKey: string;
    allKey: string;
  }> = [
    {
      key: 'tools',
      titleKey: 'groups.toolSelection',
      countKey: 'groups.toolsSelected',
      allKey: 'groups.allTools',
    },
    {
      key: 'prompts',
      titleKey: 'groups.promptSelection',
      countKey: 'groups.promptsSelected',
      allKey: 'groups.allPrompts',
    },
    {
      key: 'resources',
      titleKey: 'groups.resourceSelection',
      countKey: 'groups.resourcesSelected',
      allKey: 'groups.allResources',
    },
  ];

  const getServerSummaryBadges = (server: Server) => {
    return capabilityConfigs
      .map(({ key }) => ({ key, count: getSelectedCapabilityCount(server, key) }))
      .filter((entry) => entry.count > 0);
  };

  return (
    <div className={cn(className)}>
      <div className="ylune-server-list">
        {availableServers.map((server) => {
          const isSelected = isServerSelected(server.name);
          const isPartiallySelected = isServerPartiallySelected(server.name);
          const isExpanded = expandedServers.has(server.name);
          const serverConfig = normalizedValue.find((config) => config.name === server.name);
          const summaryBadges = getServerSummaryBadges(server);
          const serverCapabilities = capabilityConfigs.filter(
            ({ key }) => getCapabilityItems(server, key).length > 0,
          );
          const costMap = costMapForServer(server.name);
          const toolTotal = getCapabilityItems(server, 'tools').length;

          return (
            <div key={server.name}>
              <div
                className={`ylune-server-row${isSelected || isPartiallySelected ? ' is-on' : ''}`}
                onClick={() => toggleServerExpanded(server.name)}
              >
                <div
                  className="ylune-server-main"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleServer(server.name);
                  }}
                >
                  <label className="ylune-check" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected || isPartiallySelected}
                      onChange={() => toggleServer(server.name)}
                    />
                  </label>
                  <span className="ylune-server-name">{server.name}</span>
                </div>

                <div className="ylune-server-meta">
                  {getServerSelectedCost(server) > 0 && (
                    <span className="hub-mono" title={t('cost.estimate')}>
                      Σ {formatTokens(getServerSelectedCost(server))}
                    </span>
                  )}
                  <span className="hub-mono">
                    {toolTotal} {t('server.tools').toLowerCase()}
                  </span>
                  {summaryBadges
                    .filter(({ key }) => key !== 'tools')
                    .map(({ key, count }) => (
                      <span key={key} className="inline-flex items-center gap-1">
                        {key === 'prompts' ? <MessageSquare size={13} /> : <FileText size={13} />}
                        {count}
                      </span>
                    ))}
                  {serverCapabilities.length > 0 && (
                    <ChevronDown
                      size={14}
                      style={{
                        transform: isExpanded ? 'rotate(180deg)' : undefined,
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  )}
                </div>
              </div>

              {isExpanded && serverCapabilities.length > 0 && (
                <div className="ylune-server-detail">
                  <div className="space-y-4">
                    {serverConfig && (
                      <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                        <label className="ylune-label">{t('groups.alias')}</label>
                        <input
                          type="text"
                          value={serverConfig.alias || ''}
                          placeholder={server.name}
                          onChange={(event) => updateServerAlias(server.name, event.target.value)}
                          className="hub-input"
                        />
                      </div>
                    )}
                    {serverCapabilities.map(({ key, titleKey, countKey, allKey }) => {
                      const items = getCapabilityItems(server, key);
                      const selectedCount = getSelectedCapabilityCount(server, key);
                      const allSelected =
                        serverConfig?.[key] === 'all' || selectedCount === items.length;

                      return (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-3">
                            <span className="settings-label">{t(titleKey)}</span>
                            <div className="ylune-server-meta">
                              {serverConfig && (
                                <span>
                                  {allSelected
                                    ? `(${t(allKey)} ${items.length}/${items.length})`
                                    : `(${t(countKey)} ${selectedCount}/${items.length})`}
                                </span>
                              )}
                              {serverConfig && getSelectedCapabilityCost(server, key) > 0 && (
                                <span className="hub-mono" title={t('cost.estimate')}>
                                  Σ {formatTokens(getSelectedCapabilityCost(server, key))}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  updateServerCapability(
                                    server.name,
                                    key,
                                    allSelected ? [] : 'all',
                                    true,
                                  );
                                }}
                                className="ylune-link-btn"
                              >
                                {allSelected ? t('groups.selectNone') : t('groups.selectAll')}
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                            {items.map((item) => {
                              const isChecked = isCapabilityItemSelected(
                                server.name,
                                key,
                                item.value,
                              );
                              const descriptionInfo =
                                key === 'tools'
                                  ? getToolDescriptionInfo(
                                      {
                                        description: item.description,
                                        defaultDescription: item.defaultDescription,
                                        hasDescriptionOverride: item.hasDescriptionOverride,
                                      },
                                      t('tool.noDescription'),
                                    )
                                  : null;
                              const descriptionTitle = descriptionInfo?.hasDescriptionOverride
                                ? t('tool.defaultDescriptionTooltip', {
                                    description: descriptionInfo.defaultDescription,
                                  })
                                : item.description;

                              return (
                                <label
                                  key={item.key}
                                  className="ylune-check"
                                  style={{ width: '100%', justifyContent: 'flex-start' }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() =>
                                      toggleCapabilityItem(server.name, key, item.value)
                                    }
                                  />
                                  <span className="break-all whitespace-nowrap flex-shrink-0">
                                    {item.value}
                                  </span>
                                  {(item.description ||
                                    descriptionInfo?.hasDescriptionOverride) && (
                                    <span className="min-w-0 flex items-center gap-1 settings-help truncate" style={{ margin: 0 }}>
                                      <span
                                        className="truncate"
                                        title={descriptionTitle || undefined}
                                      >
                                        {descriptionInfo
                                          ? descriptionInfo.currentDescription
                                          : item.description}
                                      </span>
                                      {descriptionInfo?.hasDescriptionOverride && (
                                        <span
                                          className="hub-tag muted"
                                          title={descriptionTitle || undefined}
                                        >
                                          {t('tool.descriptionModifiedBadge')}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                  {costMap.get(item.key) != null && (
                                    <span
                                      className="hub-mono whitespace-nowrap ml-auto flex-shrink-0 settings-help"
                                      style={{ margin: 0 }}
                                      title={t('cost.estimate')}
                                    >
                                      Σ {formatTokens(costMap.get(item.key)!)}
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {availableServers.length === 0 && (
        <p className="settings-help">{t('groups.noServerOptions')}</p>
      )}
    </div>
  );
};

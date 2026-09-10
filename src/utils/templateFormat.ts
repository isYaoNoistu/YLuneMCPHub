import { ConfigTemplate, TemplateGroup, TemplateServerConfig } from '../types/index.js';

export function isConfigTemplate(data: unknown): data is ConfigTemplate {
  if (!data || typeof data !== 'object') return false;
  const record = data as Record<string, unknown>;
  if (typeof record.version !== 'string') return false;
  if (typeof record.name !== 'string') return false;
  if (!record.servers || typeof record.servers !== 'object') return false;
  if (!Array.isArray(record.groups)) return false;
  return true;
}

export function isMcpSettingsBackup(
  data: unknown,
): data is { mcpServers: Record<string, TemplateServerConfig>; groups?: TemplateGroup[] } {
  return Boolean(
    data &&
      typeof data === 'object' &&
      (data as Record<string, unknown>).mcpServers &&
      typeof (data as Record<string, unknown>).mcpServers === 'object',
  );
}

export function toImportTemplate(payload: unknown): ConfigTemplate | null {
  if (isConfigTemplate(payload)) {
    return payload;
  }
  if (isMcpSettingsBackup(payload)) {
    return {
      version: '1.0',
      name: 'backup-restore',
      createdAt: new Date().toISOString(),
      servers: payload.mcpServers,
      groups: Array.isArray(payload.groups) ? payload.groups : [],
      requiredEnvVars: [],
    };
  }
  return null;
}

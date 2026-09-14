import type { Server } from '@/types';

export const MCP_APPS_MIME_TYPE = 'text/html;profile=mcp-app';

export const hasMcpAppsMetadata = (metadata?: Record<string, unknown>): boolean => {
  if (!metadata) return false;
  return Boolean(metadata.ui || metadata['ui/resourceUri']);
};

export const serverExposesMcpApp = (
  server: Pick<Server, 'tools' | 'resources'>,
): boolean => {
  return Boolean(
    server.tools?.some((tool) => hasMcpAppsMetadata(tool._meta)) ||
      server.resources?.some(
        (resource) =>
          resource.uri?.startsWith('ui://') ||
          resource.mimeType === MCP_APPS_MIME_TYPE ||
          hasMcpAppsMetadata(resource._meta),
      ),
  );
};

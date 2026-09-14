import {
  apiDelete,
  apiPost,
  apiPut,
  type ApiResponse,
} from '../utils/fetchInterceptor';

export interface CapabilityMutationResult {
  success: boolean;
  error?: string;
  description?: string;
}

interface CapabilityMutationClientOptions {
  segment: 'tools' | 'prompts' | 'resources';
  label: 'tool' | 'prompt' | 'resource';
  idKey: 'toolName' | 'promptName' | 'resourceUri';
  authenticateToggle?: boolean;
}

interface CapabilityMutationClient {
  toggle: (
    serverName: string,
    capabilityId: string,
    enabled: boolean,
  ) => Promise<CapabilityMutationResult>;
  updateDescription: (
    serverName: string,
    capabilityId: string,
    description: string,
  ) => Promise<CapabilityMutationResult>;
  resetDescription: (
    serverName: string,
    capabilityId: string,
  ) => Promise<CapabilityMutationResult>;
}

const authOptions = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem('mcphub_token')}`,
  },
});

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error occurred';

export const createCapabilityMutationClient = ({
  segment,
  label,
  idKey,
  authenticateToggle = true,
}: CapabilityMutationClientOptions): CapabilityMutationClient => {
  const endpoint = (serverName: string, capabilityId: string, action: string): string =>
    `/servers/${encodeURIComponent(serverName)}/${segment}/${encodeURIComponent(capabilityId)}/${action}`;

  const context = (serverName: string, capabilityId: string, extra = {}) => ({
    serverName,
    [idKey]: capabilityId,
    ...extra,
  });

  return {
    async toggle(serverName, capabilityId, enabled) {
      try {
        const url = endpoint(serverName, capabilityId, 'toggle');
        const response = authenticateToggle
          ? await apiPost<ApiResponse>(url, { enabled }, authOptions())
          : await apiPost<ApiResponse>(url, { enabled });
        return {
          success: response.success,
          error: response.success ? undefined : response.message,
        };
      } catch (error) {
        console.error(
          `Error toggling ${label}`,
          context(serverName, capabilityId, { enabled, error }),
        );
        return { success: false, error: errorMessage(error) };
      }
    },

    async updateDescription(serverName, capabilityId, description) {
      try {
        const response = await apiPut<ApiResponse>(
          endpoint(serverName, capabilityId, 'description'),
          { description },
          authOptions(),
        );
        return {
          success: response.success,
          error: response.success ? undefined : response.message,
        };
      } catch (error) {
        console.error(
          `Error updating ${label} description`,
          context(serverName, capabilityId, { error }),
        );
        return { success: false, error: errorMessage(error) };
      }
    },

    async resetDescription(serverName, capabilityId) {
      try {
        const response = await apiDelete<ApiResponse<{ description?: string }>>(
          endpoint(serverName, capabilityId, 'description'),
          authOptions(),
        );
        return {
          success: response.success,
          error: response.success ? undefined : response.message,
          description: response.data?.description,
        };
      } catch (error) {
        console.error(
          `Error resetting ${label} description`,
          context(serverName, capabilityId, { error }),
        );
        return { success: false, error: errorMessage(error) };
      }
    },
  };
};

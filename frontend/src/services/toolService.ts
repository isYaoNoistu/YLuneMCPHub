import { apiPost } from '../utils/fetchInterceptor';
import { createCapabilityMutationClient } from './capabilityMutationClient';

export interface ToolCallRequest {
  toolName: string;
  arguments?: Record<string, any>;
}

export interface ToolCallResult {
  success: boolean;
  content?: Array<{
    type: string;
    text?: string;
    [key: string]: any;
  }>;
  error?: string;
  message?: string;
}

const toolMutations = createCapabilityMutationClient({
  segment: 'tools',
  label: 'tool',
  idKey: 'toolName',
});

/**
 * Call a MCP tool via the call_tool API
 */
export const callTool = async (
  request: ToolCallRequest,
  server?: string,
  accessToken?: string,
): Promise<ToolCallResult> => {
  try {
    // Construct the URL with optional server parameter
    // URL-encode server and tool names to handle slashes in names (e.g., "com.atlassian/atlassian-mcp-server")
    const url = server
      ? `/tools/${encodeURIComponent(server)}/${encodeURIComponent(request.toolName)}`
      : '/tools/call';

    const response = await apiPost<any>(url, request.arguments, {
      headers: {
        Authorization: `Bearer ${accessToken || localStorage.getItem('mcphub_token')}`,
      },
    });

    if (response.success === false) {
      return {
        success: false,
        error: response.message || 'Tool call failed',
      };
    }

    return {
      success: true,
      content: response?.content || [],
    };
  } catch (error) {
    console.error('Error calling tool', { toolName: request.toolName, server, error });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

/**
 * Toggle a tool's enabled state for a specific server
 */
export const toggleTool = async (
  serverName: string,
  toolName: string,
  enabled: boolean,
): Promise<{ success: boolean; error?: string }> =>
  toolMutations.toggle(serverName, toolName, enabled);

/**
 * Update a tool's description for a specific server
 */
export const updateToolDescription = async (
  serverName: string,
  toolName: string,
  description: string,
): Promise<{ success: boolean; error?: string }> =>
  toolMutations.updateDescription(serverName, toolName, description);

/**
 * Reset a tool's description override for a specific server
 */
export const resetToolDescription = async (
  serverName: string,
  toolName: string,
): Promise<{ success: boolean; error?: string; description?: string }> =>
  toolMutations.resetDescription(serverName, toolName);

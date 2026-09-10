import { apiGet, apiPost } from '@/utils/fetchInterceptor';
import { ApiResponse, EnvPreflightItem, ToolChangeRow } from '@/types';

export const getToolChanges = (): Promise<ApiResponse<ToolChangeRow[]>> => apiGet('/tool-changes');

export const ackToolChanges = (): Promise<ApiResponse<void>> => apiPost('/tool-changes/ack', {});

export const getServerEnvPreflight = (
  name: string,
): Promise<ApiResponse<{ server: string; variables: EnvPreflightItem[] }>> =>
  apiGet(`/servers/${encodeURIComponent(name)}/env-preflight`);

export const cloneServer = (
  name: string,
  newName: string,
): Promise<ApiResponse<{ name: string }>> =>
  apiPost(`/servers/${encodeURIComponent(name)}/clone`, { newName });

export const copyUserGrants = (
  username: string,
  fromUsername: string,
): Promise<ApiResponse<unknown>> =>
  apiPost(`/users/${encodeURIComponent(username)}/copy-grants`, { fromUsername });

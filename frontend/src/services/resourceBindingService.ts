import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/utils/fetchInterceptor';
import { ApiResponse, ResourceGroup, ResourceGroupItem, ResourceTarget } from '@/types';

export const getResourceTargets = (): Promise<ApiResponse<ResourceTarget[]>> =>
  apiGet('/resource-targets');

export const createResourceTarget = (
  data: Partial<ResourceTarget>,
): Promise<ApiResponse<ResourceTarget>> => apiPost('/resource-targets', data);

export const updateResourceTarget = (
  id: string,
  data: Partial<ResourceTarget>,
): Promise<ApiResponse<ResourceTarget>> => apiPatch(`/resource-targets/${id}`, data);

export const deleteResourceTarget = (id: string): Promise<ApiResponse<void>> =>
  apiDelete(`/resource-targets/${id}`);

export const getResourceGroups = (): Promise<ApiResponse<ResourceGroup[]>> =>
  apiGet('/resource-groups');

export const createResourceGroup = (data: {
  name: string;
  description?: string;
  items?: ResourceGroupItem[];
}): Promise<ApiResponse<ResourceGroup>> => apiPost('/resource-groups', data);

export const updateResourceGroup = (
  id: string,
  data: Partial<ResourceGroup>,
): Promise<ApiResponse<ResourceGroup>> => apiPatch(`/resource-groups/${id}`, data);

export const deleteResourceGroup = (id: string): Promise<ApiResponse<void>> =>
  apiDelete(`/resource-groups/${id}`);

export const getUserResourceGroups = (username: string): Promise<ApiResponse<string[]>> =>
  apiGet(`/users/${encodeURIComponent(username)}/resource-groups`);

export const setUserResourceGroups = (
  username: string,
  groupIds: string[],
): Promise<ApiResponse<string[]>> =>
  apiPut(`/users/${encodeURIComponent(username)}/resource-groups`, { groupIds });

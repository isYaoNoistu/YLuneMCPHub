import { apiDelete, apiGet, apiPatch, apiPost } from '@/utils/fetchInterceptor';
import { ApiResponse, Credential, CredentialFormData } from '@/types';

export const checkCredentialAvailable = async (): Promise<boolean> => {
  try {
    const response = await apiGet('/credentials/available');
    return Boolean(response?.data?.available);
  } catch {
    return false;
  }
};

export const getCredentials = async (): Promise<ApiResponse<Credential[]>> =>
  apiGet('/credentials');

export const createCredential = async (
  data: CredentialFormData,
): Promise<ApiResponse<Credential>> => apiPost('/credentials', data);

export const updateCredential = async (
  id: string,
  data: { name?: string; enabled?: boolean },
): Promise<ApiResponse<Credential>> => apiPatch(`/credentials/${id}`, data);

export const replaceCredentialSecret = async (
  id: string,
  data: { username?: string; password?: string; token?: string },
): Promise<ApiResponse<Credential>> => apiPost(`/credentials/${id}/secret`, data);

export const deleteCredential = async (id: string): Promise<ApiResponse<void>> =>
  apiDelete(`/credentials/${id}`);

export const testCredential = async (
  id: string,
  probe: { host?: string; port?: number; database?: string },
): Promise<ApiResponse<{ ok: boolean; kind: string }>> =>
  apiPost(`/credentials/${id}/test`, probe);

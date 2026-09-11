import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '@/utils/fetchInterceptor';
import { ApiResponse, Credential, CredentialContract, CredentialFormData } from '@/types';

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

export const getCredentialValues = async (
  id: string,
): Promise<ApiResponse<{ name: string; pairs: Array<{ key: string; value: string }> }>> =>
  apiGet(`/credentials/${id}/values`);

export const createCredential = async (
  data: CredentialFormData,
): Promise<ApiResponse<Credential>> => apiPost('/credentials', data);

export const updateCredential = async (
  id: string,
  data: { name?: string; enabled?: boolean },
): Promise<ApiResponse<Credential>> => apiPatch(`/credentials/${id}`, data);

export const replaceCredentialSecret = async (
  id: string,
  data: { fields: Record<string, string> },
): Promise<ApiResponse<Credential>> => apiPost(`/credentials/${id}/secret`, data);

export const deleteCredential = async (id: string): Promise<ApiResponse<void>> =>
  apiDelete(`/credentials/${id}`);

export const getCredentialContracts = (): Promise<ApiResponse<CredentialContract[]>> =>
  apiGet('/credential-contracts');

export const setServerCredentials = (
  serverName: string,
  credentialIds: string[],
): Promise<ApiResponse<{ serverName: string; credentialIds: string[] }>> =>
  apiPut(`/servers/${encodeURIComponent(serverName)}/credentials`, { credentialIds });

export const testServerCredential = (
  serverName: string,
  credentialId: string,
): Promise<ApiResponse<{ ok: boolean; toolCount: number }>> =>
  apiPost(`/servers/${encodeURIComponent(serverName)}/test-credential`, { credentialId });

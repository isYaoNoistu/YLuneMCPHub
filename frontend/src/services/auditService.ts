import { apiGet } from '@/utils/fetchInterceptor';
import { AdminAuditLog, ApiResponse } from '@/types';

export const getAdminAuditLogs = (
  page = 1,
  limit = 20,
): Promise<
  ApiResponse<AdminAuditLog[]> & {
    pagination?: { page: number; limit: number; total: number; totalPages: number };
  }
> => apiGet(`/admin-audit?page=${page}&limit=${limit}`);

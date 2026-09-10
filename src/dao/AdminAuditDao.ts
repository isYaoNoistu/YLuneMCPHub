import { IAdminAuditLog } from '../types/index.js';
import { AdminAuditRepository } from '../db/repositories/AdminAuditRepository.js';

export interface AdminAuditDao {
  create(input: Omit<IAdminAuditLog, 'id' | 'timestamp'> & { timestamp?: Date }): Promise<IAdminAuditLog>;
  findPaginated(
    page: number,
    limit: number,
    filter?: { actor?: string; action?: string; resourceType?: string },
  ): Promise<{ data: IAdminAuditLog[]; total: number }>;
}

const mapAudit = (row: {
  id: string;
  timestamp: Date;
  actor: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  beforeJson?: string | null;
  afterJson?: string | null;
  sourceIp?: string | null;
}): IAdminAuditLog => ({
  id: row.id,
  timestamp: row.timestamp,
  actor: row.actor,
  action: row.action,
  resourceType: row.resourceType,
  resourceId: row.resourceId ?? null,
  beforeJson: row.beforeJson ?? null,
  afterJson: row.afterJson ?? null,
  sourceIp: row.sourceIp ?? null,
});

export class AdminAuditDaoDbImpl implements AdminAuditDao {
  private repository: AdminAuditRepository;

  constructor() {
    this.repository = new AdminAuditRepository();
  }

  async create(
    input: Omit<IAdminAuditLog, 'id' | 'timestamp'> & { timestamp?: Date },
  ): Promise<IAdminAuditLog> {
    const created = await this.repository.create({
      actor: input.actor,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      beforeJson: input.beforeJson ?? null,
      afterJson: input.afterJson ?? null,
      sourceIp: input.sourceIp ?? null,
    });
    return mapAudit(created);
  }

  async findPaginated(
    page: number,
    limit: number,
    filter?: { actor?: string; action?: string; resourceType?: string },
  ): Promise<{ data: IAdminAuditLog[]; total: number }> {
    const result = await this.repository.findPaginated(page, limit, filter);
    return { data: result.data.map(mapAudit), total: result.total };
  }
}

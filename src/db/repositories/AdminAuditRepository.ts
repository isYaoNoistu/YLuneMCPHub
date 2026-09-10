import { Repository } from 'typeorm';
import { AdminAuditLog } from '../entities/AdminAuditLog.js';
import { getAppDataSource } from '../connection.js';

export class AdminAuditRepository {
  private repository: Repository<AdminAuditLog>;

  constructor() {
    this.repository = getAppDataSource().getRepository(AdminAuditLog);
  }

  create(input: Omit<AdminAuditLog, 'id' | 'timestamp'>): Promise<AdminAuditLog> {
    return this.repository.save(this.repository.create(input));
  }

  async findPaginated(
    page: number,
    limit: number,
    filter?: { actor?: string; action?: string; resourceType?: string },
  ): Promise<{ data: AdminAuditLog[]; total: number }> {
    const qb = this.repository.createQueryBuilder('audit').orderBy('audit.timestamp', 'DESC');
    if (filter?.actor) {
      qb.andWhere('audit.actor = :actor', { actor: filter.actor });
    }
    if (filter?.action) {
      qb.andWhere('audit.action = :action', { action: filter.action });
    }
    if (filter?.resourceType) {
      qb.andWhere('audit.resourceType = :resourceType', { resourceType: filter.resourceType });
    }
    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();
    return { data, total };
  }
}

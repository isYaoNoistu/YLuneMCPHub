import { Repository, Between, Like, FindOptionsWhere } from 'typeorm';
import { Activity } from '../entities/Activity.js';
import { getAppDataSource } from '../connection.js';
import { IActivityFilter, IActivityStats, IActivityUsage } from '../../types/index.js';

/**
 * Repository for Activity entity
 */
export class ActivityRepository {
  private repository: Repository<Activity>;

  constructor() {
    this.repository = getAppDataSource().getRepository(Activity);
  }

  /**
   * Create a new activity record
   */
  async create(activity: Omit<Activity, 'id'>): Promise<Activity> {
    const newActivity = this.repository.create(activity);
    return await this.repository.save(newActivity);
  }

  /**
   * Find activity by ID
   */
  async findById(id: string): Promise<Activity | null> {
    return await this.repository.findOne({ where: { id } });
  }

  /**
   * Build where clause from filter
   */
  private buildWhereClause(filter?: IActivityFilter): FindOptionsWhere<Activity> {
    const where: FindOptionsWhere<Activity> = {};

    if (filter?.server) {
      where.server = Like(`%${filter.server}%`);
    }
    if (filter?.tool) {
      where.tool = Like(`%${filter.tool}%`);
    }
    if (filter?.status) {
      where.status = filter.status;
    }
    if (filter?.group) {
      where.group = Like(`%${filter.group}%`);
    }
    if (filter?.keyId) {
      where.keyId = filter.keyId;
    }
    if (filter?.startDate && filter?.endDate) {
      where.timestamp = Between(filter.startDate, filter.endDate);
    }

    return where;
  }

  private applyActorFilter(
    qb: ReturnType<Repository<Activity>['createQueryBuilder']>,
    filter?: IActivityFilter,
  ): void {
    const actor = filter?.username || filter?.keyName;
    if (!actor) {
      return;
    }
    qb.andWhere('(activity.username = :actor OR activity.key_name = :actor)', { actor });
  }

  /**
   * Find activities with pagination and filtering
   */
  async findPaginated(
    page: number,
    limit: number,
    filter?: IActivityFilter,
  ): Promise<{ data: Activity[]; total: number }> {
    const skip = (page - 1) * limit;
    const actor = filter?.username || filter?.keyName;

    if (actor) {
      const qb = this.repository.createQueryBuilder('activity');
      const where = this.buildWhereClause(filter);
      qb.where(where);
      this.applyActorFilter(qb, filter);
      const total = await qb.getCount();
      const data = await qb.orderBy('activity.timestamp', 'DESC').skip(skip).take(limit).getMany();
      return { data, total };
    }

    const where = this.buildWhereClause(filter);
    const [data, total] = await this.repository.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      skip,
      take: limit,
    });

    return { data, total };
  }

  /**
   * Get activity statistics
   */
  async getStats(filter?: IActivityFilter): Promise<IActivityStats> {
    const where = this.buildWhereClause(filter);

    // Get total count
    const totalCalls = await this.repository.count({ where });

    // Get success count
    const successWhere = { ...where, status: 'success' };
    const successCount = await this.repository.count({ where: successWhere });

    // Get error count
    const errorWhere = { ...where, status: 'error' };
    const errorCount = await this.repository.count({ where: errorWhere });

    // Get average duration using query builder for more complex aggregation
    let avgDuration = 0;
    if (totalCalls > 0) {
      const qb = this.repository.createQueryBuilder('activity');

      // Apply filters to query builder
      if (filter?.server) {
        qb.andWhere('activity.server LIKE :server', { server: `%${filter.server}%` });
      }
      if (filter?.tool) {
        qb.andWhere('activity.tool LIKE :tool', { tool: `%${filter.tool}%` });
      }
      if (filter?.status) {
        qb.andWhere('activity.status = :status', { status: filter.status });
      }
      if (filter?.group) {
        qb.andWhere('activity.group_name LIKE :group', { group: `%${filter.group}%` });
      }
      this.applyActorFilter(qb, filter);
      if (filter?.keyId) {
        qb.andWhere('activity.key_id = :keyId', { keyId: filter.keyId });
      }
      if (filter?.startDate && filter?.endDate) {
        qb.andWhere('activity.timestamp BETWEEN :startDate AND :endDate', {
          startDate: filter.startDate,
          endDate: filter.endDate,
        });
      }

      const result = await qb.select('AVG(activity.duration)', 'avgDuration').getRawOne();

      avgDuration = Math.round(parseFloat(result?.avgDuration || '0'));
    }

    return {
      totalCalls,
      successCount,
      errorCount,
      avgDuration,
    };
  }

  async getUsage(days = 7, limit = 10): Promise<IActivityUsage> {
    const windowDays = Math.min(Math.max(days, 1), 31);
    const topLimit = Math.min(Math.max(limit, 1), 30);
    const since = startOfUtcDay(addUtcDays(new Date(), -(windowDays - 1)));

    const [toolRows, userRows, dayRows, errorRows] = await Promise.all([
      this.repository
        .createQueryBuilder('activity')
        .select('activity.tool', 'name')
        .addSelect('COUNT(*)', 'count')
        .addSelect(`SUM(CASE WHEN activity.status = 'error' THEN 1 ELSE 0 END)`, 'errors')
        .where('activity.timestamp >= :since', { since })
        .groupBy('activity.tool')
        .orderBy('COUNT(*)', 'DESC')
        .addOrderBy('activity.tool', 'ASC')
        .limit(topLimit)
        .getRawMany(),
      this.repository
        .createQueryBuilder('activity')
        .select(
          `COALESCE(NULLIF(activity.username, ''), NULLIF(activity.key_name, ''), '(anonymous)')`,
          'name',
        )
        .addSelect('COUNT(*)', 'count')
        .addSelect(`SUM(CASE WHEN activity.status = 'error' THEN 1 ELSE 0 END)`, 'errors')
        .where('activity.timestamp >= :since', { since })
        .groupBy(
          `COALESCE(NULLIF(activity.username, ''), NULLIF(activity.key_name, ''), '(anonymous)')`,
        )
        .orderBy('COUNT(*)', 'DESC')
        .limit(topLimit)
        .getRawMany(),
      this.repository
        .createQueryBuilder('activity')
        .select(`TO_CHAR(DATE_TRUNC('day', activity.timestamp), 'YYYY-MM-DD')`, 'date')
        .addSelect('COUNT(*)', 'count')
        .addSelect(`SUM(CASE WHEN activity.status = 'error' THEN 1 ELSE 0 END)`, 'errors')
        .where('activity.timestamp >= :since', { since })
        .groupBy(`DATE_TRUNC('day', activity.timestamp)`)
        .orderBy(`DATE_TRUNC('day', activity.timestamp)`, 'ASC')
        .getRawMany(),
      this.repository
        .createQueryBuilder('activity')
        .where('activity.status = :status', { status: 'error' })
        .andWhere('activity.timestamp >= :since', { since })
        .orderBy('activity.timestamp', 'DESC')
        .take(5)
        .getMany(),
    ]);

    const dayMap = new Map(
      dayRows.map((row) => [
        String(row.date),
        { count: toCount(row.count), errors: toCount(row.errors) },
      ]),
    );
    const daysOut = [];
    for (let i = 0; i < windowDays; i += 1) {
      const date = utcDateKey(addUtcDays(since, i));
      const bucket = dayMap.get(date) || { count: 0, errors: 0 };
      daysOut.push({ date, ...bucket });
    }

    return {
      since,
      days: daysOut,
      tools: toolRows.map((row) => ({
        name: String(row.name || ''),
        count: toCount(row.count),
        errors: toCount(row.errors),
      })),
      users: userRows.map((row) => ({
        name: String(row.name || '(anonymous)'),
        count: toCount(row.count),
        errors: toCount(row.errors),
      })),
      recentErrors: errorRows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp,
        tool: row.tool,
        username: row.username || row.keyName || undefined,
        errorMessage: row.errorMessage,
      })),
    };
  }

  /**
   * Delete activities older than specified date
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .where('timestamp < :date', { date })
      .execute();

    return result.affected || 0;
  }

  /**
   * Get distinct values for filter dropdowns
   */
  async getDistinctServers(): Promise<string[]> {
    const result = await this.repository
      .createQueryBuilder('activity')
      .select('DISTINCT activity.server', 'server')
      .orderBy('activity.server', 'ASC')
      .getRawMany();

    return result.map((r) => r.server);
  }

  async getDistinctTools(): Promise<string[]> {
    const result = await this.repository
      .createQueryBuilder('activity')
      .select('DISTINCT activity.tool', 'tool')
      .orderBy('activity.tool', 'ASC')
      .getRawMany();

    return result.map((r) => r.tool);
  }

  async getDistinctGroups(): Promise<string[]> {
    const result = await this.repository
      .createQueryBuilder('activity')
      .select('DISTINCT activity.group_name', 'group')
      .where('activity.group_name IS NOT NULL')
      .orderBy('activity.group_name', 'ASC')
      .getRawMany();

    return result.map((r) => r.group);
  }

  async getDistinctUsernames(): Promise<string[]> {
    const result = await this.repository
      .createQueryBuilder('activity')
      .select('DISTINCT activity.username', 'username')
      .where('activity.username IS NOT NULL')
      .orderBy('activity.username', 'ASC')
      .getRawMany();

    return result.map((r) => r.username);
  }

  async findLastTimestampByUsernames(usernames: string[]): Promise<Map<string, Date>> {
    const unique = [...new Set(usernames.filter((name) => typeof name === 'string' && name.trim()))];
    const lastByUser = new Map<string, Date>();
    if (unique.length === 0) {
      return lastByUser;
    }

    const rows = await this.repository
      .createQueryBuilder('activity')
      .select('activity.username', 'username')
      .addSelect('MAX(activity.timestamp)', 'lastAt')
      .where('activity.username IN (:...usernames)', { usernames: unique })
      .groupBy('activity.username')
      .getRawMany<{ username?: string; lastAt?: Date | string }>();

    for (const row of rows) {
      if (!row.username || !row.lastAt) {
        continue;
      }
      const date = row.lastAt instanceof Date ? row.lastAt : new Date(row.lastAt);
      if (!Number.isNaN(date.getTime())) {
        lastByUser.set(row.username, date);
      }
    }

    return lastByUser;
  }

  async getDistinctKeyNames(): Promise<string[]> {
    const result = await this.repository
      .createQueryBuilder('activity')
      .select('DISTINCT activity.key_name', 'keyName')
      .where('activity.key_name IS NOT NULL')
      .orderBy('activity.key_name', 'ASC')
      .getRawMany();

    return result.map((r) => r.keyName);
  }
}

function toCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function utcDateKey(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

export default ActivityRepository;

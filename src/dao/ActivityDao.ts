import { IActivity, IActivityFilter, IActivityStats, IActivityUsage } from '../types/index.js';
import { PaginatedResult } from './index.js';
import { ActivityRepository } from '../db/repositories/ActivityRepository.js';

/**
 * Activity DAO interface - only available in database mode
 */
export interface ActivityDao {
  create(activity: Omit<IActivity, 'id'>): Promise<IActivity>;
  findById(id: string): Promise<IActivity | null>;
  findPaginated(
    page: number,
    limit: number,
    filter?: IActivityFilter,
  ): Promise<PaginatedResult<IActivity>>;
  getStats(filter?: IActivityFilter): Promise<IActivityStats>;
  getUsage(days?: number, limit?: number): Promise<IActivityUsage>;
  deleteOlderThan(date: Date): Promise<number>;
  getDistinctServers(): Promise<string[]>;
  getDistinctTools(): Promise<string[]>;
  getDistinctGroups(): Promise<string[]>;
  getDistinctUsernames(): Promise<string[]>;
  getDistinctKeyNames(): Promise<string[]>;
  getLastTimestampByUsernames?(usernames: string[]): Promise<Map<string, Date>>;
}

/**
 * Database implementation of ActivityDao
 * Activity logging is only available in database mode
 */
export class ActivityDaoDbImpl implements ActivityDao {
  private repository: ActivityRepository;

  constructor() {
    this.repository = new ActivityRepository();
  }

  async create(activity: Omit<IActivity, 'id'>): Promise<IActivity> {
    const created = await this.repository.create({
      timestamp: activity.timestamp,
      server: activity.server,
      tool: activity.tool,
      duration: activity.duration,
      status: activity.status,
      input: activity.input,
      output: activity.output,
      group: activity.group,
      username: activity.username,
      keyId: activity.keyId,
      keyName: activity.keyName,
      sourceIp: activity.sourceIp,
      errorMessage: activity.errorMessage,
      requestId: activity.requestId,
      targetId: activity.targetId,
      targetName: activity.targetName,
      credentialId: activity.credentialId,
      credentialName: activity.credentialName,
      credentialVersion: activity.credentialVersion,
      resourceGroupId: activity.resourceGroupId,
      resourceGroupName: activity.resourceGroupName,
    });

    return this.mapToActivity(created);
  }

  async findById(id: string): Promise<IActivity | null> {
    const activity = await this.repository.findById(id);
    return activity ? this.mapToActivity(activity) : null;
  }

  async findPaginated(
    page: number,
    limit: number,
    filter?: IActivityFilter,
  ): Promise<PaginatedResult<IActivity>> {
    const { data, total } = await this.repository.findPaginated(page, limit, filter);
    const totalPages = Math.ceil(total / limit);

    return {
      data: data.map((a) => this.mapToActivity(a)),
      total,
      page,
      limit,
      totalPages,
    };
  }

  async getStats(filter?: IActivityFilter): Promise<IActivityStats> {
    return await this.repository.getStats(filter);
  }

  async getUsage(days?: number, limit?: number): Promise<IActivityUsage> {
    return await this.repository.getUsage(days, limit);
  }

  async deleteOlderThan(date: Date): Promise<number> {
    return await this.repository.deleteOlderThan(date);
  }

  async getDistinctServers(): Promise<string[]> {
    return await this.repository.getDistinctServers();
  }

  async getDistinctTools(): Promise<string[]> {
    return await this.repository.getDistinctTools();
  }

  async getDistinctGroups(): Promise<string[]> {
    return await this.repository.getDistinctGroups();
  }

  async getDistinctUsernames(): Promise<string[]> {
    return await this.repository.getDistinctUsernames();
  }

  async getDistinctKeyNames(): Promise<string[]> {
    return await this.repository.getDistinctKeyNames();
  }

  async getLastTimestampByUsernames(usernames: string[]): Promise<Map<string, Date>> {
    return await this.repository.findLastTimestampByUsernames(usernames);
  }

  private mapToActivity(entity: any): IActivity {
    return {
      id: entity.id,
      timestamp: entity.timestamp,
      server: entity.server,
      tool: entity.tool,
      duration: entity.duration,
      status: entity.status as 'success' | 'error',
      input: entity.input,
      output: entity.output,
      group: entity.group,
      username: entity.username,
      keyId: entity.keyId,
      keyName: entity.keyName,
      sourceIp: entity.sourceIp,
      errorMessage: entity.errorMessage,
      requestId: entity.requestId,
      targetId: entity.targetId,
      targetName: entity.targetName,
      credentialId: entity.credentialId,
      credentialName: entity.credentialName,
      credentialVersion: entity.credentialVersion,
      resourceGroupId: entity.resourceGroupId,
      resourceGroupName: entity.resourceGroupName,
    };
  }
}

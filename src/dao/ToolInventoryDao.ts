import { ToolInventoryBaselineRepository } from '../db/repositories/ToolInventoryBaselineRepository.js';

export interface ToolInventorySnapshot {
  snapshot: Record<string, Record<string, string>>;
  updatedAt?: Date | null;
  updatedBy?: string | null;
}

export interface ToolInventoryDao {
  getBaseline(): Promise<ToolInventorySnapshot | null>;
  saveBaseline(snapshot: Record<string, Record<string, string>>, updatedBy?: string): Promise<void>;
}

export class ToolInventoryDaoDbImpl implements ToolInventoryDao {
  private repository: ToolInventoryBaselineRepository;

  constructor() {
    this.repository = new ToolInventoryBaselineRepository();
  }

  async getBaseline(): Promise<ToolInventorySnapshot | null> {
    const row = await this.repository.findCurrent();
    if (!row) {
      return null;
    }
    try {
      const snapshot = JSON.parse(row.snapshotJson) as Record<string, Record<string, string>>;
      return {
        snapshot: snapshot && typeof snapshot === 'object' ? snapshot : {},
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy ?? null,
      };
    } catch {
      return { snapshot: {}, updatedAt: row.updatedAt, updatedBy: row.updatedBy ?? null };
    }
  }

  async saveBaseline(
    snapshot: Record<string, Record<string, string>>,
    updatedBy?: string,
  ): Promise<void> {
    await this.repository.saveCurrent(JSON.stringify(snapshot), updatedBy);
  }
}

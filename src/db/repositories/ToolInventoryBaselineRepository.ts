import { Repository } from 'typeorm';
import { ToolInventoryBaseline } from '../entities/ToolInventoryBaseline.js';
import { getAppDataSource } from '../connection.js';

export const TOOL_INVENTORY_BASELINE_ID = 'current';

export class ToolInventoryBaselineRepository {
  private repository: Repository<ToolInventoryBaseline>;

  constructor() {
    this.repository = getAppDataSource().getRepository(ToolInventoryBaseline);
  }

  findCurrent(): Promise<ToolInventoryBaseline | null> {
    return this.repository.findOne({ where: { id: TOOL_INVENTORY_BASELINE_ID } });
  }

  saveCurrent(snapshotJson: string, updatedBy?: string | null): Promise<ToolInventoryBaseline> {
    return this.repository.save(
      this.repository.create({
        id: TOOL_INVENTORY_BASELINE_ID,
        snapshotJson,
        updatedBy: updatedBy ?? null,
      }),
    );
  }
}

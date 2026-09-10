import {
  IResourceGroup,
  IResourceGroupItem,
  IResourceTarget,
  IResourceTargetConfig,
  IUserResourceGroup,
  ResourceTargetType,
} from '../types/index.js';
import { ResourceRepository } from '../db/repositories/ResourceRepository.js';

export interface ResourceDao {
  findAllTargets(): Promise<IResourceTarget[]>;
  findTargetById(id: string): Promise<IResourceTarget | null>;
  findTargetByName(name: string): Promise<IResourceTarget | null>;
  createTarget(input: Omit<IResourceTarget, 'id' | 'createdAt' | 'updatedAt'>): Promise<IResourceTarget>;
  updateTarget(id: string, patch: Partial<IResourceTarget>): Promise<IResourceTarget | null>;
  deleteTarget(id: string): Promise<boolean>;
  findAllGroups(): Promise<IResourceGroup[]>;
  findGroupById(id: string): Promise<IResourceGroup | null>;
  findGroupByName(name: string): Promise<IResourceGroup | null>;
  createGroup(input: {
    name: string;
    description?: string | null;
    enabled: boolean;
    items: Omit<IResourceGroupItem, 'id' | 'groupId'>[];
  }): Promise<IResourceGroup>;
  updateGroup(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      enabled?: boolean;
      items?: Omit<IResourceGroupItem, 'id' | 'groupId'>[];
    },
  ): Promise<IResourceGroup | null>;
  deleteGroup(id: string): Promise<boolean>;
  findAllItems(): Promise<IResourceGroupItem[]>;
  findAssignmentsByUser(username: string): Promise<IUserResourceGroup[]>;
  findAllAssignments(): Promise<IUserResourceGroup[]>;
  replaceUserAssignments(username: string, groupIds: string[], createdBy?: string): Promise<void>;
}

const parseConfig = (raw: string): IResourceTargetConfig => {
  try {
    const parsed = JSON.parse(raw) as IResourceTargetConfig;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const mapTarget = (row: {
  id: string;
  name: string;
  type: string;
  configJson: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): IResourceTarget => ({
  id: row.id,
  name: row.name,
  type: row.type as ResourceTargetType,
  config: parseConfig(row.configJson),
  enabled: row.enabled,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const mapItem = (row: {
  id: string;
  groupId: string;
  serverName: string;
  targetId: string;
  credentialId: string;
  alias?: string | null;
  enabled: boolean;
}): IResourceGroupItem => ({
  id: row.id,
  groupId: row.groupId,
  serverName: row.serverName,
  targetId: row.targetId,
  credentialId: row.credentialId,
  alias: row.alias ?? null,
  enabled: row.enabled,
});

export class ResourceDaoDbImpl implements ResourceDao {
  private repository: ResourceRepository;

  constructor() {
    this.repository = new ResourceRepository();
  }

  async findAllTargets(): Promise<IResourceTarget[]> {
    return (await this.repository.findAllTargets()).map(mapTarget);
  }

  async findTargetById(id: string): Promise<IResourceTarget | null> {
    const row = await this.repository.findTargetById(id);
    return row ? mapTarget(row) : null;
  }

  async findTargetByName(name: string): Promise<IResourceTarget | null> {
    const row = await this.repository.findTargetByName(name);
    return row ? mapTarget(row) : null;
  }

  async createTarget(
    input: Omit<IResourceTarget, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<IResourceTarget> {
    const created = await this.repository.createTarget({
      name: input.name,
      type: input.type,
      configJson: JSON.stringify(input.config || {}),
      enabled: input.enabled,
    });
    return mapTarget(created);
  }

  async updateTarget(id: string, patch: Partial<IResourceTarget>): Promise<IResourceTarget | null> {
    const existing = await this.repository.findTargetById(id);
    if (!existing) {
      return null;
    }
    if (patch.name !== undefined) existing.name = patch.name;
    if (patch.type !== undefined) existing.type = patch.type;
    if (patch.config !== undefined) existing.configJson = JSON.stringify(patch.config);
    if (patch.enabled !== undefined) existing.enabled = patch.enabled;
    return mapTarget(await this.repository.saveTarget(existing));
  }

  async deleteTarget(id: string): Promise<boolean> {
    return this.repository.deleteTarget(id);
  }

  async findAllGroups(): Promise<IResourceGroup[]> {
    const groups = await this.repository.findAllGroups();
    const items = await this.repository.findAllItems();
    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      description: group.description ?? null,
      enabled: group.enabled,
      createdAt: group.createdAt,
      items: items.filter((item) => item.groupId === group.id).map(mapItem),
    }));
  }

  async findGroupById(id: string): Promise<IResourceGroup | null> {
    const group = await this.repository.findGroupById(id);
    if (!group) {
      return null;
    }
    const items = await this.repository.findItemsByGroup(id);
    return {
      id: group.id,
      name: group.name,
      description: group.description ?? null,
      enabled: group.enabled,
      createdAt: group.createdAt,
      items: items.map(mapItem),
    };
  }

  async findGroupByName(name: string): Promise<IResourceGroup | null> {
    const group = await this.repository.findGroupByName(name);
    return group ? this.findGroupById(group.id) : null;
  }

  async createGroup(input: {
    name: string;
    description?: string | null;
    enabled: boolean;
    items: Omit<IResourceGroupItem, 'id' | 'groupId'>[];
  }): Promise<IResourceGroup> {
    const created = await this.repository.createGroup({
      name: input.name,
      description: input.description ?? null,
      enabled: input.enabled,
    });
    for (const item of input.items) {
      await this.repository.createItem({
        groupId: created.id,
        serverName: item.serverName,
        targetId: item.targetId,
        credentialId: item.credentialId,
        alias: item.alias ?? null,
        enabled: item.enabled !== false,
      });
    }
    return (await this.findGroupById(created.id)) as IResourceGroup;
  }

  async updateGroup(
    id: string,
    patch: {
      name?: string;
      description?: string | null;
      enabled?: boolean;
      items?: Omit<IResourceGroupItem, 'id' | 'groupId'>[];
    },
  ): Promise<IResourceGroup | null> {
    const existing = await this.repository.findGroupById(id);
    if (!existing) {
      return null;
    }
    if (patch.name !== undefined) existing.name = patch.name;
    if (patch.description !== undefined) existing.description = patch.description;
    if (patch.enabled !== undefined) existing.enabled = patch.enabled;
    await this.repository.saveGroup(existing);
    if (patch.items) {
      const current = await this.repository.findItemsByGroup(id);
      for (const item of current) {
        await this.repository.deleteItem(item.id);
      }
      for (const item of patch.items) {
        await this.repository.createItem({
          groupId: id,
          serverName: item.serverName,
          targetId: item.targetId,
          credentialId: item.credentialId,
          alias: item.alias ?? null,
          enabled: item.enabled !== false,
        });
      }
    }
    return this.findGroupById(id);
  }

  async deleteGroup(id: string): Promise<boolean> {
    return this.repository.deleteGroup(id);
  }

  async findAllItems(): Promise<IResourceGroupItem[]> {
    return (await this.repository.findAllItems()).map(mapItem);
  }

  async findAssignmentsByUser(username: string): Promise<IUserResourceGroup[]> {
    return (await this.repository.findAssignmentsByUser(username)).map((row) => ({
      username: row.username,
      groupId: row.groupId,
      createdAt: row.createdAt,
      createdBy: row.createdBy ?? null,
    }));
  }

  async findAllAssignments(): Promise<IUserResourceGroup[]> {
    return (await this.repository.findAllAssignments()).map((row) => ({
      username: row.username,
      groupId: row.groupId,
      createdAt: row.createdAt,
      createdBy: row.createdBy ?? null,
    }));
  }

  async replaceUserAssignments(
    username: string,
    groupIds: string[],
    createdBy?: string,
  ): Promise<void> {
    await this.repository.replaceUserAssignments(username, groupIds, createdBy);
  }
}

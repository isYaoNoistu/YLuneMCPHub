import { Repository } from 'typeorm';
import { ResourceTarget } from '../entities/ResourceTarget.js';
import { ResourceGroup } from '../entities/ResourceGroup.js';
import { ResourceGroupItem } from '../entities/ResourceGroupItem.js';
import { UserResourceGroup } from '../entities/UserResourceGroup.js';
import { getAppDataSource } from '../connection.js';

export class ResourceRepository {
  private targets: Repository<ResourceTarget>;
  private groups: Repository<ResourceGroup>;
  private items: Repository<ResourceGroupItem>;
  private assignments: Repository<UserResourceGroup>;

  constructor() {
    const ds = getAppDataSource();
    this.targets = ds.getRepository(ResourceTarget);
    this.groups = ds.getRepository(ResourceGroup);
    this.items = ds.getRepository(ResourceGroupItem);
    this.assignments = ds.getRepository(UserResourceGroup);
  }

  findAllTargets(): Promise<ResourceTarget[]> {
    return this.targets.find({ order: { name: 'ASC' } });
  }

  findTargetById(id: string): Promise<ResourceTarget | null> {
    return this.targets.findOne({ where: { id } });
  }

  findTargetByName(name: string): Promise<ResourceTarget | null> {
    return this.targets.findOne({ where: { name } });
  }

  createTarget(input: Omit<ResourceTarget, 'id' | 'createdAt' | 'updatedAt'>): Promise<ResourceTarget> {
    return this.targets.save(this.targets.create(input));
  }

  saveTarget(entity: ResourceTarget): Promise<ResourceTarget> {
    return this.targets.save(entity);
  }

  async deleteTarget(id: string): Promise<boolean> {
    const result = await this.targets.delete({ id });
    return (result.affected || 0) > 0;
  }

  findAllGroups(): Promise<ResourceGroup[]> {
    return this.groups.find({ order: { name: 'ASC' } });
  }

  findGroupById(id: string): Promise<ResourceGroup | null> {
    return this.groups.findOne({ where: { id } });
  }

  findGroupByName(name: string): Promise<ResourceGroup | null> {
    return this.groups.findOne({ where: { name } });
  }

  createGroup(input: Omit<ResourceGroup, 'id' | 'createdAt'>): Promise<ResourceGroup> {
    return this.groups.save(this.groups.create(input));
  }

  saveGroup(entity: ResourceGroup): Promise<ResourceGroup> {
    return this.groups.save(entity);
  }

  async deleteGroup(id: string): Promise<boolean> {
    await this.items.delete({ groupId: id });
    await this.assignments.delete({ groupId: id });
    const result = await this.groups.delete({ id });
    return (result.affected || 0) > 0;
  }

  findItemsByGroup(groupId: string): Promise<ResourceGroupItem[]> {
    return this.items.find({ where: { groupId } });
  }

  findAllItems(): Promise<ResourceGroupItem[]> {
    return this.items.find();
  }

  createItem(input: Omit<ResourceGroupItem, 'id'>): Promise<ResourceGroupItem> {
    return this.items.save(this.items.create(input));
  }

  async deleteItem(id: string): Promise<boolean> {
    const result = await this.items.delete({ id });
    return (result.affected || 0) > 0;
  }

  findAssignmentsByUser(username: string): Promise<UserResourceGroup[]> {
    return this.assignments.find({ where: { username } });
  }

  findAssignmentsByGroup(groupId: string): Promise<UserResourceGroup[]> {
    return this.assignments.find({ where: { groupId } });
  }

  findAllAssignments(): Promise<UserResourceGroup[]> {
    return this.assignments.find();
  }

  saveAssignment(input: Omit<UserResourceGroup, 'createdAt'>): Promise<UserResourceGroup> {
    return this.assignments.save(this.assignments.create(input));
  }

  async deleteAssignment(username: string, groupId: string): Promise<boolean> {
    const result = await this.assignments.delete({ username, groupId });
    return (result.affected || 0) > 0;
  }

  async replaceUserAssignments(
    username: string,
    groupIds: string[],
    createdBy?: string,
  ): Promise<void> {
    await this.assignments.delete({ username });
    for (const groupId of groupIds) {
      await this.saveAssignment({ username, groupId, createdBy: createdBy ?? null });
    }
  }
}

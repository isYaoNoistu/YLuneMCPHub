import { GroupDao } from './index.js';
import { IGroup } from '../types/index.js';
import { Group } from '../db/entities/Group.js';
import { GroupRepository } from '../db/repositories/GroupRepository.js';

const toIGroup = (g: Group): IGroup => ({
  id: g.id,
  name: g.name,
  description: g.description,
  servers: g.servers as IGroup['servers'],
  owner: g.owner,
  members: g.members || [],
});

/**
 * Database-backed implementation of GroupDao
 */
export class GroupDaoDbImpl implements GroupDao {
  private repository: GroupRepository;

  constructor() {
    this.repository = new GroupRepository();
  }

  async findAll(): Promise<IGroup[]> {
    const groups = await this.repository.findAll();
    return groups.map(toIGroup);
  }

  async findById(id: string): Promise<IGroup | null> {
    const group = await this.repository.findById(id);
    if (!group) return null;
    return toIGroup(group);
  }

  async create(entity: Omit<IGroup, 'id'>): Promise<IGroup> {
    const group = await this.repository.create({
      name: entity.name,
      description: entity.description,
      servers: entity.servers as any,
      owner: entity.owner,
      members: entity.members || [],
    });
    return toIGroup(group);
  }

  async update(id: string, entity: Partial<IGroup>): Promise<IGroup | null> {
    const group = await this.repository.update(id, {
      name: entity.name,
      description: entity.description,
      servers: entity.servers as any,
      owner: entity.owner,
      ...(entity.members !== undefined ? { members: entity.members } : {}),
    });
    if (!group) return null;
    return toIGroup(group);
  }

  async delete(id: string): Promise<boolean> {
    return await this.repository.delete(id);
  }

  async exists(id: string): Promise<boolean> {
    return await this.repository.exists(id);
  }

  async count(): Promise<number> {
    return await this.repository.count();
  }

  async findByOwner(owner: string): Promise<IGroup[]> {
    const groups = await this.repository.findByOwner(owner);
    return groups.map(toIGroup);
  }

  async findByMember(username: string): Promise<IGroup[]> {
    const groups = await this.repository.findAll();
    return groups.filter((g) => (g.members || []).includes(username)).map(toIGroup);
  }

  async findByServer(serverName: string): Promise<IGroup[]> {
    const allGroups = await this.repository.findAll();
    return allGroups
      .filter((g) =>
        g.servers.some((s) => (typeof s === 'string' ? s === serverName : s.name === serverName)),
      )
      .map(toIGroup);
  }

  async addServerToGroup(groupId: string, serverName: string): Promise<boolean> {
    const group = await this.repository.findById(groupId);
    if (!group) return false;

    // Check if server already exists
    const serverExists = group.servers.some((s) =>
      typeof s === 'string' ? s === serverName : s.name === serverName,
    );

    if (!serverExists) {
      group.servers.push(serverName);
      await this.update(groupId, { servers: group.servers as any });
    }

    return true;
  }

  async removeServerFromGroup(groupId: string, serverName: string): Promise<boolean> {
    const group = await this.repository.findById(groupId);
    if (!group) return false;

    group.servers = group.servers.filter((s) =>
      typeof s === 'string' ? s !== serverName : s.name !== serverName,
    ) as any;

    await this.update(groupId, { servers: group.servers as any });
    return true;
  }

  async updateServers(groupId: string, servers: string[] | IGroup['servers']): Promise<boolean> {
    const result = await this.update(groupId, { servers: servers as any });
    return result !== null;
  }

  async findByName(name: string): Promise<IGroup | null> {
    const group = await this.repository.findByName(name);
    if (!group) return null;
    return toIGroup(group);
  }

  async updateServerName(oldName: string, newName: string): Promise<number> {
    const allGroups = await this.repository.findAll();
    let updatedCount = 0;

    for (const group of allGroups) {
      let updated = false;
      const newServers = group.servers.map((server) => {
        if (typeof server === 'string') {
          if (server === oldName) {
            updated = true;
            return newName;
          }
          return server;
        } else {
          if (server.name === oldName) {
            updated = true;
            return { ...server, name: newName };
          }
          return server;
        }
      });

      if (updated) {
        await this.update(group.id, { servers: newServers as any });
        updatedCount++;
      }
    }

    return updatedCount;
  }
}

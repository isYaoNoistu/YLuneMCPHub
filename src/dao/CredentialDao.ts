import { ICredential } from '../types/index.js';
import { CredentialRepository } from '../db/repositories/CredentialRepository.js';

export interface CredentialDao {
  findAll(): Promise<ICredential[]>;
  findById(id: string): Promise<ICredential | null>;
  findByName(name: string): Promise<ICredential | null>;
  create(input: Omit<ICredential, 'id' | 'createdAt' | 'updatedAt'>): Promise<ICredential>;
  update(id: string, patch: Partial<ICredential>): Promise<ICredential | null>;
  deleteById(id: string): Promise<boolean>;
}

const toDateOrNull = (value: Date | string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export class CredentialDaoDbImpl implements CredentialDao {
  private repository: CredentialRepository;

  constructor() {
    this.repository = new CredentialRepository();
  }

  async findAll(): Promise<ICredential[]> {
    return (await this.repository.findAll()).map(mapCredential);
  }

  async findById(id: string): Promise<ICredential | null> {
    const row = await this.repository.findById(id);
    return row ? mapCredential(row) : null;
  }

  async findByName(name: string): Promise<ICredential | null> {
    const row = await this.repository.findByName(name);
    return row ? mapCredential(row) : null;
  }

  async create(input: Omit<ICredential, 'id' | 'createdAt' | 'updatedAt'>): Promise<ICredential> {
    const created = await this.repository.create({
      name: input.name,
      type: input.type,
      encryptedPayload: input.encryptedPayload,
      keyVersion: input.keyVersion,
      enabled: input.enabled,
      fieldKeys: input.fieldKeys ?? null,
      username: input.username ?? null,
      rotatedAt: toDateOrNull(input.rotatedAt),
    });
    return mapCredential(created);
  }

  async update(id: string, patch: Partial<ICredential>): Promise<ICredential | null> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      return null;
    }
    if (patch.name !== undefined) existing.name = patch.name;
    if (patch.type !== undefined) existing.type = patch.type;
    if (patch.encryptedPayload !== undefined) existing.encryptedPayload = patch.encryptedPayload;
    if (patch.keyVersion !== undefined) existing.keyVersion = patch.keyVersion;
    if (patch.enabled !== undefined) existing.enabled = patch.enabled;
    if (patch.fieldKeys !== undefined) existing.fieldKeys = patch.fieldKeys;
    if (patch.username !== undefined) existing.username = patch.username;
    if (patch.rotatedAt !== undefined) existing.rotatedAt = toDateOrNull(patch.rotatedAt);
    return mapCredential(await this.repository.save(existing));
  }

  async deleteById(id: string): Promise<boolean> {
    return this.repository.deleteById(id);
  }
}

const mapCredential = (row: {
  id: string;
  name: string;
  type: string;
  encryptedPayload: string;
  keyVersion: number;
  enabled: boolean;
  fieldKeys?: string[] | null;
  username?: string | null;
  createdAt: Date;
  updatedAt: Date;
  rotatedAt?: Date | null;
}): ICredential => ({
  id: row.id,
  name: row.name,
  type: row.type,
  encryptedPayload: row.encryptedPayload,
  keyVersion: row.keyVersion,
  enabled: row.enabled,
  fieldKeys: Array.isArray(row.fieldKeys) ? row.fieldKeys : null,
  username: row.username ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  rotatedAt: row.rotatedAt ?? null,
});

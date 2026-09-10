import { Repository } from 'typeorm';
import { Credential } from '../entities/Credential.js';
import { getAppDataSource } from '../connection.js';

export class CredentialRepository {
  private repository: Repository<Credential>;

  constructor() {
    this.repository = getAppDataSource().getRepository(Credential);
  }

  async findAll(): Promise<Credential[]> {
    return this.repository.find({ order: { updatedAt: 'DESC' } });
  }

  async findById(id: string): Promise<Credential | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByName(name: string): Promise<Credential | null> {
    return this.repository.findOne({ where: { name } });
  }

  async create(input: Omit<Credential, 'id' | 'createdAt' | 'updatedAt'>): Promise<Credential> {
    const row = this.repository.create(input);
    return this.repository.save(row);
  }

  async save(entity: Credential): Promise<Credential> {
    return this.repository.save(entity);
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected || 0) > 0;
  }
}

export default CredentialRepository;

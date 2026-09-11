import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * User entity for database storage
 */
@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'boolean', default: false })
  isAdmin: boolean;

  @Column({ type: 'boolean', default: false, name: 'console_enabled' })
  consoleEnabled: boolean;

  @Column({ type: 'boolean', default: true, name: 'mcp_enabled' })
  mcpEnabled: boolean;

  @Column({ type: 'boolean', default: false })
  demo: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true })
  email: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, unique: true, name: 'sso_user_id' })
  ssoUserId: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  remark?: string | null;

  @Column({ type: 'simple-json', nullable: true })
  grants?: Array<{
    name: string;
    alias?: string;
    tools?: string[] | 'all';
    prompts?: string[] | 'all';
    resources?: string[] | 'all';
  }> | null;

  @Column({ type: 'timestamp', nullable: true, name: 'token_expires_at' })
  tokenExpiresAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;
}

export default User;

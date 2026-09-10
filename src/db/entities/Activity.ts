import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

/**
 * Activity entity for tracking tool call history
 * Only available in database mode
 */
@Entity({ name: 'activities' })
@Index(['server'])
@Index(['tool'])
@Index(['status'])
@Index(['group'])
@Index(['username'])
@Index(['keyId'])
@Index(['timestamp'])
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'timestamp', type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'varchar', length: 255 })
  server: string;

  @Column({ type: 'varchar', length: 255 })
  tool: string;

  @Column({ type: 'int' })
  duration: number;

  @Column({ type: 'varchar', length: 20 })
  status: string; // 'success' | 'error'

  @Column({ type: 'text', nullable: true })
  input?: string;

  @Column({ type: 'text', nullable: true })
  output?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'group_name' })
  group?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'username' })
  username?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'key_id' })
  keyId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'key_name' })
  keyName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'source_ip' })
  sourceIp?: string;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage?: string;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'request_id' })
  requestId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'target_id' })
  targetId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'target_name' })
  targetName?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'credential_id' })
  credentialId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'credential_name' })
  credentialName?: string;

  @Column({ type: 'int', nullable: true, name: 'credential_version' })
  credentialVersion?: number;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'resource_group_id' })
  resourceGroupId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'resource_group_name' })
  resourceGroupName?: string;
}

export default Activity;

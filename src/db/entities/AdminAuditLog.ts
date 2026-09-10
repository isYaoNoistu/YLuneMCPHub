import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity({ name: 'admin_audit_logs' })
@Index(['actor'])
@Index(['action'])
@Index(['resourceType'])
@Index(['timestamp'])
export class AdminAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn({ name: 'timestamp', type: 'timestamp' })
  timestamp: Date;

  @Column({ type: 'varchar', length: 255 })
  actor: string;

  @Column({ type: 'varchar', length: 128 })
  action: string;

  @Column({ type: 'varchar', length: 64, name: 'resource_type' })
  resourceType: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'resource_id' })
  resourceId?: string | null;

  @Column({ type: 'text', nullable: true, name: 'before_json' })
  beforeJson?: string | null;

  @Column({ type: 'text', nullable: true, name: 'after_json' })
  afterJson?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'source_ip' })
  sourceIp?: string | null;
}

export default AdminAuditLog;

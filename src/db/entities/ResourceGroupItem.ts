import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({ name: 'resource_group_items' })
@Index(['groupId', 'serverName', 'targetId'])
export class ResourceGroupItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'group_id' })
  groupId: string;

  @Column({ type: 'varchar', length: 255, name: 'server_name' })
  serverName: string;

  @Column({ type: 'uuid', name: 'target_id' })
  targetId: string;

  @Column({ type: 'uuid', name: 'credential_id' })
  credentialId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  alias?: string | null;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;
}

export default ResourceGroupItem;

import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity({ name: 'user_resource_groups' })
export class UserResourceGroup {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  username: string;

  @PrimaryColumn({ type: 'uuid', name: 'group_id' })
  groupId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'created_by' })
  createdBy?: string | null;
}

export default UserResourceGroup;

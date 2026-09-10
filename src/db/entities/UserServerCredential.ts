import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({ name: 'user_server_credentials' })
@Index(['username', 'serverName'], { unique: true })
export class UserServerCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  username: string;

  @Column({ type: 'varchar', length: 255, name: 'server_name' })
  serverName: string;

  @Column({ type: 'uuid', name: 'credential_id' })
  credentialId: string;
}

export default UserServerCredential;

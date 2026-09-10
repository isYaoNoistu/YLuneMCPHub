import { Entity, Column, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity({ name: 'server_credential_bindings' })
@Index(['serverName', 'credentialId'], { unique: true })
export class ServerCredentialBinding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, name: 'server_name' })
  serverName: string;

  @Column({ type: 'uuid', name: 'credential_id' })
  credentialId: string;
}

export default ServerCredentialBinding;

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Encrypted credential store. Secrets live only in encrypted_payload.
 * fieldKeys lists variable names for the console; values are never stored in the clear.
 */
@Entity({ name: 'credentials' })
export class Credential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 32 })
  type: string;

  @Column({ type: 'text', name: 'encrypted_payload' })
  encryptedPayload: string;

  @Column({ type: 'int', name: 'key_version', default: 1 })
  keyVersion: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'simple-json', name: 'field_keys', nullable: true })
  fieldKeys?: string[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'rotated_at' })
  rotatedAt?: Date | null;
}

export default Credential;

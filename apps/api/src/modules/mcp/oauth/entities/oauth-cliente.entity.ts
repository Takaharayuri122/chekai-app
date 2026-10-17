import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DocumentoCimd } from '../oauth.types';

@Entity('oauth_clientes')
@Check(`"origem" IN ('cimd', 'registro')`)
export class OauthClienteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'client_id', type: 'text', unique: true })
  clientId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nome: string | null;

  @Column({ name: 'redirect_uris', type: 'jsonb' })
  redirectUris: string[];

  @Column({ type: 'varchar', length: 16 })
  origem: 'cimd' | 'registro';

  @Column({ type: 'jsonb', nullable: true })
  documento: DocumentoCimd | null;

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}

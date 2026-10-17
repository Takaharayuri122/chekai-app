import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Usuario } from '../../../usuario/entities/usuario.entity';
import { OauthClienteEntity } from './oauth-cliente.entity';

@Entity('oauth_authorization_codes')
export class OauthAuthorizationCodeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 64, unique: true })
  codeHash: string;

  @ManyToOne(() => OauthClienteEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cliente_id' })
  cliente?: OauthClienteEntity;

  @Column({ name: 'cliente_id', type: 'uuid' })
  clienteId: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario?: Usuario;

  @Index('idx_oauth_codes_usuario')
  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'redirect_uri', type: 'text' })
  redirectUri: string;

  @Column({ name: 'code_challenge', type: 'text' })
  codeChallenge: string;

  @Column({ name: 'code_challenge_method', type: 'varchar', length: 8, default: 'S256' })
  codeChallengeMethod: string;

  @Column({ type: 'text' })
  resource: string;

  @Column({ type: 'text' })
  scopes: string;

  @Column({ name: 'expira_em', type: 'timestamp' })
  expiraEm: Date;

  @Column({ name: 'usado_em', type: 'timestamp', nullable: true })
  usadoEm: Date | null;

  @CreateDateColumn()
  criadoEm: Date;
}

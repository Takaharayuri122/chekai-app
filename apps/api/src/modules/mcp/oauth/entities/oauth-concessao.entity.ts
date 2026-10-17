import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Usuario } from '../../../usuario/entities/usuario.entity';
import { OauthClienteEntity } from './oauth-cliente.entity';

@Entity('oauth_concessoes')
export class OauthConcessaoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => OauthClienteEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cliente_id' })
  cliente?: OauthClienteEntity;

  @Column({ name: 'cliente_id', type: 'uuid' })
  clienteId: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario?: Usuario;

  @Index('idx_oauth_concessoes_usuario')
  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ type: 'text' })
  resource: string;

  @Column({ type: 'text' })
  scopes: string;

  @Column({ name: 'revogada_em', type: 'timestamp', nullable: true })
  revogadaEm: Date | null;

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}

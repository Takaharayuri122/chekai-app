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

@Entity('oauth_sessoes_consentimento')
export class OauthSessaoConsentimentoEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'sessao_hash', type: 'varchar', length: 64, unique: true })
  sessaoHash: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario?: Usuario;

  @Index('idx_oauth_sessoes_usuario')
  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @Column({ name: 'expira_em', type: 'timestamp' })
  expiraEm: Date;

  @Column({ name: 'usado_em', type: 'timestamp', nullable: true })
  usadoEm: Date | null;

  @CreateDateColumn()
  criadoEm: Date;
}

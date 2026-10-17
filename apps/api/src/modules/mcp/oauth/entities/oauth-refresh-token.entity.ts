import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OauthConcessaoEntity } from './oauth-concessao.entity';

@Entity('oauth_refresh_tokens')
export class OauthRefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  @ManyToOne(() => OauthConcessaoEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concessao_id' })
  concessao?: OauthConcessaoEntity;

  @Index('idx_oauth_refresh_concessao')
  @Column({ name: 'concessao_id', type: 'uuid' })
  concessaoId: string;

  @Column({ name: 'expira_em', type: 'timestamp' })
  expiraEm: Date;

  @Column({ name: 'usado_em', type: 'timestamp', nullable: true })
  usadoEm: Date | null;

  @Column({ name: 'revogado_em', type: 'timestamp', nullable: true })
  revogadoEm: Date | null;

  @CreateDateColumn()
  criadoEm: Date;
}

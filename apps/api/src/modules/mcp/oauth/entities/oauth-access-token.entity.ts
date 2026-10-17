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

@Entity('oauth_access_tokens')
export class OauthAccessTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  jti: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64, unique: true })
  tokenHash: string;

  @ManyToOne(() => OauthConcessaoEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concessao_id' })
  concessao?: OauthConcessaoEntity;

  @Index('idx_oauth_access_concessao')
  @Column({ name: 'concessao_id', type: 'uuid' })
  concessaoId: string;

  @Column({ name: 'expira_em', type: 'timestamp' })
  expiraEm: Date;

  @Column({ name: 'revogado_em', type: 'timestamp', nullable: true })
  revogadoEm: Date | null;

  @CreateDateColumn()
  criadoEm: Date;
}

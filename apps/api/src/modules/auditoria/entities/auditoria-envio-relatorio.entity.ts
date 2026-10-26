import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Auditoria } from './auditoria.entity';
import { Usuario } from '../../usuario/entities/usuario.entity';

/**
 * Registro de cada tentativa de envio do relatório da auditoria por e-mail.
 */
@Entity('auditoria_envios_relatorio')
export class AuditoriaEnvioRelatorio {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Auditoria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'auditoria_id' })
  auditoria: Auditoria;

  @Index()
  @Column({ name: 'auditoria_id', type: 'uuid' })
  auditoriaId: string;

  @Column({ type: 'text', array: true })
  destinatarios: string[];

  /** true quando disparado ao finalizar; false quando enviado manualmente */
  @Column({ type: 'boolean' })
  automatico: boolean;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'enviado_por_id' })
  enviadoPor: Usuario | null;

  @Column({ name: 'enviado_por_id', type: 'uuid', nullable: true })
  enviadoPorId: string | null;

  @Column({ type: 'boolean' })
  sucesso: boolean;

  @Column({ type: 'text', nullable: true })
  erro: string | null;

  @CreateDateColumn({ name: 'criado_em', type: 'timestamptz' })
  criadoEm: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Usuario } from '../../usuario/entities/usuario.entity';
import { Unidade } from '../../cliente/entities/unidade.entity';
import { ChecklistTemplate } from '../../checklist/entities/checklist-template.entity';
import { AuditoriaItem } from './auditoria-item.entity';

/**
 * Enum para status da auditoria.
 */
export enum StatusAuditoria {
  RASCUNHO = 'rascunho',
  EM_ANDAMENTO = 'em_andamento',
  FINALIZADA = 'finalizada',
  CANCELADA = 'cancelada',
}

/**
 * Entidade que representa uma auditoria realizada.
 */
@Entity('auditorias')
export class Auditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: StatusAuditoria,
    default: StatusAuditoria.RASCUNHO,
  })
  status: StatusAuditoria;

  @Column({ type: 'timestamp', nullable: true })
  dataInicio: Date;

  @Column({ type: 'timestamp', nullable: true })
  dataFim: Date;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitudeInicio: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitudeInicio: number;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitudeFim: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitudeFim: number;

  @Column({ type: 'text', nullable: true })
  observacoesGerais: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  pontuacaoTotal: number;

  @Column({ type: 'jsonb', nullable: true })
  resumoExecutivo: {
    resumo: string;
    pontosFortes: string[];
    pontosFracos: string[];
    recomendacoesPrioritarias: string[];
    riscoGeral: 'baixo' | 'medio' | 'alto' | 'critico';
    tendencias: string[];
  } | null;

  @Column({ type: 'timestamp', nullable: true })
  resumoExecutivoGeradoEm: Date | null;

  @Column({ type: 'text', nullable: true })
  pdfUrl: string | null;

  @Column({ type: 'timestamp', nullable: true })
  pdfGeradoEm: Date | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'consultor_id' })
  consultor: Usuario;

  @Column({ name: 'consultor_id' })
  consultorId: string;

  @ManyToOne(() => Unidade)
  @JoinColumn({ name: 'unidade_id' })
  unidade: Unidade;

  @Column({ name: 'unidade_id' })
  unidadeId: string;

  @ManyToOne(() => ChecklistTemplate)
  @JoinColumn({ name: 'template_id' })
  template: ChecklistTemplate;

  @Column({ name: 'template_id' })
  templateId: string;

  @OneToMany(() => AuditoriaItem, (item) => item.auditoria)
  itens: AuditoriaItem[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


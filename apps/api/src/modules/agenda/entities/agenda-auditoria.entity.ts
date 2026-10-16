import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Usuario } from '../../usuario/entities/usuario.entity';
import { Unidade } from '../../cliente/entities/unidade.entity';
import { ChecklistTemplate } from '../../checklist/entities/checklist-template.entity';

export enum StatusAgenda {
  AGENDADA = 'agendada',
  REALIZADA = 'realizada',
  CANCELADA = 'cancelada',
}

export enum RecorrenciaAgenda {
  NENHUMA = 'nenhuma',
  SEMANAL = 'semanal',
  QUINZENAL = 'quinzenal',
  MENSAL = 'mensal',
}

@Entity('agenda_auditorias')
export class AgendaAuditoria {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'gestor_id', type: 'uuid' })
  gestorId: string;

  @ManyToOne(() => Unidade, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unidade_id' })
  unidade: Unidade;

  @Column({ name: 'unidade_id', type: 'uuid' })
  unidadeId: string;

  @ManyToOne(() => ChecklistTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: ChecklistTemplate;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId: string;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'responsavel_id' })
  responsavel: Usuario | null;

  @Column({ name: 'responsavel_id', type: 'uuid', nullable: true })
  responsavelId: string | null;

  @Column({ name: 'criado_por_id', type: 'uuid' })
  criadoPorId: string;

  @Column({ name: 'data_prevista', type: 'date' })
  dataPrevista: string;

  @Column({ type: 'enum', enum: RecorrenciaAgenda, default: RecorrenciaAgenda.NENHUMA })
  recorrencia: RecorrenciaAgenda;

  @Column({ type: 'enum', enum: StatusAgenda, default: StatusAgenda.AGENDADA })
  status: StatusAgenda;

  @Column({ type: 'text', nullable: true })
  observacao: string | null;

  @Column({ name: 'realizada_em', type: 'timestamp', nullable: true })
  realizadaEm: Date | null;

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}

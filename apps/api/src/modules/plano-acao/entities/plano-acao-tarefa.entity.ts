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
import { Auditoria } from '../../auditoria/entities/auditoria.entity';

export enum StatusTarefaPlanoAcao {
  PENDENTE = 'pendente',
  EM_ANDAMENTO = 'em_andamento',
  CONCLUIDA = 'concluida',
  CANCELADA = 'cancelada',
}

@Entity('planos_acao_tarefas')
export class PlanoAcaoTarefa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'gestor_id', type: 'uuid' })
  gestorId: string;

  @ManyToOne(() => Auditoria, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'auditoria_id' })
  auditoria: Auditoria | null;

  @Column({ name: 'auditoria_id', type: 'uuid', nullable: true })
  auditoriaId: string | null;

  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descricao: string | null;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'responsavel_id' })
  responsavel: Usuario | null;

  @Column({ name: 'responsavel_id', type: 'uuid', nullable: true })
  responsavelId: string | null;

  @Column({ name: 'criado_por_id', type: 'uuid' })
  criadoPorId: string;

  @Column({ type: 'date' })
  prazo: string;

  @Column({
    type: 'enum',
    enum: StatusTarefaPlanoAcao,
    default: StatusTarefaPlanoAcao.PENDENTE,
  })
  status: StatusTarefaPlanoAcao;

  @Column({ name: 'concluida_em', type: 'timestamp', nullable: true })
  concluidaEm: Date | null;

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}

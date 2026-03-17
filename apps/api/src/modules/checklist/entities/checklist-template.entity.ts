import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TemplateItem } from './template-item.entity';
import { ChecklistGrupo } from './checklist-grupo.entity';
import { TipoAtividade } from '../../cliente/entities/cliente.entity';
import { Usuario } from '../../usuario/entities/usuario.entity';

export enum StatusTemplate {
  RASCUNHO = 'rascunho',
  ATIVO = 'ativo',
  INATIVO = 'inativo',
}

/**
 * Entidade que representa um template de checklist.
 */
@Entity('checklist_templates')
export class ChecklistTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  nome: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({
    type: 'enum',
    enum: TipoAtividade,
    default: TipoAtividade.OUTRO,
  })
  tipoAtividade: TipoAtividade;

  @Column({ length: 50, default: '1.0' })
  versao: string;

  @Column({
    type: 'enum',
    enum: StatusTemplate,
    default: StatusTemplate.RASCUNHO,
  })
  status: StatusTemplate;

  /** @deprecated Usar campo `status` */
  get ativo(): boolean {
    return this.status === StatusTemplate.ATIVO;
  }

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'gestor_id' })
  gestor: Usuario;

  @Column({ name: 'gestor_id', nullable: true, type: 'uuid' })
  gestorId: string | null;

  @OneToMany(() => TemplateItem, (item) => item.template)
  itens: TemplateItem[];

  @OneToMany(() => ChecklistGrupo, (grupo) => grupo.template)
  grupos: ChecklistGrupo[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


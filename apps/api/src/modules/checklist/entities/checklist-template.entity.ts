import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TemplateItem } from './template-item.entity';
import { ChecklistGrupo } from './checklist-grupo.entity';
import { TipoAtividade } from '../../cliente/entities/cliente.entity';

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

  @Column({ default: true })
  ativo: boolean;

  @OneToMany(() => TemplateItem, (item) => item.template)
  itens: TemplateItem[];

  @OneToMany(() => ChecklistGrupo, (grupo) => grupo.template)
  grupos: ChecklistGrupo[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


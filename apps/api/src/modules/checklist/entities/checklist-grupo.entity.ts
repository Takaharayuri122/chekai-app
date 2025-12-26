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
import { ChecklistTemplate } from './checklist-template.entity';
import { TemplateItem } from './template-item.entity';

/**
 * Entidade que representa um grupo de itens dentro de um template de checklist.
 * Grupos organizam as perguntas em categorias como "ESTRUTURA", "ESTOQUE", etc.
 */
@Entity('checklist_grupos')
export class ChecklistGrupo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  nome: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ type: 'int', default: 0 })
  ordem: number;

  @Column({ default: true })
  ativo: boolean;

  @ManyToOne(() => ChecklistTemplate, (template) => template.grupos)
  @JoinColumn({ name: 'template_id' })
  template: ChecklistTemplate;

  @Column({ name: 'template_id' })
  templateId: string;

  @OneToMany(() => TemplateItem, (item) => item.grupo)
  itens: TemplateItem[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


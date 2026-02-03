import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ChecklistTemplate } from './checklist-template.entity';
import { ChecklistGrupo } from './checklist-grupo.entity';

/**
 * Enum para categorias de itens do checklist.
 */
export enum CategoriaItem {
  ESTRUTURA = 'estrutura',
  HIGIENE = 'higiene',
  MANIPULADORES = 'manipuladores',
  DOCUMENTACAO = 'documentacao',
  ARMAZENAMENTO = 'armazenamento',
  PREPARACAO = 'preparacao',
  CONTROLE_PRAGAS = 'controle_pragas',
  EQUIPAMENTOS = 'equipamentos',
  OUTRO = 'outro',
}

/**
 * Enum para nível de criticidade do item.
 */
export enum CriticidadeItem {
  BAIXA = 'baixa',
  MEDIA = 'media',
  ALTA = 'alta',
  CRITICA = 'critica',
}

/**
 * Enum para tipo de resposta customizada.
 */
export enum TipoRespostaCustomizada {
  TEXTO = 'texto',
  NUMERO = 'numero',
  DATA = 'data',
  SELECT = 'select',
}

/**
 * Entidade que representa um item de um template de checklist.
 */
@Entity('template_itens')
export class TemplateItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  pergunta: string;

  @Column({
    type: 'enum',
    enum: CategoriaItem,
    default: CategoriaItem.OUTRO,
  })
  categoria: CategoriaItem;

  @Column({
    type: 'enum',
    enum: CriticidadeItem,
    default: CriticidadeItem.MEDIA,
  })
  criticidade: CriticidadeItem;

  @Column({ type: 'int', default: 1 })
  peso: number;

  @Column({ type: 'int', default: 0 })
  ordem: number;

  @Column({ length: 50, nullable: true })
  legislacaoReferencia: string;

  @Column({ length: 100, nullable: true })
  artigo: string;

  @Column({ type: 'text', nullable: true })
  textoLegal: string;

  @Column({ default: true })
  obrigatorio: boolean;

  @Column({ type: 'simple-array', nullable: true })
  opcoesResposta: string[];

  @Column({ type: 'jsonb', default: [] })
  opcoesRespostaConfig: Array<{
    valor: string;
    fotoObrigatoria: boolean;
    observacaoObrigatoria: boolean;
    pontuacao?: number;
  }>;

  @Column({ default: false })
  usarRespostasPersonalizadas: boolean;

  @Column({
    type: 'enum',
    enum: TipoRespostaCustomizada,
    nullable: true,
  })
  tipoRespostaCustomizada: TipoRespostaCustomizada;

  @Column({ default: true })
  ativo: boolean;

  @ManyToOne(() => ChecklistTemplate, (template) => template.itens)
  @JoinColumn({ name: 'template_id' })
  template: ChecklistTemplate;

  @Column({ name: 'template_id' })
  templateId: string;

  @ManyToOne(() => ChecklistGrupo, (grupo) => grupo.itens, { nullable: true })
  @JoinColumn({ name: 'grupo_id' })
  grupo: ChecklistGrupo;

  @Column({ name: 'grupo_id', nullable: true })
  grupoId: string;

  @Column({ length: 255, nullable: true })
  secao: string;

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


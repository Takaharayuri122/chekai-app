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
import { Auditoria } from './auditoria.entity';
import { TemplateItem } from '../../checklist/entities/template-item.entity';
import { Foto } from './foto.entity';

/**
 * Enum para resposta do item de auditoria.
 */
export enum RespostaItem {
  CONFORME = 'conforme',
  NAO_CONFORME = 'nao_conforme',
  NAO_APLICAVEL = 'nao_aplicavel',
  NAO_AVALIADO = 'nao_avaliado',
}

/**
 * Entidade que representa um item respondido em uma auditoria.
 */
@Entity('auditoria_itens')
export class AuditoriaItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: RespostaItem,
    default: RespostaItem.NAO_AVALIADO,
  })
  resposta: RespostaItem;

  @Column({ type: 'text', nullable: true })
  observacao: string;

  @Column({ type: 'text', nullable: true })
  descricaoNaoConformidade: string;

  @Column({ type: 'text', nullable: true })
  descricaoIa: string;

  @Column({ type: 'text', nullable: true })
  complementoDescricao: string;

  @Column({ type: 'text', nullable: true })
  planoAcaoSugerido: string;

  @Column({ type: 'text', nullable: true })
  planoAcaoFinal: string;

  @Column({ length: 100, nullable: true })
  referenciaLegal: string;

  @Column({ type: 'int', default: 0 })
  pontuacao: number;

  @ManyToOne(() => Auditoria, (auditoria) => auditoria.itens)
  @JoinColumn({ name: 'auditoria_id' })
  auditoria: Auditoria;

  @Column({ name: 'auditoria_id' })
  auditoriaId: string;

  @ManyToOne(() => TemplateItem)
  @JoinColumn({ name: 'template_item_id' })
  templateItem: TemplateItem;

  @Column({ name: 'template_item_id' })
  templateItemId: string;

  @OneToMany(() => Foto, (foto) => foto.auditoriaItem)
  fotos: Foto[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


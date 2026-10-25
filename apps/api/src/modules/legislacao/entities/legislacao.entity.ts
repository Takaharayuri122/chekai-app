import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { LegislacaoChunk } from './legislacao-chunk.entity';

/**
 * Enum para tipos de legislação.
 */
export enum TipoLegislacao {
  RDC = 'rdc',
  PORTARIA = 'portaria',
  INSTRUCAO_NORMATIVA = 'instrucao_normativa',
  LEI = 'lei',
  DECRETO = 'decreto',
  OUTRO = 'outro',
}

/**
 * Situação da legislação identificada na leitura automática.
 */
export enum SituacaoLegislacao {
  VIGENTE = 'vigente',
  VIGENTE_COM_ALTERACOES = 'vigente_com_alteracoes',
  REVOGADA = 'revogada',
}

/**
 * Andamento da leitura automática do conteúdo da legislação.
 */
export enum StatusLeitura {
  PENDENTE = 'pendente',
  LENDO = 'lendo',
  CONCLUIDA = 'concluida',
  FALHOU = 'falhou',
}

/**
 * De onde veio o texto lido da legislação.
 */
export enum OrigemTexto {
  LINK = 'link',
  PDF = 'pdf',
  TEXTO = 'texto',
}

/**
 * Entidade que representa uma legislação.
 */
@Entity('legislacoes')
export class Legislacao {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: TipoLegislacao,
    default: TipoLegislacao.RDC,
  })
  tipo: TipoLegislacao;

  @Column({ type: 'varchar', length: 50, nullable: true })
  numero: string | null;

  @Column({ type: 'int', nullable: true })
  ano: number | null;

  @Column({ length: 500 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  ementa: string;

  @Column({ length: 100, nullable: true })
  orgaoEmissor: string;

  @Column({ length: 500, nullable: true })
  linkOficial: string;

  @Column({ default: true })
  ativo: boolean;

  @Column({ type: 'text', nullable: true })
  informacoes: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  situacao: SituacaoLegislacao | null;

  @Column({ type: 'date', nullable: true })
  dataPublicacao: string | null;

  @Column({ type: 'varchar', length: 20, default: StatusLeitura.PENDENTE })
  statusLeitura: StatusLeitura;

  @Column({ type: 'text', nullable: true })
  erroLeitura: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lidoEm: Date | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  origemTexto: OrigemTexto | null;

  @Column({ type: 'uuid', nullable: true })
  criadoPorId: string | null;

  @OneToMany(() => LegislacaoChunk, (chunk) => chunk.legislacao)
  chunks: LegislacaoChunk[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


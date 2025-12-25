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

  @Column({ length: 50 })
  numero: string;

  @Column({ type: 'int' })
  ano: number;

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

  @OneToMany(() => LegislacaoChunk, (chunk) => chunk.legislacao)
  chunks: LegislacaoChunk[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


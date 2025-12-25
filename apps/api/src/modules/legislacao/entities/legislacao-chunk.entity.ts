import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Legislacao } from './legislacao.entity';

/**
 * Entidade que representa um chunk de legislação para RAG.
 * Cada chunk contém uma parte do texto com seu embedding vetorial.
 */
@Entity('legislacao_chunks')
export class LegislacaoChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  conteudo: string;

  @Column({ length: 100, nullable: true })
  artigo: string;

  @Column({ length: 100, nullable: true })
  inciso: string;

  @Column({ length: 100, nullable: true })
  paragrafo: string;

  @Column({ type: 'int', default: 0 })
  ordem: number;

  @Column({ type: 'int', nullable: true })
  tokenCount: number;

  @Column({
    type: 'vector',
    length: 1536,
    nullable: true,
  })
  @Index('idx_chunk_embedding', { synchronize: false })
  embedding: string;

  @ManyToOne(() => Legislacao, (legislacao) => legislacao.chunks)
  @JoinColumn({ name: 'legislacao_id' })
  legislacao: Legislacao;

  @Column({ name: 'legislacao_id' })
  legislacaoId: string;

  @CreateDateColumn()
  criadoEm: Date;
}


import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProvedorIa } from './uso-credito.entity';

/**
 * Entidade que configura a taxa de conversão de tokens para créditos.
 */
@Entity('configuracoes_credito')
export class ConfiguracaoCredito {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ProvedorIa,
  })
  provedor: ProvedorIa;

  @Column({ length: 100 })
  modelo: string;

  @Column({ type: 'int' })
  tokensPorCredito: number;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


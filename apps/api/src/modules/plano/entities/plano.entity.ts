import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Assinatura } from './assinatura.entity';

/**
 * Entidade que representa um plano disponível no sistema.
 */
@Entity('planos')
export class Plano {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  nome: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ type: 'int', default: 0 })
  limiteUsuarios: number;

  @Column({ type: 'int', default: 0 })
  limiteAuditorias: number;

  @Column({ type: 'int', default: 0 })
  limiteClientes: number;

  @Column({ type: 'int', default: 0 })
  limiteCreditos: number;

  @Column({ default: true })
  ativo: boolean;

  @OneToMany(() => Assinatura, (assinatura) => assinatura.plano)
  assinaturas: Assinatura[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


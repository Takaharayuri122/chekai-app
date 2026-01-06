import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Plano } from './plano.entity';
import { Usuario } from '../../usuario/entities/usuario.entity';

/**
 * Enum para status da assinatura.
 */
export enum StatusAssinatura {
  ATIVA = 'ativa',
  CANCELADA = 'cancelada',
  EXPIRADA = 'expirada',
}

/**
 * Entidade que representa uma assinatura de um gestor a um plano.
 */
@Entity('assinaturas')
export class Assinatura {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'gestor_id' })
  gestor: Usuario;

  @Column({ name: 'gestor_id' })
  gestorId: string;

  @ManyToOne(() => Plano)
  @JoinColumn({ name: 'plano_id' })
  plano: Plano;

  @Column({ name: 'plano_id' })
  planoId: string;

  @Column({
    type: 'enum',
    enum: StatusAssinatura,
    default: StatusAssinatura.ATIVA,
  })
  status: StatusAssinatura;

  @Column({ type: 'timestamp' })
  dataInicio: Date;

  @Column({ type: 'timestamp', nullable: true })
  dataFim: Date | null;

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Usuario } from '../../usuario/entities/usuario.entity';
import { Cliente } from '../../cliente/entities/cliente.entity';
import { Unidade } from '../../cliente/entities/unidade.entity';

export enum StatusCheckin {
  ABERTO = 'aberto',
  FECHADO = 'fechado',
}

@Entity('checkins')
export class Checkin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Cliente)
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;

  @Column({ name: 'cliente_id', type: 'uuid' })
  clienteId: string;

  @ManyToOne(() => Unidade)
  @JoinColumn({ name: 'unidade_id' })
  unidade: Unidade;

  @Column({ name: 'unidade_id', type: 'uuid' })
  unidadeId: string;

  @Column({
    type: 'enum',
    enum: StatusCheckin,
    default: StatusCheckin.ABERTO,
  })
  status: StatusCheckin;

  @Column({ name: 'data_checkin', type: 'timestamp' })
  dataCheckin: Date;

  @Column({ name: 'data_checkout', type: 'timestamp', nullable: true })
  dataCheckout: Date | null;

  @Column({ name: 'latitude_checkin', type: 'decimal', precision: 10, scale: 8 })
  latitudeCheckin: number;

  @Column({ name: 'longitude_checkin', type: 'decimal', precision: 11, scale: 8 })
  longitudeCheckin: number;

  @Column({ name: 'latitude_checkout', type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitudeCheckout: number | null;

  @Column({ name: 'longitude_checkout', type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitudeCheckout: number | null;

  @Column({ name: 'alerta_3h_emitido_em', type: 'timestamp', nullable: true })
  alerta3hEmitidoEm: Date | null;

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}

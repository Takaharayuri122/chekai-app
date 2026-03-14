import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { Cliente } from './cliente.entity';
import { Usuario } from '../../usuario/entities/usuario.entity';

/**
 * Entidade que representa uma unidade/filial de um cliente.
 */
@Entity('unidades')
export class Unidade {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  nome: string;

  @Column({ length: 500 })
  endereco: string;

  @Column({ length: 100, nullable: true })
  cidade: string;

  @Column({ length: 2, nullable: true })
  estado: string;

  @Column({ length: 10, nullable: true })
  cep: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ type: 'int', default: 100 })
  raioGeofencing: number;

  @Column({ length: 255 })
  responsavel: string;

  @Column({ length: 20, nullable: true })
  telefone: string;

  @Column({ length: 255 })
  email: string;

  @Column({ length: 20, nullable: true })
  whatsapp: string;

  @Column({ default: true })
  ativo: boolean;

  @ManyToOne(() => Cliente, (cliente) => cliente.unidades)
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;

  @Column({ name: 'cliente_id' })
  clienteId: string;

  @ManyToMany(() => Usuario)
  @JoinTable({
    name: 'unidade_auditores',
    joinColumn: { name: 'unidade_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'auditor_id', referencedColumnName: 'id' },
  })
  auditores: Usuario[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


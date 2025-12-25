import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Unidade } from './unidade.entity';

/**
 * Enum para tipos de atividade do cliente.
 */
export enum TipoAtividade {
  RESTAURANTE = 'restaurante',
  INDUSTRIA = 'industria',
  DISTRIBUIDORA = 'distribuidora',
  HOSPITAL = 'hospital',
  ESCOLA = 'escola',
  HOTEL = 'hotel',
  COZINHA_INDUSTRIAL = 'cozinha_industrial',
  PADARIA = 'padaria',
  OUTRO = 'outro',
}

/**
 * Entidade que representa um cliente (empresa).
 */
@Entity('clientes')
export class Cliente {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  razaoSocial: string;

  @Column({ length: 255, nullable: true })
  nomeFantasia: string;

  @Column({ length: 18, unique: true })
  cnpj: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ length: 20, nullable: true })
  telefone: string;

  @Column({
    type: 'enum',
    enum: TipoAtividade,
    default: TipoAtividade.OUTRO,
  })
  tipoAtividade: TipoAtividade;

  @Column({ length: 255, nullable: true })
  responsavelTecnico: string;

  @Column({ default: true })
  ativo: boolean;

  @OneToMany(() => Unidade, (unidade) => unidade.cliente)
  unidades: Unidade[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


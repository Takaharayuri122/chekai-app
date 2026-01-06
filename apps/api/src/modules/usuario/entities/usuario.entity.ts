import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

/**
 * Enum para perfis de usuário no sistema.
 */
export enum PerfilUsuario {
  MASTER = 'master',
  GESTOR = 'gestor',
  AUDITOR = 'auditor',
}

/**
 * Entidade que representa um usuário no sistema.
 */
@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  nome: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 255, select: false })
  senhaHash: string;

  @Column({
    type: 'enum',
    enum: PerfilUsuario,
    default: PerfilUsuario.GESTOR,
  })
  perfil: PerfilUsuario;

  @Column({ default: true })
  ativo: boolean;

  @Column({ length: 20, nullable: true })
  telefone: string;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'gestor_id' })
  gestor: Usuario;

  @Column({ name: 'gestor_id', type: 'uuid', nullable: true })
  gestorId: string | null;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @OneToMany(() => Usuario, (usuario) => usuario.gestor)
  auditores: Usuario[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


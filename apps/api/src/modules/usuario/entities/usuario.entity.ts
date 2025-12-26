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
  ANALISTA = 'analista',
  AUDITOR = 'auditor',
  EMPRESA = 'empresa',
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
    default: PerfilUsuario.ANALISTA,
  })
  perfil: PerfilUsuario;

  @Column({ default: true })
  ativo: boolean;

  @Column({ length: 20, nullable: true })
  telefone: string;

  @ManyToOne(() => Usuario, { nullable: true })
  @JoinColumn({ name: 'analista_id' })
  analista: Usuario;

  @Column({ name: 'analista_id', type: 'uuid', nullable: true })
  analistaId: string | null;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @OneToMany(() => Usuario, (usuario) => usuario.analista)
  auditores: Usuario[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


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

  @Column({ name: 'senha_hash', type: 'varchar', length: 255, select: false, nullable: true })
  senhaHash: string | null;

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

  @Column({ name: 'otp_code', type: 'varchar', length: 6, nullable: true })
  otpCode: string | null;

  @Column({ name: 'otp_expires_at', type: 'timestamp', nullable: true })
  otpExpiresAt: Date | null;

  @OneToMany(() => Usuario, (usuario) => usuario.gestor)
  auditores: Usuario[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}


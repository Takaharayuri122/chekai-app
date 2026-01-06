import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Usuario } from '../../usuario/entities/usuario.entity';

/**
 * Enum para provedores de IA.
 */
export enum ProvedorIa {
  OPENAI = 'openai',
  DEEPSEEK = 'deepseek',
}

/**
 * Entidade que registra cada uso de créditos de IA.
 */
@Entity('uso_creditos')
export class UsoCredito {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'gestor_id' })
  gestor: Usuario;

  @Column({ name: 'gestor_id' })
  gestorId: string;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'usuario_id' })
  usuarioId: string;

  @Column({
    type: 'enum',
    enum: ProvedorIa,
  })
  provedor: ProvedorIa;

  @Column({ length: 100 })
  modelo: string;

  @Column({ type: 'int' })
  tokensInput: number;

  @Column({ type: 'int' })
  tokensOutput: number;

  @Column({ type: 'int' })
  tokensTotal: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  creditosConsumidos: number;

  @Column({ length: 255 })
  metodoChamado: string;

  @Column({ type: 'text', nullable: true })
  contexto: string;

  @CreateDateColumn()
  criadoEm: Date;
}


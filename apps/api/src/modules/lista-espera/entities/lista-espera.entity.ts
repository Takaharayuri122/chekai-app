import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * Entidade que representa uma inscrição na lista de espera (fase beta).
 */
@Entity('lista_espera')
export class ListaEspera {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  telefone: string | null;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}

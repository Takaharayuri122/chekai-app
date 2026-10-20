import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ModeloSecao } from '../modelo-secoes';

/**
 * Modelo de relatório técnico do gestor: quais seções aparecem e com qual título.
 */
@Entity('modelos_relatorio_tecnico')
export class ModeloRelatorioTecnico {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'gestor_id', type: 'uuid', unique: true })
  gestorId: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  secoes: ModeloSecao[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}

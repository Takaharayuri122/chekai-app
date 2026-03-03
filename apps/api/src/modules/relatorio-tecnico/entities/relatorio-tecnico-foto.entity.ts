import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RelatorioTecnico } from './relatorio-tecnico.entity';

@Entity('relatorios_tecnicos_fotos')
export class RelatorioTecnicoFoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  nomeOriginal: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  mimeType: string | null;

  @Column({ type: 'int', nullable: true })
  tamanhoBytes: number | null;

  @Column({ type: 'jsonb', nullable: true })
  exif: Record<string, unknown> | null;

  @ManyToOne(() => RelatorioTecnico, (relatorio) => relatorio.fotos)
  @JoinColumn({ name: 'relatorio_tecnico_id' })
  relatorioTecnico: RelatorioTecnico;

  @Column({ name: 'relatorio_tecnico_id' })
  relatorioTecnicoId: string;

  @CreateDateColumn()
  criadoEm: Date;
}

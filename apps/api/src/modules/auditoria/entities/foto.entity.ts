import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AuditoriaItem } from './auditoria-item.entity';

/**
 * Entidade que representa uma foto anexada a um item de auditoria.
 */
@Entity('fotos')
export class Foto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 500 })
  url: string;

  @Column({ length: 255, nullable: true })
  nomeOriginal: string;

  @Column({ length: 50, nullable: true })
  mimeType: string;

  @Column({ type: 'int', nullable: true })
  tamanhoBytes: number;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  longitude: number;

  @Column({ type: 'timestamp', nullable: true })
  dataCaptura: Date;

  @Column({ type: 'text', nullable: true })
  analiseIa: string;

  @Column({ default: false })
  processadoPorIa: boolean;

  @ManyToOne(() => AuditoriaItem, (item) => item.fotos)
  @JoinColumn({ name: 'auditoria_item_id' })
  auditoriaItem: AuditoriaItem;

  @Column({ name: 'auditoria_item_id' })
  auditoriaItemId: string;

  @CreateDateColumn()
  criadoEm: Date;
}


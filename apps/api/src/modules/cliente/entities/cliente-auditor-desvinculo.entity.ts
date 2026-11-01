import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/**
 * Registro de quando um auditor deixou de estar vinculado a um cliente.
 * Permite aceitar auditorias iniciadas offline antes do desvínculo.
 */
@Entity('cliente_auditor_desvinculos')
@Index(['clienteId', 'auditorId'])
export class ClienteAuditorDesvinculo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'cliente_id', type: 'uuid' })
  clienteId: string;

  @Column({ name: 'auditor_id', type: 'uuid' })
  auditorId: string;

  @Column({ name: 'desvinculado_em', type: 'timestamp', default: () => 'now()' })
  desvinculadoEm: Date;
}

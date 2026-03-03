import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Cliente } from '../../cliente/entities/cliente.entity';
import { Unidade } from '../../cliente/entities/unidade.entity';
import { Usuario } from '../../usuario/entities/usuario.entity';
import { RelatorioTecnicoFoto } from './relatorio-tecnico-foto.entity';

export enum StatusRelatorioTecnico {
  RASCUNHO = 'rascunho',
  FINALIZADO = 'finalizado',
}

@Entity('relatorios_tecnicos')
export class RelatorioTecnico {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Cliente)
  @JoinColumn({ name: 'cliente_id' })
  cliente: Cliente;

  @Column({ name: 'cliente_id' })
  clienteId: string;

  @ManyToOne(() => Unidade, { nullable: true })
  @JoinColumn({ name: 'unidade_id' })
  unidade: Unidade | null;

  @Column({ name: 'unidade_id', nullable: true })
  unidadeId: string | null;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'consultora_id' })
  consultora: Usuario;

  @Column({ name: 'consultora_id' })
  consultoraId: string;

  @Column({ type: 'text' })
  identificacao: string;

  @Column({ name: 'descricao_ocorrencia_html', type: 'text' })
  descricaoOcorrenciaHtml: string;

  @Column({ name: 'avaliacao_tecnica_html', type: 'text' })
  avaliacaoTecnicaHtml: string;

  @Column({ name: 'acoes_executadas', type: 'jsonb', default: () => "'[]'::jsonb" })
  acoesExecutadas: string[];

  @Column({ name: 'recomendacoes_consultora_html', type: 'text' })
  recomendacoesConsultoraHtml: string;

  @Column({ name: 'plano_acao_sugerido_html', type: 'text' })
  planoAcaoSugeridoHtml: string;

  @Column({ name: 'apoio_analitico_chek_ai', type: 'text', nullable: true })
  apoioAnaliticoChekAi: string | null;

  @Column({
    type: 'enum',
    enum: StatusRelatorioTecnico,
    default: StatusRelatorioTecnico.RASCUNHO,
  })
  status: StatusRelatorioTecnico;

  @Column({ name: 'assinatura_nome_consultora', type: 'text' })
  assinaturaNomeConsultora: string;

  @Column({ name: 'pdf_url', type: 'text', nullable: true })
  pdfUrl: string | null;

  @Column({ name: 'pdf_gerado_em', type: 'timestamp', nullable: true })
  pdfGeradoEm: Date | null;

  @OneToMany(() => RelatorioTecnicoFoto, (foto) => foto.relatorioTecnico)
  fotos: RelatorioTecnicoFoto[];

  @CreateDateColumn()
  criadoEm: Date;

  @UpdateDateColumn()
  atualizadoEm: Date;
}

import { getDatabase } from '../client';

export type RelatorioTecnicoStatus = 'rascunho' | 'finalizado';
export type SyncStatus = 'pending' | 'synced' | 'error';

export interface CriarRelatorioTecnicoLocalInput {
  id: string;
  clienteId: string;
  unidadeId: string | null;
}

export interface AtualizarRelatorioTecnicoCampos {
  identificacao: string;
  descricaoOcorrenciaHtml: string;
  avaliacaoTecnicaHtml: string;
  acoesExecutadas: string[];
  recomendacoesConsultoraHtml: string;
  planoAcaoSugeridoHtml: string;
  assinaturaNomeConsultora: string;
  responsavel: string;
}

export interface RelatorioTecnicoListItem {
  id: string;
  remoteId: string | null;
  status: RelatorioTecnicoStatus;
  syncStatus: string;
  clienteNome: string;
  unidadeNome: string | null;
  identificacao: string;
  updatedAt: string;
}

export interface RelatorioTecnicoCompleto {
  id: string;
  remoteId: string | null;
  localId: string;
  clienteId: string;
  clienteNome: string;
  unidadeId: string | null;
  unidadeNome: string | null;
  identificacao: string;
  descricaoOcorrenciaHtml: string;
  avaliacaoTecnicaHtml: string;
  acoesExecutadas: string[];
  recomendacoesConsultoraHtml: string;
  planoAcaoSugeridoHtml: string;
  apoioAnalitico: string | null;
  status: RelatorioTecnicoStatus;
  assinaturaNomeConsultora: string | null;
  responsavel: string | null;
  syncStatus: string;
  pdfUrl: string | null;
  pdfLocalPath: string | null;
  updatedAt: string;
}

interface RelatorioTecnicoRow {
  id: string;
  remote_id: string | null;
  local_id: string;
  cliente_id: string;
  unidade_id: string | null;
  identificacao: string;
  descricao_ocorrencia_html: string | null;
  avaliacao_tecnica_html: string | null;
  acoes_executadas: string | null;
  recomendacoes_html: string | null;
  plano_acao_html: string | null;
  apoio_analitico: string | null;
  status: string;
  assinatura_nome: string | null;
  responsavel: string | null;
  sync_status: string;
  pdf_url: string | null;
  pdf_local_path: string | null;
  updated_at: string;
  razao_social: string;
  nome_unidade: string | null;
}

function parseAcoes(valor: string | null): string[] {
  if (!valor) {
    return [];
  }
  try {
    const parsed = JSON.parse(valor) as unknown;
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

function mapearCompleto(r: RelatorioTecnicoRow): RelatorioTecnicoCompleto {
  return {
    id: r.id,
    remoteId: r.remote_id,
    localId: r.local_id,
    clienteId: r.cliente_id,
    clienteNome: r.razao_social,
    unidadeId: r.unidade_id,
    unidadeNome: r.nome_unidade,
    identificacao: r.identificacao,
    descricaoOcorrenciaHtml: r.descricao_ocorrencia_html ?? '',
    avaliacaoTecnicaHtml: r.avaliacao_tecnica_html ?? '',
    acoesExecutadas: parseAcoes(r.acoes_executadas),
    recomendacoesConsultoraHtml: r.recomendacoes_html ?? '',
    planoAcaoSugeridoHtml: r.plano_acao_html ?? '',
    apoioAnalitico: r.apoio_analitico,
    status: r.status as RelatorioTecnicoStatus,
    assinaturaNomeConsultora: r.assinatura_nome,
    responsavel: r.responsavel,
    syncStatus: r.sync_status,
    pdfUrl: r.pdf_url,
    pdfLocalPath: r.pdf_local_path,
    updatedAt: r.updated_at,
  };
}

/**
 * Persistência local (SQLite, offline-first) dos relatórios técnicos. Edição de
 * rascunho funciona offline; o apoio analítico (IA) e o PDF dependem de conexão.
 */
export class RelatorioTecnicoRepo {
  private get db() { return getDatabase(); }

  create(data: CriarRelatorioTecnicoLocalInput): void {
    const now = new Date().toISOString();
    this.db.runSync(
      `INSERT INTO relatorios_tecnicos
       (id, remote_id, local_id, cliente_id, unidade_id, identificacao,
        descricao_ocorrencia_html, avaliacao_tecnica_html, acoes_executadas,
        recomendacoes_html, plano_acao_html, apoio_analitico, status,
        assinatura_nome, responsavel, sync_status, updated_at)
       VALUES (?, NULL, ?, ?, ?, '', '', '', '[]', '', '', NULL, 'rascunho', '', '', 'pending', ?)`,
      [data.id, data.id, data.clienteId, data.unidadeId, now],
    );
  }

  findAll(): RelatorioTecnicoListItem[] {
    const rows = this.db.getAllSync<RelatorioTecnicoRow>(
      `SELECT rt.*, c.razao_social, u.nome AS nome_unidade
       FROM relatorios_tecnicos rt
       JOIN clientes c ON c.id = rt.cliente_id
       LEFT JOIN unidades u ON u.id = rt.unidade_id
       WHERE rt.deleted_at IS NULL
       ORDER BY rt.updated_at DESC`,
    );
    return rows.map((r) => ({
      id: r.id,
      remoteId: r.remote_id,
      status: r.status as RelatorioTecnicoStatus,
      syncStatus: r.sync_status,
      clienteNome: r.razao_social,
      unidadeNome: r.nome_unidade,
      identificacao: r.identificacao,
      updatedAt: r.updated_at,
    }));
  }

  findById(id: string): RelatorioTecnicoCompleto | null {
    const r = this.db.getFirstSync<RelatorioTecnicoRow>(
      `SELECT rt.*, c.razao_social, u.nome AS nome_unidade
       FROM relatorios_tecnicos rt
       JOIN clientes c ON c.id = rt.cliente_id
       LEFT JOIN unidades u ON u.id = rt.unidade_id
       WHERE rt.id = ?`,
      [id],
    );
    if (!r) {
      return null;
    }
    return mapearCompleto(r);
  }

  updateCampos(id: string, campos: AtualizarRelatorioTecnicoCampos): void {
    const now = new Date().toISOString();
    this.db.runSync(
      `UPDATE relatorios_tecnicos
       SET identificacao = ?, descricao_ocorrencia_html = ?, avaliacao_tecnica_html = ?,
           acoes_executadas = ?, recomendacoes_html = ?, plano_acao_html = ?,
           assinatura_nome = ?, responsavel = ?, sync_status = 'pending', updated_at = ?
       WHERE id = ?`,
      [
        campos.identificacao,
        campos.descricaoOcorrenciaHtml,
        campos.avaliacaoTecnicaHtml,
        JSON.stringify(campos.acoesExecutadas),
        campos.recomendacoesConsultoraHtml,
        campos.planoAcaoSugeridoHtml,
        campos.assinaturaNomeConsultora,
        campos.responsavel,
        now,
        id,
      ],
    );
  }

  updateStatus(id: string, status: RelatorioTecnicoStatus): void {
    this.db.runSync(
      `UPDATE relatorios_tecnicos SET status = ?, sync_status = 'pending', updated_at = ? WHERE id = ?`,
      [status, new Date().toISOString(), id],
    );
  }

  setApoioAnalitico(id: string, apoio: string): void {
    this.db.runSync(
      `UPDATE relatorios_tecnicos SET apoio_analitico = ?, updated_at = ? WHERE id = ?`,
      [apoio, new Date().toISOString(), id],
    );
  }

  setRemoteId(id: string, remoteId: string): void {
    this.db.runSync(
      `UPDATE relatorios_tecnicos SET remote_id = ? WHERE id = ?`,
      [remoteId, id],
    );
  }

  markSynced(id: string, remoteId: string): void {
    this.db.runSync(
      `UPDATE relatorios_tecnicos SET remote_id = ?, sync_status = 'synced', updated_at = ? WHERE id = ?`,
      [remoteId, new Date().toISOString(), id],
    );
  }

  setSyncStatus(id: string, status: SyncStatus): void {
    this.db.runSync(
      `UPDATE relatorios_tecnicos SET sync_status = ? WHERE id = ?`,
      [status, id],
    );
  }

  updatePdfUrl(id: string, pdfUrl: string): void {
    this.db.runSync(
      `UPDATE relatorios_tecnicos SET pdf_url = ?, updated_at = ? WHERE id = ?`,
      [pdfUrl, new Date().toISOString(), id],
    );
  }

  updatePdfLocalPath(id: string, pdfLocalPath: string): void {
    this.db.runSync(
      `UPDATE relatorios_tecnicos SET pdf_local_path = ?, updated_at = ? WHERE id = ?`,
      [pdfLocalPath, new Date().toISOString(), id],
    );
  }

  softDelete(id: string): void {
    this.db.runSync(
      `UPDATE relatorios_tecnicos SET deleted_at = ?, updated_at = ? WHERE id = ?`,
      [new Date().toISOString(), new Date().toISOString(), id],
    );
  }

  isPending(id: string): boolean {
    const row = this.db.getFirstSync<{ sync_status: string }>(
      `SELECT sync_status FROM relatorios_tecnicos WHERE id = ?`,
      [id],
    );
    return row?.sync_status === 'pending';
  }

  /**
   * Retorna o `id` local de um relatório já vinculado ao `remoteId` informado,
   * permitindo reconciliar no pull o registro criado offline (id local) com o
   * id atribuído pelo servidor, evitando duplicatas.
   */
  findLocalIdByRemote(remoteId: string): string | null {
    const row = this.db.getFirstSync<{ id: string }>(
      `SELECT id FROM relatorios_tecnicos WHERE remote_id = ?`,
      [remoteId],
    );
    return row?.id ?? null;
  }

  /**
   * Insere ou atualiza um relatório técnico vindo do servidor, preservando registros
   * locais com `sync_status = 'pending'` (RN-SYN-007) para não sobrescrever edições offline.
   */
  upsertRemoto(input: {
    localId: string;
    remoteId: string;
    clienteId: string;
    unidadeId: string | null;
    identificacao: string;
    descricaoOcorrenciaHtml: string;
    avaliacaoTecnicaHtml: string;
    acoesExecutadas: string[];
    recomendacoesConsultoraHtml: string;
    planoAcaoSugeridoHtml: string;
    apoioAnalitico: string | null;
    status: RelatorioTecnicoStatus;
    assinaturaNomeConsultora: string;
    responsavel: string;
    pdfUrl: string | null;
  }): void {
    const now = new Date().toISOString();
    this.db.runSync(
      `INSERT INTO relatorios_tecnicos
         (id, remote_id, local_id, cliente_id, unidade_id, identificacao,
          descricao_ocorrencia_html, avaliacao_tecnica_html, acoes_executadas,
          recomendacoes_html, plano_acao_html, apoio_analitico, status,
          assinatura_nome, responsavel, pdf_url, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
       ON CONFLICT(id) DO UPDATE SET
         remote_id = excluded.remote_id,
         cliente_id = excluded.cliente_id,
         unidade_id = excluded.unidade_id,
         identificacao = excluded.identificacao,
         descricao_ocorrencia_html = excluded.descricao_ocorrencia_html,
         avaliacao_tecnica_html = excluded.avaliacao_tecnica_html,
         acoes_executadas = excluded.acoes_executadas,
         recomendacoes_html = excluded.recomendacoes_html,
         plano_acao_html = excluded.plano_acao_html,
         apoio_analitico = excluded.apoio_analitico,
         status = excluded.status,
         assinatura_nome = excluded.assinatura_nome,
         responsavel = excluded.responsavel,
         pdf_url = excluded.pdf_url,
         sync_status = 'synced',
         updated_at = excluded.updated_at
       WHERE relatorios_tecnicos.sync_status != 'pending'`,
      [
        input.localId, input.remoteId, input.localId, input.clienteId, input.unidadeId, input.identificacao,
        input.descricaoOcorrenciaHtml, input.avaliacaoTecnicaHtml, JSON.stringify(input.acoesExecutadas),
        input.recomendacoesConsultoraHtml, input.planoAcaoSugeridoHtml, input.apoioAnalitico, input.status,
        input.assinaturaNomeConsultora, input.responsavel, input.pdfUrl, now,
      ],
    );
  }
}

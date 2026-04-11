import { getDatabase } from '../client';

export interface CreateAuditoriaInput {
  id: string;            // UUID — same value written to both id and local_id
  clienteId: string;
  unidadeId: string;
  templateId: string;
  dataInicio: string;    // ISO 8601
  latitudeInicio?: number;
  longitudeInicio?: number;
}

export interface AuditoriaListItem {
  id: string;
  status: string;
  syncStatus: string;
  clienteNome: string;
  unidadeNome: string;
  dataInicio: string | null;
  pontuacaoTotal: number | null;
}

export interface AuditoriaCompleta {
  id: string;
  remoteId: string | null;
  localId: string;
  status: string;
  syncStatus: string;
  clienteId: string;
  clienteNome: string;      // joined from clientes.razao_social
  unidadeId: string;
  unidadeNome: string;      // joined from unidades.nome
  templateId: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  pontuacaoTotal: number | null;
  resumoExecutivo: string | null;
  analiseIa: string | null;
  pdfUrl: string | null;
  assinaturaNome: string | null;
}

export type AuditoriaStatus = 'rascunho' | 'em_andamento' | 'concluida';
export type SyncStatus = 'pending' | 'synced' | 'error';

export class AuditoriaRepo {
  private get db() { return getDatabase(); }

  create(data: CreateAuditoriaInput): void {
    const now = new Date().toISOString();
    this.db.runSync(
      `INSERT INTO auditorias
       (id, remote_id, local_id, status, data_inicio,
        latitude_inicio, longitude_inicio,
        cliente_id, unidade_id, template_id,
        sync_status, updated_at)
       VALUES (?, NULL, ?, 'rascunho', ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [data.id, data.id, data.dataInicio,
       data.latitudeInicio ?? null, data.longitudeInicio ?? null,
       data.clienteId, data.unidadeId, data.templateId, now]
    );
  }

  findAll(): AuditoriaListItem[] {
    const rows = this.db.getAllSync<{
      id: string; status: string; sync_status: string;
      razao_social: string; nome_unidade: string;
      data_inicio: string | null; pontuacao_total: number | null;
    }>(
      `SELECT a.id, a.status, a.sync_status,
              c.razao_social, u.nome AS nome_unidade,
              a.data_inicio, a.pontuacao_total
       FROM auditorias a
       JOIN clientes c ON c.id = a.cliente_id
       JOIN unidades u ON u.id = a.unidade_id
       WHERE a.deleted_at IS NULL
       ORDER BY a.data_inicio DESC`
    );
    return rows.map(r => ({
      id: r.id,
      status: r.status,
      syncStatus: r.sync_status,
      clienteNome: r.razao_social,
      unidadeNome: r.nome_unidade,
      dataInicio: r.data_inicio,
      pontuacaoTotal: r.pontuacao_total,
    }));
  }

  findById(id: string): AuditoriaCompleta | null {
    const r = this.db.getFirstSync<{
      id: string; remote_id: string | null; local_id: string;
      status: string; sync_status: string;
      cliente_id: string; razao_social: string;
      unidade_id: string; nome_unidade: string; template_id: string | null;
      data_inicio: string | null; data_fim: string | null;
      pontuacao_total: number | null; resumo_executivo: string | null;
      analise_ia: string | null; pdf_url: string | null;
      assinatura_nome: string | null;
    }>(
      `SELECT a.*, c.razao_social, u.nome AS nome_unidade
       FROM auditorias a
       JOIN clientes c ON c.id = a.cliente_id
       JOIN unidades u ON u.id = a.unidade_id
       WHERE a.id = ?`,
      [id]
    );
    if (!r) return null;
    return {
      id: r.id, remoteId: r.remote_id, localId: r.local_id,
      status: r.status, syncStatus: r.sync_status,
      clienteId: r.cliente_id, clienteNome: r.razao_social,
      unidadeId: r.unidade_id, unidadeNome: r.nome_unidade,
      templateId: r.template_id,
      dataInicio: r.data_inicio, dataFim: r.data_fim,
      pontuacaoTotal: r.pontuacao_total, resumoExecutivo: r.resumo_executivo,
      analiseIa: r.analise_ia, pdfUrl: r.pdf_url, assinaturaNome: r.assinatura_nome,
    };
  }

  updateStatus(id: string, status: AuditoriaStatus): void {
    this.db.runSync(
      `UPDATE auditorias SET status = ?, updated_at = ? WHERE id = ?`,
      [status, new Date().toISOString(), id]
    );
  }

  finalizarLocal(id: string, pontuacao: number): void {
    const now = new Date().toISOString();
    this.db.runSync(
      `UPDATE auditorias SET status = 'concluida', pontuacao_total = ?, data_fim = ?, updated_at = ? WHERE id = ?`,
      [pontuacao, now, now, id]
    );
  }

  updatePontuacao(id: string, pontuacao: number): void {
    this.db.runSync(
      `UPDATE auditorias SET pontuacao_total = ?, updated_at = ? WHERE id = ?`,
      [pontuacao, new Date().toISOString(), id]
    );
  }

  markSynced(id: string, remoteId: string): void {
    this.db.runSync(
      `UPDATE auditorias SET remote_id = ?, sync_status = ?, updated_at = ? WHERE id = ?`,
      [remoteId, 'synced', new Date().toISOString(), id]
    );
  }

  setSyncStatus(id: string, status: SyncStatus): void {
    this.db.runSync(
      `UPDATE auditorias SET sync_status = ? WHERE id = ?`,
      [status, id]
    );
  }

  updateAfterFinalize(id: string, data: { analiseIa?: string; pdfUrl?: string; resumoExecutivo?: string }): void {
    this.db.runSync(
      `UPDATE auditorias SET analise_ia = ?, pdf_url = ?, resumo_executivo = ?, updated_at = ? WHERE id = ?`,
      [data.analiseIa ?? null, data.pdfUrl ?? null, data.resumoExecutivo ?? null,
       new Date().toISOString(), id]
    );
  }
}

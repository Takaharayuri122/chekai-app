import { getDatabase } from '../client';
import { gerarUUID } from '../../utils/uuid';

export interface RelatorioFoto {
  id: string;
  relatorioId: string;
  filePath: string | null;
  url: string | null;
  remoteId: string | null;
  descricao: string | null;
  syncStatus: string;
}

interface RelatorioFotoRow {
  id: string;
  relatorio_id: string;
  file_path: string | null;
  url: string | null;
  remote_id: string | null;
  descricao: string | null;
  sync_status: string;
}

function mapear(r: RelatorioFotoRow): RelatorioFoto {
  return {
    id: r.id,
    relatorioId: r.relatorio_id,
    filePath: r.file_path,
    url: r.url,
    remoteId: r.remote_id,
    descricao: r.descricao,
    syncStatus: r.sync_status,
  };
}

const MAX_FOTOS_POR_RELATORIO = 50;

/**
 * Persistência local das evidências fotográficas do relatório técnico. As fotos
 * não passam por IA (RN-REL-006); o upload ocorre no push (online).
 */
export class RelatorioFotoRepo {
  private get db() { return getDatabase(); }

  add(relatorioId: string, filePath: string, descricao?: string): string {
    const id = gerarUUID();
    const now = new Date().toISOString();
    this.db.runSync(
      `INSERT INTO relatorio_fotos (id, remote_id, relatorio_id, file_path, descricao, sync_status, updated_at)
       VALUES (?, NULL, ?, ?, ?, 'pending', ?)`,
      [id, relatorioId, filePath, descricao ?? null, now],
    );
    return id;
  }

  findByRelatorio(relatorioId: string): RelatorioFoto[] {
    const rows = this.db.getAllSync<RelatorioFotoRow>(
      `SELECT * FROM relatorio_fotos WHERE relatorio_id = ? ORDER BY updated_at`,
      [relatorioId],
    );
    return rows.map(mapear);
  }

  findPendentes(relatorioId: string): RelatorioFoto[] {
    const rows = this.db.getAllSync<RelatorioFotoRow>(
      `SELECT * FROM relatorio_fotos WHERE relatorio_id = ? AND remote_id IS NULL AND file_path IS NOT NULL`,
      [relatorioId],
    );
    return rows.map(mapear);
  }

  countByRelatorio(relatorioId: string): number {
    const row = this.db.getFirstSync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM relatorio_fotos WHERE relatorio_id = ?`,
      [relatorioId],
    );
    return row?.total ?? 0;
  }

  findById(id: string): RelatorioFoto | null {
    const r = this.db.getFirstSync<RelatorioFotoRow>(
      `SELECT * FROM relatorio_fotos WHERE id = ?`,
      [id],
    );
    return r ? mapear(r) : null;
  }

  remove(id: string): void {
    this.db.runSync('DELETE FROM relatorio_fotos WHERE id = ?', [id]);
  }

  markSynced(id: string, remoteId: string, url: string): void {
    this.db.runSync(
      `UPDATE relatorio_fotos SET remote_id = ?, url = ?, sync_status = 'synced', updated_at = ? WHERE id = ?`,
      [remoteId, url, new Date().toISOString(), id],
    );
  }

  /**
   * Insere ou atualiza uma foto vinda do servidor (sem arquivo local), preservando
   * fotos `pending` (RN-SYN-007).
   */
  upsertRemota(input: { id: string; relatorioId: string; url: string }): void {
    const now = new Date().toISOString();
    this.db.runSync(
      `INSERT INTO relatorio_fotos (id, remote_id, relatorio_id, url, sync_status, updated_at)
       VALUES (?, ?, ?, ?, 'synced', ?)
       ON CONFLICT(id) DO UPDATE SET
         remote_id = excluded.remote_id,
         url = excluded.url,
         sync_status = 'synced',
         updated_at = excluded.updated_at
       WHERE relatorio_fotos.sync_status != 'pending'`,
      [input.id, input.id, input.relatorioId, input.url, now],
    );
  }
}

export { MAX_FOTOS_POR_RELATORIO };

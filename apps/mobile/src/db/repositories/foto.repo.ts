import { getDatabase } from '../client';
import { gerarUUID } from '../../utils/uuid';

export interface Foto {
  id: string;
  auditoriaItemId: string;
  filePath: string | null;
  url: string | null;
  remoteId: string | null;
  syncStatus: string;
  latitude: number | null;
  longitude: number | null;
  tamanhoBytes: number | null;
  analiseIa: string | null;
}

export interface LatLng { latitude: number; longitude: number; }

export class FotoRepo {
  private get db() { return getDatabase(); }

  add(itemId: string, filePath: string, coords?: LatLng, tamanhoBytes?: number): string {
    const id = gerarUUID();
    const now = new Date().toISOString();
    this.db.runSync(
      `INSERT INTO fotos (id, auditoria_item_id, file_path, tamanho_bytes, latitude, longitude, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [id, itemId, filePath, tamanhoBytes ?? null, coords?.latitude ?? null, coords?.longitude ?? null, now]
    );
    return id;
  }

  findByItem(itemId: string): Foto[] {
    const rows = this.db.getAllSync<{
      id: string; auditoria_item_id: string; file_path: string | null;
      url: string | null; remote_id: string | null; sync_status: string;
      latitude: number | null; longitude: number | null; tamanho_bytes: number | null;
      analise_ia: string | null;
    }>('SELECT * FROM fotos WHERE auditoria_item_id = ?', [itemId]);
    return rows.map(r => ({
      id: r.id, auditoriaItemId: r.auditoria_item_id,
      filePath: r.file_path, url: r.url, remoteId: r.remote_id, syncStatus: r.sync_status,
      latitude: r.latitude, longitude: r.longitude, tamanhoBytes: r.tamanho_bytes,
      analiseIa: r.analise_ia,
    }));
  }

  findByAuditoria(auditoriaId: string): Foto[] {
    const rows = this.db.getAllSync<{
      id: string; auditoria_item_id: string; file_path: string | null;
      url: string | null; remote_id: string | null; sync_status: string;
      latitude: number | null; longitude: number | null; tamanho_bytes: number | null;
      analise_ia: string | null;
    }>(
      `SELECT f.* FROM fotos f
       JOIN auditoria_itens ai ON ai.id = f.auditoria_item_id
       WHERE ai.auditoria_id = ?`,
      [auditoriaId]
    );
    return rows.map(r => ({
      id: r.id, auditoriaItemId: r.auditoria_item_id,
      filePath: r.file_path, url: r.url, remoteId: r.remote_id, syncStatus: r.sync_status,
      latitude: r.latitude, longitude: r.longitude, tamanhoBytes: r.tamanho_bytes,
      analiseIa: r.analise_ia,
    }));
  }

  remove(id: string): void {
    this.db.runSync('DELETE FROM fotos WHERE id = ?', [id]);
  }

  /**
   * Insere ou atualiza uma foto vinda do servidor (sem arquivo local), preservando
   * fotos com `sync_status = 'pending'` (RN-SYN-007). A `url` remota é usada para exibição.
   */
  upsertRemota(input: {
    id: string;
    auditoriaItemId: string;
    url: string;
    analiseIa?: string | null;
    tamanhoBytes?: number | null;
    latitude?: number | null;
    longitude?: number | null;
  }): void {
    const now = new Date().toISOString();
    this.db.runSync(
      `INSERT INTO fotos
         (id, remote_id, auditoria_item_id, url, tamanho_bytes, analise_ia, latitude, longitude, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
       ON CONFLICT(id) DO UPDATE SET
         remote_id = excluded.remote_id,
         url = excluded.url,
         tamanho_bytes = excluded.tamanho_bytes,
         analise_ia = excluded.analise_ia,
         latitude = excluded.latitude,
         longitude = excluded.longitude,
         sync_status = 'synced',
         updated_at = excluded.updated_at
       WHERE fotos.sync_status != 'pending'`,
      [input.id, input.id, input.auditoriaItemId, input.url,
       input.tamanhoBytes ?? null, input.analiseIa ?? null,
       input.latitude ?? null, input.longitude ?? null, now]
    );
  }

  /**
   * Persiste localmente a análise de IA de uma foto (JSON stringificado).
   */
  setAnalise(id: string, analiseIa: string): void {
    this.db.runSync(
      `UPDATE fotos SET analise_ia = ?, updated_at = ? WHERE id = ?`,
      [analiseIa, new Date().toISOString(), id]
    );
  }

  markSynced(id: string, remoteId: string, url: string): void {
    this.db.runSync(
      `UPDATE fotos SET remote_id = ?, url = ?, sync_status = ?, updated_at = ? WHERE id = ?`,
      [remoteId, url, 'synced', new Date().toISOString(), id]
    );
  }
}

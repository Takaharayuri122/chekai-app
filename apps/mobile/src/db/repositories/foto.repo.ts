import { getDatabase } from '../client';

export interface Foto {
  id: string;
  auditoriaItemId: string;
  filePath: string | null;
  url: string | null;
  syncStatus: string;
  latitude: number | null;
  longitude: number | null;
}

export interface LatLng { latitude: number; longitude: number; }

export class FotoRepo {
  private get db() { return getDatabase(); }

  add(itemId: string, filePath: string, coords?: LatLng): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    this.db.runSync(
      `INSERT INTO fotos (id, auditoria_item_id, file_path, latitude, longitude, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [id, itemId, filePath, coords?.latitude ?? null, coords?.longitude ?? null, now]
    );
    return id;
  }

  findByItem(itemId: string): Foto[] {
    const rows = this.db.getAllSync<{
      id: string; auditoria_item_id: string; file_path: string | null;
      url: string | null; sync_status: string;
      latitude: number | null; longitude: number | null;
    }>('SELECT * FROM fotos WHERE auditoria_item_id = ?', [itemId]);
    return rows.map(r => ({
      id: r.id, auditoriaItemId: r.auditoria_item_id,
      filePath: r.file_path, url: r.url, syncStatus: r.sync_status,
      latitude: r.latitude, longitude: r.longitude,
    }));
  }

  findByAuditoria(auditoriaId: string): Foto[] {
    const rows = this.db.getAllSync<{
      id: string; auditoria_item_id: string; file_path: string | null;
      url: string | null; sync_status: string;
      latitude: number | null; longitude: number | null;
    }>(
      `SELECT f.* FROM fotos f
       JOIN auditoria_itens ai ON ai.id = f.auditoria_item_id
       WHERE ai.auditoria_id = ?`,
      [auditoriaId]
    );
    return rows.map(r => ({
      id: r.id, auditoriaItemId: r.auditoria_item_id,
      filePath: r.file_path, url: r.url, syncStatus: r.sync_status,
      latitude: r.latitude, longitude: r.longitude,
    }));
  }

  remove(id: string): void {
    this.db.runSync('DELETE FROM fotos WHERE id = ?', [id]);
  }

  markSynced(id: string, remoteId: string, url: string): void {
    this.db.runSync(
      `UPDATE fotos SET remote_id = ?, url = ?, sync_status = ?, updated_at = ? WHERE id = ?`,
      [remoteId, url, 'synced', new Date().toISOString(), id]
    );
  }
}

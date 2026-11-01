import { getDatabase } from '../client';
import { gerarUUID } from '../../utils/uuid';

export type EntidadeFila = 'auditoria' | 'relatorio_tecnico' | 'checkin';
export type StatusFila = 'pendente' | 'falhou';

export interface ItemFila {
  id: string;
  entidade: EntidadeFila;
  localId: string;
  retries: number;
}

const MAX_TENTATIVAS = 5;

function payloadDe(localId: string): string {
  return JSON.stringify({ localId });
}

export class FilaRepo {
  private get db() {
    return getDatabase();
  }

  enfileirar(entidade: EntidadeFila, localId: string, usuarioId: string): void {
    const agora = new Date().toISOString();
    const payload = payloadDe(localId);
    const existente = this.db.getFirstSync<{ id: string }>(
      'SELECT id FROM sync_queue WHERE entity = ? AND payload = ? LIMIT 1',
      [entidade, payload],
    );
    if (existente) {
      this.db.runSync(
        `UPDATE sync_queue SET status = 'pendente', atualizado_em = ? WHERE id = ? AND status = 'falhou'`,
        [agora, existente.id],
      );
      return;
    }
    this.db.runSync(
      `INSERT INTO sync_queue (id, entity, operation, payload, retries, created_at, usuario_id, status, atualizado_em)
       VALUES (?, ?, 'push', ?, 0, ?, ?, 'pendente', ?)`,
      [gerarUUID(), entidade, payload, agora, usuarioId, agora],
    );
  }

  listarParaEnvio(usuarioId: string): ItemFila[] {
    const rows = this.db.getAllSync<{ id: string; entity: string; payload: string; retries: number }>(
      `SELECT id, entity, payload, retries FROM sync_queue
       WHERE status = 'pendente' AND (usuario_id = ? OR usuario_id IS NULL)
       ORDER BY created_at ASC`,
      [usuarioId],
    );
    return rows.map((r) => ({
      id: r.id,
      entidade: r.entity as EntidadeFila,
      localId: (JSON.parse(r.payload) as { localId: string }).localId,
      retries: r.retries,
    }));
  }

  registrarFalha(id: string, erro: string, definitiva: boolean): void {
    this.db.runSync(
      `UPDATE sync_queue
       SET retries = retries + 1,
           ultimo_erro = ?,
           atualizado_em = ?,
           status = CASE WHEN ? = 1 OR retries + 1 >= ${MAX_TENTATIVAS} THEN 'falhou' ELSE 'pendente' END
       WHERE id = ?`,
      [erro, new Date().toISOString(), definitiva ? 1 : 0, id],
    );
  }

  remover(id: string): void {
    this.db.runSync('DELETE FROM sync_queue WHERE id = ?', [id]);
  }

  tentarDeNovo(entidade: EntidadeFila, localId: string): void {
    this.db.runSync(
      `UPDATE sync_queue SET retries = 0, status = 'pendente', atualizado_em = ?
       WHERE entity = ? AND payload = ?`,
      [new Date().toISOString(), entidade, payloadDe(localId)],
    );
  }

  estado(entidade: EntidadeFila, localId: string): { status: StatusFila; ultimoErro: string | null } | null {
    const row = this.db.getFirstSync<{ status: StatusFila; ultimo_erro: string | null }>(
      'SELECT status, ultimo_erro FROM sync_queue WHERE entity = ? AND payload = ? LIMIT 1',
      [entidade, payloadDe(localId)],
    );
    return row ? { status: row.status, ultimoErro: row.ultimo_erro } : null;
  }

  contarPendentes(usuarioId: string, entidade?: EntidadeFila): number {
    const params: string[] = [usuarioId];
    let sql = 'SELECT COUNT(*) AS total FROM sync_queue WHERE (usuario_id = ? OR usuario_id IS NULL)';
    if (entidade) {
      sql += ' AND entity = ?';
      params.push(entidade);
    }
    return this.db.getFirstSync<{ total: number }>(sql, params)?.total ?? 0;
  }
}

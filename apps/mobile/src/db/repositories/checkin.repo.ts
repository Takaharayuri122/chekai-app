import { getDatabase } from '../client';

export interface CheckinAberto {
  id: string;
  remoteId: string | null;
  usuarioId: string;
  clienteId: string;
  clienteNome: string | null;
  unidadeId: string;
  unidadeNome: string | null;
  dataCheckin: string;
  latitudeCheckin: number;
  longitudeCheckin: number;
  isAtrasado3h: boolean;
}

export interface SalvarCheckinAbertoInput {
  id: string;
  remoteId: string | null;
  usuarioId: string;
  clienteId: string;
  clienteNome: string | null;
  unidadeId: string;
  unidadeNome: string | null;
  dataCheckin: string;
  latitudeCheckin: number;
  longitudeCheckin: number;
  isAtrasado3h: boolean;
}

interface CheckinRow {
  id: string;
  remote_id: string | null;
  usuario_id: string;
  cliente_id: string;
  cliente_nome: string | null;
  unidade_id: string;
  unidade_nome: string | null;
  data_checkin: string;
  latitude_checkin: number;
  longitude_checkin: number;
  is_atrasado_3h: number;
}

function mapear(r: CheckinRow): CheckinAberto {
  return {
    id: r.id,
    remoteId: r.remote_id,
    usuarioId: r.usuario_id,
    clienteId: r.cliente_id,
    clienteNome: r.cliente_nome,
    unidadeId: r.unidade_id,
    unidadeNome: r.unidade_nome,
    dataCheckin: r.data_checkin,
    latitudeCheckin: r.latitude_checkin,
    longitudeCheckin: r.longitude_checkin,
    isAtrasado3h: r.is_atrasado_3h === 1,
  };
}

/**
 * Cache local (somente leitura) do check-in aberto do usuário. O fluxo de
 * check-in/checkout é online-only (validações de servidor — RN-CKI-001/002/003);
 * este cache permite exibir o estado atual mesmo quando o app fica offline.
 */
export class CheckinRepo {
  private get db() { return getDatabase(); }

  findAberto(usuarioId: string): CheckinAberto | null {
    const row = this.db.getFirstSync<CheckinRow>(
      `SELECT id, remote_id, usuario_id, cliente_id, cliente_nome, unidade_id, unidade_nome,
              data_checkin, latitude_checkin, longitude_checkin, is_atrasado_3h
       FROM checkins
       WHERE usuario_id = ? AND status = 'aberto'
       ORDER BY data_checkin DESC
       LIMIT 1`,
      [usuarioId],
    );
    return row ? mapear(row) : null;
  }

  /**
   * Substitui o cache do check-in aberto do usuário: remove o anterior e grava o
   * novo. Mantém apenas um registro aberto por usuário, refletindo a regra de
   * "apenas 1 aberto" (RN-CKI-001) validada no servidor.
   */
  salvarAberto(input: SalvarCheckinAbertoInput): void {
    const now = new Date().toISOString();
    this.db.withTransactionSync(() => {
      this.db.runSync(`DELETE FROM checkins WHERE usuario_id = ?`, [input.usuarioId]);
      this.db.runSync(
        `INSERT INTO checkins
           (id, remote_id, usuario_id, cliente_id, cliente_nome, unidade_id, unidade_nome,
            status, data_checkin, latitude_checkin, longitude_checkin, is_atrasado_3h,
            sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'aberto', ?, ?, ?, ?, 'synced', ?)`,
        [
          input.id, input.remoteId, input.usuarioId, input.clienteId, input.clienteNome,
          input.unidadeId, input.unidadeNome, input.dataCheckin,
          input.latitudeCheckin, input.longitudeCheckin, input.isAtrasado3h ? 1 : 0, now,
        ],
      );
    });
  }

  /** Limpa o cache do check-in aberto do usuário (após checkout ou ausência de aberto). */
  limparAberto(usuarioId: string): void {
    this.db.runSync(`DELETE FROM checkins WHERE usuario_id = ?`, [usuarioId]);
  }
}

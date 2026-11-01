import { getDatabase } from '../client';

export type EnvioStatusCheckin = 'pendente' | 'enviado' | 'recusado';

/**
 * Registro local de check-in/checkout. `envioStatus` é NULL para registros vindos do
 * servidor (cache) e preenchido para marcações feitas no aparelho.
 */
export interface CheckinRegistro {
  id: string;
  remoteId: string | null;
  usuarioId: string;
  clienteId: string;
  clienteNome: string | null;
  unidadeId: string;
  unidadeNome: string | null;
  status: 'aberto' | 'fechado';
  dataCheckin: string;
  dataCheckout: string | null;
  latitudeCheckin: number | null;
  longitudeCheckin: number | null;
  latitudeCheckout: number | null;
  longitudeCheckout: number | null;
  isAtrasado3h: boolean;
  checkinOffline: boolean;
  checkinSincronizadoEm: string | null;
  checkoutOffline: boolean;
  checkoutSincronizadoEm: string | null;
  envioStatus: EnvioStatusCheckin | null;
  envioErro: string | null;
}

export type CheckinAberto = CheckinRegistro;

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

export interface SalvarOfflineInput {
  /** UUID gerado no aparelho; vira `id` e `local_id` e a chave de idempotência na API. */
  id: string;
  usuarioId: string;
  clienteId: string;
  clienteNome: string | null;
  unidadeId: string;
  unidadeNome: string | null;
  dataCheckin: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface CoordenadasCheckin {
  latitude: number;
  longitude: number;
}

interface CheckinRow {
  id: string;
  remote_id: string | null;
  usuario_id: string;
  cliente_id: string;
  cliente_nome: string | null;
  unidade_id: string;
  unidade_nome: string | null;
  status: 'aberto' | 'fechado';
  data_checkin: string;
  data_checkout: string | null;
  latitude_checkin: number | null;
  longitude_checkin: number | null;
  latitude_checkout: number | null;
  longitude_checkout: number | null;
  is_atrasado_3h: number;
  checkin_offline: number;
  checkin_sincronizado_em: string | null;
  checkout_offline: number;
  checkout_sincronizado_em: string | null;
  envio_status: EnvioStatusCheckin | null;
  envio_erro: string | null;
}

const COLUNAS = `id, remote_id, usuario_id, cliente_id, cliente_nome, unidade_id, unidade_nome,
              status, data_checkin, data_checkout, latitude_checkin, longitude_checkin,
              latitude_checkout, longitude_checkout, is_atrasado_3h, checkin_offline,
              checkin_sincronizado_em, checkout_offline, checkout_sincronizado_em,
              envio_status, envio_erro`;

function mapear(r: CheckinRow): CheckinRegistro {
  return {
    id: r.id,
    remoteId: r.remote_id,
    usuarioId: r.usuario_id,
    clienteId: r.cliente_id,
    clienteNome: r.cliente_nome,
    unidadeId: r.unidade_id,
    unidadeNome: r.unidade_nome,
    status: r.status,
    dataCheckin: r.data_checkin,
    dataCheckout: r.data_checkout,
    latitudeCheckin: r.latitude_checkin,
    longitudeCheckin: r.longitude_checkin,
    latitudeCheckout: r.latitude_checkout,
    longitudeCheckout: r.longitude_checkout,
    isAtrasado3h: r.is_atrasado_3h === 1,
    checkinOffline: r.checkin_offline === 1,
    checkinSincronizadoEm: r.checkin_sincronizado_em,
    checkoutOffline: r.checkout_offline === 1,
    checkoutSincronizadoEm: r.checkout_sincronizado_em,
    envioStatus: r.envio_status,
    envioErro: r.envio_erro,
  };
}

/**
 * Check-in/checkout local. Registros do servidor (`envio_status` NULL) são só cache do
 * check-in aberto; marcações feitas no aparelho (com ou sem internet) guardam a hora do
 * telefone, entram na fila de envio (`sync_queue`, entidade `checkin`) e mostram o estado
 * de envio (`pendente` | `enviado` | `recusado`). As regras de negócio
 * (RN-CKI-001/002/003) continuam validadas no servidor: uma recusa (409) mantém a marcação
 * visível com o motivo até o usuário descartá-la. Nas marcações locais `id` = `local_id`,
 * e é esse `id` que identifica o registro na fila e nos métodos abaixo.
 */
export class CheckinRepo {
  private get db() { return getDatabase(); }

  /** Check-in aberto do usuário (marcações recusadas não contam). */
  findAberto(usuarioId: string): CheckinAberto | null {
    const row = this.db.getFirstSync<CheckinRow>(
      `SELECT ${COLUNAS}
       FROM checkins
       WHERE usuario_id = ? AND status = 'aberto'
         AND (envio_status IS NULL OR envio_status != 'recusado')
       ORDER BY data_checkin DESC
       LIMIT 1`,
      [usuarioId],
    );
    return row ? mapear(row) : null;
  }

  findPorId(id: string): CheckinRegistro | null {
    const row = this.db.getFirstSync<CheckinRow>(
      `SELECT ${COLUNAS} FROM checkins WHERE id = ?`,
      [id],
    );
    return row ? mapear(row) : null;
  }

  /** True se há marcação do usuário ainda aguardando envio (o cache do servidor não deve sobrescrevê-la). */
  temEnvioPendente(usuarioId: string): boolean {
    const row = this.db.getFirstSync<{ id: string }>(
      `SELECT id FROM checkins WHERE usuario_id = ? AND envio_status = 'pendente' LIMIT 1`,
      [usuarioId],
    );
    return Boolean(row);
  }

  /**
   * Substitui o cache do check-in aberto vindo do servidor. Preserva as marcações
   * feitas no aparelho (`envio_status` preenchido) e não duplica um check-in que o
   * aparelho já enviou (mesmo `remote_id`).
   */
  salvarAberto(input: SalvarCheckinAbertoInput): void {
    const now = new Date().toISOString();
    this.db.withTransactionSync(() => {
      this.db.runSync(
        `DELETE FROM checkins WHERE usuario_id = ? AND envio_status IS NULL`,
        [input.usuarioId],
      );
      const existente = input.remoteId
        ? this.db.getFirstSync<{ id: string }>(
          `SELECT id FROM checkins WHERE remote_id = ? LIMIT 1`,
          [input.remoteId],
        )
        : null;
      if (existente) {
        this.db.runSync(
          `UPDATE checkins SET is_atrasado_3h = ?, updated_at = ? WHERE id = ?`,
          [input.isAtrasado3h ? 1 : 0, now, existente.id],
        );
        return;
      }
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

  /**
   * Limpa o cache do check-in aberto (ausência de aberto no servidor ou checkout online).
   * Marcações do aparelho não são apagadas: as já enviadas apenas passam a fechadas.
   */
  limparAberto(usuarioId: string): void {
    const now = new Date().toISOString();
    this.db.withTransactionSync(() => {
      this.db.runSync(
        `DELETE FROM checkins WHERE usuario_id = ? AND envio_status IS NULL`,
        [usuarioId],
      );
      this.db.runSync(
        `UPDATE checkins SET status = 'fechado', data_checkout = COALESCE(data_checkout, ?), updated_at = ?
         WHERE usuario_id = ? AND status = 'aberto' AND envio_status = 'enviado'`,
        [now, now, usuarioId],
      );
    });
  }

  /** Grava um check-in feito no aparelho, com a hora do telefone, aguardando envio. */
  salvarOffline(input: SalvarOfflineInput): void {
    const now = new Date().toISOString();
    this.db.runSync(
      `INSERT INTO checkins
         (id, remote_id, local_id, usuario_id, cliente_id, cliente_nome, unidade_id, unidade_nome,
          status, data_checkin, latitude_checkin, longitude_checkin, is_atrasado_3h,
          checkin_offline, envio_status, sync_status, updated_at)
       VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 'aberto', ?, ?, ?, 0, 1, 'pendente', 'pending', ?)`,
      [
        input.id, input.id, input.usuarioId, input.clienteId, input.clienteNome,
        input.unidadeId, input.unidadeNome, input.dataCheckin,
        input.latitude ?? null, input.longitude ?? null, now,
      ],
    );
  }

  /** Registra o checkout feito no aparelho (hora do telefone) e volta a marcação para pendente. */
  registrarCheckoutOffline(
    localId: string,
    dataCheckout: string,
    coords?: CoordenadasCheckin | null,
  ): void {
    this.db.runSync(
      `UPDATE checkins
       SET status = 'fechado', data_checkout = ?, latitude_checkout = ?, longitude_checkout = ?,
           checkout_offline = 1, checkout_sincronizado_em = NULL,
           envio_status = 'pendente', envio_erro = NULL, sync_status = 'pending', updated_at = ?
       WHERE id = ?`,
      [dataCheckout, coords?.latitude ?? null, coords?.longitude ?? null, new Date().toISOString(), localId],
    );
  }

  /**
   * Marca uma etapa como enviada. Após o check-in, a marcação só vira "enviado" se não
   * houver checkout local ainda por enviar.
   */
  marcarEnviado(
    localId: string,
    etapa: 'checkin' | 'checkout',
    remoteId: string | undefined,
    sincronizadoEm: string,
  ): void {
    if (etapa === 'checkin') {
      this.db.runSync(
        `UPDATE checkins
         SET remote_id = COALESCE(?, remote_id), checkin_sincronizado_em = ?,
             envio_status = CASE
               WHEN checkout_offline = 1 AND checkout_sincronizado_em IS NULL THEN 'pendente'
               ELSE 'enviado' END,
             envio_erro = NULL, sync_status = 'synced', updated_at = ?
         WHERE id = ?`,
        [remoteId ?? null, sincronizadoEm, sincronizadoEm, localId],
      );
      return;
    }
    this.db.runSync(
      `UPDATE checkins
       SET remote_id = COALESCE(?, remote_id), checkout_sincronizado_em = ?,
           envio_status = 'enviado', envio_erro = NULL, sync_status = 'synced', updated_at = ?
       WHERE id = ?`,
      [remoteId ?? null, sincronizadoEm, sincronizadoEm, localId],
    );
  }

  /** Mantém a marcação visível com o motivo da recusa do servidor. */
  marcarRecusado(localId: string, erro: string): void {
    this.db.runSync(
      `UPDATE checkins SET envio_status = 'recusado', envio_erro = ?, updated_at = ? WHERE id = ?`,
      [erro, new Date().toISOString(), localId],
    );
  }

  /** Descarta a marcação local e o item correspondente da fila de envio. */
  descartar(localId: string): void {
    this.db.withTransactionSync(() => {
      this.db.runSync(`DELETE FROM checkins WHERE id = ?`, [localId]);
      this.db.runSync(
        `DELETE FROM sync_queue WHERE entity = 'checkin' AND payload = ?`,
        [JSON.stringify({ localId })],
      );
    });
  }

  /** Marcações feitas no aparelho nos últimos `dias` dias (mais recentes primeiro). */
  listarRecentesOffline(usuarioId: string, dias = 7): CheckinRegistro[] {
    const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
    const rows = this.db.getAllSync<CheckinRow>(
      `SELECT ${COLUNAS}
       FROM checkins
       WHERE usuario_id = ? AND envio_status IS NOT NULL AND data_checkin >= ?
       ORDER BY data_checkin DESC`,
      [usuarioId, desde],
    );
    return rows.map(mapear);
  }
}

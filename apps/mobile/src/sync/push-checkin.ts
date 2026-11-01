import { CheckinRepo } from '../db/repositories/checkin.repo';
import {
  iniciarCheckin, finalizarCheckin,
  type IniciarCheckinPayload, type FinalizarCheckinPayload,
} from '../api/checkin.api';
import { ApiError } from '../api/client';
import { ehFalhaDefinitiva } from './erros';

const repo = new CheckinRepo();

/**
 * Envia uma marcação feita no aparelho: primeiro o check-in (se ainda não enviado),
 * depois o checkout local (se houver). Cada etapa leva a hora do telefone e é
 * idempotente no servidor. Se o servidor recusa (4xx definitivo, ex.: 409), a marcação
 * fica visível com o motivo (`recusado`) e o erro é relançado para a fila parar de insistir.
 */
export async function pushCheckin(localId: string): Promise<void> {
  const registro = repo.findPorId(localId);
  if (!registro) return; // descartada pelo usuário

  try {
    let remoteId = registro.remoteId;
    if (!remoteId) {
      const payload: IniciarCheckinPayload = {
        clienteId: registro.clienteId,
        unidadeId: registro.unidadeId,
        localId,
        dataCheckin: registro.dataCheckin,
        offline: true,
      };
      if (registro.latitudeCheckin != null && registro.longitudeCheckin != null) {
        payload.latitude = registro.latitudeCheckin;
        payload.longitude = registro.longitudeCheckin;
      }
      const criado = await iniciarCheckin(payload);
      remoteId = criado.id;
      repo.marcarEnviado(localId, 'checkin', remoteId, new Date().toISOString());
    }

    const checkoutPendente = registro.checkoutOffline
      && registro.dataCheckout
      && !registro.checkoutSincronizadoEm;
    if (checkoutPendente) {
      const payload: FinalizarCheckinPayload = {
        dataCheckout: registro.dataCheckout!,
        offline: true,
      };
      if (registro.latitudeCheckout != null && registro.longitudeCheckout != null) {
        payload.latitude = registro.latitudeCheckout;
        payload.longitude = registro.longitudeCheckout;
      }
      await finalizarCheckin(remoteId, payload);
      repo.marcarEnviado(localId, 'checkout', remoteId, new Date().toISOString());
    }
  } catch (e) {
    if (e instanceof ApiError && ehFalhaDefinitiva(e)) {
      repo.marcarRecusado(localId, e.message);
    }
    throw e;
  }
}

import { create } from 'zustand';
import { CheckinRepo, type CheckinAberto } from '../db/repositories/checkin.repo';
import {
  buscarCheckinAberto, buscarAlertaCheckin, iniciarCheckin, finalizarCheckin,
  type CheckinApi, type IniciarCheckinPayload,
} from '../api/checkin.api';
import { SyncService } from '../sync/SyncService';
import { FilaRepo } from '../db/repositories/fila.repo';
import { ApiError } from '../api/client';
import { temInternet } from '../utils/conexao';
import { gerarUUID } from '../utils/uuid';
import { lerCoordenada } from '../utils/coordenada';

const repo = new CheckinRepo();
const filaRepo = new FilaRepo();

/** Dados do check-in; os nomes ficam no registro local para exibir a marcação antes do envio. */
export interface IniciarCheckinInput extends IniciarCheckinPayload {
  clienteNome?: string | null;
  unidadeNome?: string | null;
}

export interface CoordenadasMarcacao {
  latitude: number;
  longitude: number;
}

interface CheckinState {
  checkinAberto: CheckinAberto | null;
  isAtrasado3h: boolean;
  mensagemAlerta: string | null;
  isLoading: boolean;
  isModalAberto: boolean;
  setModalAberto: (aberto: boolean) => void;
  hidratarDoCache: (usuarioId: string) => void;
  carregarEstado: (usuarioId: string) => Promise<void>;
  iniciar: (usuarioId: string, input: IniciarCheckinInput) => Promise<void>;
  finalizar: (usuarioId: string, coords?: CoordenadasMarcacao | null) => Promise<void>;
}

function persistir(checkin: CheckinApi, isAtrasado3h: boolean, usuarioId: string): CheckinAberto | null {
  repo.salvarAberto({
    id: checkin.id,
    remoteId: checkin.id,
    usuarioId: checkin.usuarioId || usuarioId,
    clienteId: checkin.clienteId,
    clienteNome: checkin.cliente?.nomeFantasia || checkin.cliente?.razaoSocial || null,
    unidadeId: checkin.unidadeId,
    unidadeNome: checkin.unidade?.nome ?? null,
    dataCheckin: checkin.dataCheckin,
    latitudeCheckin: lerCoordenada(checkin.latitudeCheckin),
    longitudeCheckin: lerCoordenada(checkin.longitudeCheckin),
    isAtrasado3h,
  });
  return repo.findAberto(usuarioId);
}

/** Erro de rede/indisponibilidade (não é uma resposta do servidor): a marcação vai para a fila. */
function ehErroDeRede(e: unknown): boolean {
  return !(e instanceof ApiError);
}

export const useCheckinStore = create<CheckinState>((set) => ({
  checkinAberto: null,
  isAtrasado3h: false,
  mensagemAlerta: null,
  isLoading: false,
  isModalAberto: false,

  setModalAberto: (aberto) => set({ isModalAberto: aberto }),

  hidratarDoCache: (usuarioId) => {
    const cache = repo.findAberto(usuarioId);
    set({
      checkinAberto: cache,
      isAtrasado3h: cache?.isAtrasado3h ?? false,
    });
  },

  carregarEstado: async (usuarioId) => {
    const online = await SyncService.isOnline();
    // marcação local aguardando envio: o servidor ainda não a conhece, vale o registro local
    if (!online || repo.temEnvioPendente(usuarioId)) {
      const cache = repo.findAberto(usuarioId);
      set({
        checkinAberto: cache,
        isAtrasado3h: cache?.isAtrasado3h ?? false,
        mensagemAlerta: null,
      });
      return;
    }
    set({ isLoading: true });
    try {
      const [estado, alerta] = await Promise.all([
        buscarCheckinAberto(),
        buscarAlertaCheckin(),
      ]);
      if (!estado.checkin) {
        repo.limparAberto(usuarioId);
        set({ checkinAberto: null, isAtrasado3h: false, mensagemAlerta: null });
        return;
      }
      const cache = persistir(estado.checkin, estado.isAtrasado3h, usuarioId);
      set({
        checkinAberto: cache,
        isAtrasado3h: estado.isAtrasado3h,
        mensagemAlerta: alerta.possuiAlerta ? alerta.mensagem : null,
      });
    } finally {
      set({ isLoading: false });
    }
  },

  iniciar: async (usuarioId, input) => {
    set({ isLoading: true });
    // o mesmo localId vale online e offline: reenviar a marcação nunca duplica no servidor
    const localId = gerarUUID();
    // hora do toque: a tentativa online pode demorar até cair para a fila
    const dataCheckin = new Date().toISOString();
    const { clienteNome, unidadeNome, ...payload } = input;
    try {
      if (await temInternet()) {
        try {
          const checkin = await iniciarCheckin({ ...payload, localId });
          const cache = persistir(checkin, false, usuarioId);
          set({ checkinAberto: cache, isAtrasado3h: false, mensagemAlerta: null });
          return;
        } catch (e) {
          if (!ehErroDeRede(e)) throw e;
        }
      }
      repo.salvarOffline({
        id: localId,
        usuarioId,
        clienteId: payload.clienteId,
        clienteNome: clienteNome ?? null,
        unidadeId: payload.unidadeId,
        unidadeNome: unidadeNome ?? null,
        dataCheckin,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
      });
      filaRepo.enfileirar('checkin', localId, usuarioId);
      set({ checkinAberto: repo.findAberto(usuarioId), isAtrasado3h: false, mensagemAlerta: null });
    } finally {
      set({ isLoading: false });
    }
  },

  finalizar: async (usuarioId, coords) => {
    const atual = useCheckinStore.getState().checkinAberto;
    if (!atual) {
      return;
    }
    set({ isLoading: true });
    // hora do toque: a tentativa online pode demorar até cair para a fila
    const dataCheckout = new Date().toISOString();
    try {
      // Check-in ainda não enviado: só dá para registrar o checkout localmente (a fila envia na ordem)
      if (atual.remoteId && (await temInternet())) {
        try {
          await finalizarCheckin(atual.remoteId, coords ? { ...coords } : {});
          repo.limparAberto(usuarioId);
          set({ checkinAberto: null, isAtrasado3h: false, mensagemAlerta: null });
          return;
        } catch (e) {
          if (!ehErroDeRede(e)) throw e;
        }
      }
      repo.registrarCheckoutOffline(atual.id, dataCheckout, coords);
      filaRepo.enfileirar('checkin', atual.id, usuarioId);
      set({ checkinAberto: repo.findAberto(usuarioId), isAtrasado3h: false, mensagemAlerta: null });
    } finally {
      set({ isLoading: false });
    }
  },
}));

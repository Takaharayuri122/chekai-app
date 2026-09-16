import { create } from 'zustand';
import { CheckinRepo, type CheckinAberto } from '../db/repositories/checkin.repo';
import {
  buscarCheckinAberto, buscarAlertaCheckin, iniciarCheckin, finalizarCheckin,
  type CheckinApi, type IniciarCheckinPayload,
} from '../api/checkin.api';
import { SyncService } from '../sync/SyncService';

const repo = new CheckinRepo();

interface CheckinState {
  checkinAberto: CheckinAberto | null;
  isAtrasado3h: boolean;
  mensagemAlerta: string | null;
  isLoading: boolean;
  isModalAberto: boolean;
  setModalAberto: (aberto: boolean) => void;
  hidratarDoCache: (usuarioId: string) => void;
  carregarEstado: (usuarioId: string) => Promise<void>;
  iniciar: (usuarioId: string, payload: IniciarCheckinPayload) => Promise<void>;
  finalizar: (usuarioId: string, latitude: number, longitude: number) => Promise<void>;
}

function mapearParaCache(checkin: CheckinApi, isAtrasado3h: boolean, usuarioId: string): CheckinAberto {
  const clienteNome = checkin.cliente?.nomeFantasia || checkin.cliente?.razaoSocial || null;
  return {
    id: checkin.id,
    remoteId: checkin.id,
    usuarioId: checkin.usuarioId || usuarioId,
    clienteId: checkin.clienteId,
    clienteNome,
    unidadeId: checkin.unidadeId,
    unidadeNome: checkin.unidade?.nome ?? null,
    dataCheckin: checkin.dataCheckin,
    latitudeCheckin: Number(checkin.latitudeCheckin),
    longitudeCheckin: Number(checkin.longitudeCheckin),
    isAtrasado3h,
  };
}

function persistir(checkin: CheckinApi, isAtrasado3h: boolean, usuarioId: string): CheckinAberto {
  const cache = mapearParaCache(checkin, isAtrasado3h, usuarioId);
  repo.salvarAberto(cache);
  return cache;
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
    if (!online) {
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

  iniciar: async (usuarioId, payload) => {
    set({ isLoading: true });
    try {
      const checkin = await iniciarCheckin(payload);
      const cache = persistir(checkin, false, usuarioId);
      set({ checkinAberto: cache, isAtrasado3h: false, mensagemAlerta: null });
    } finally {
      set({ isLoading: false });
    }
  },

  finalizar: async (usuarioId, latitude, longitude) => {
    const atual = useCheckinStore.getState().checkinAberto;
    if (!atual?.remoteId) {
      return;
    }
    set({ isLoading: true });
    try {
      await finalizarCheckin(atual.remoteId, { latitude, longitude });
      repo.limparAberto(usuarioId);
      set({ checkinAberto: null, isAtrasado3h: false, mensagemAlerta: null });
    } finally {
      set({ isLoading: false });
    }
  },
}));

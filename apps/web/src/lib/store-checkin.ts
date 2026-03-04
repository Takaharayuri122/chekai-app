import { create } from 'zustand';
import { CheckinRegistro } from './services/checkin.service';

interface CheckinState {
  checkinAberto: CheckinRegistro | null;
  isAtrasado3h: boolean;
  mensagemAlerta: string | null;
  isLoading: boolean;
  isModalAberto: boolean;
  setEstadoCheckin: (payload: {
    checkinAberto: CheckinRegistro | null;
    isAtrasado3h: boolean;
    mensagemAlerta?: string | null;
  }) => void;
  setLoading: (isLoading: boolean) => void;
  setModalAberto: (isModalAberto: boolean) => void;
  reset: () => void;
}

const estadoInicial = {
  checkinAberto: null,
  isAtrasado3h: false,
  mensagemAlerta: null,
  isLoading: false,
  isModalAberto: false,
};

export const useCheckinStore = create<CheckinState>((set) => ({
  ...estadoInicial,
  setEstadoCheckin: ({ checkinAberto, isAtrasado3h, mensagemAlerta = null }) =>
    set({
      checkinAberto,
      isAtrasado3h,
      mensagemAlerta,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setModalAberto: (isModalAberto) => set({ isModalAberto }),
  reset: () => set({ ...estadoInicial }),
}));

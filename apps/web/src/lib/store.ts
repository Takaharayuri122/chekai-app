import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export enum PerfilUsuario {
  MASTER = 'master',
  GESTOR = 'gestor',
  AUDITOR = 'auditor',
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  telefone?: string;
  gestorId?: string;
  tenantId?: string;
}

interface AuthState {
  token: string | null;
  usuario: Usuario | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  setAuth: (token: string, usuario: Usuario) => void;
  logout: () => void;
  isMaster: () => boolean;
  isGestor: () => boolean;
  isAuditor: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      usuario: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setHasHydrated: (state) => {
        set({ _hasHydrated: state });
      },
      setAuth: (token, usuario) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('token', token);
        }
        set({ token, usuario, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ token: null, usuario: null, isAuthenticated: false });
      },
      isMaster: () => {
        const { usuario } = get();
        return usuario?.perfil === PerfilUsuario.MASTER;
      },
      isGestor: () => {
        const { usuario } = get();
        return usuario?.perfil === PerfilUsuario.GESTOR;
      },
      isAuditor: () => {
        const { usuario } = get();
        return usuario?.perfil === PerfilUsuario.AUDITOR;
      },
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        if (typeof window !== 'undefined' && state) {
          const token = localStorage.getItem('token');
          if (token && state.token && state.usuario) {
            state.isAuthenticated = true;
          } else {
            state.isAuthenticated = false;
            if (!token) {
              state.token = null;
              state.usuario = null;
            }
          }
        }
        state?.setHasHydrated(true);
      },
    }
  )
);

interface AuditoriaEmAndamento {
  id: string;
  unidadeNome: string;
  templateNome: string;
  itensRespondidos: number;
  totalItens: number;
}

interface AuditoriaState {
  auditoriaAtual: AuditoriaEmAndamento | null;
  setAuditoriaAtual: (auditoria: AuditoriaEmAndamento | null) => void;
  atualizarProgresso: (itensRespondidos: number) => void;
}

export const useAuditoriaStore = create<AuditoriaState>((set) => ({
  auditoriaAtual: null,
  setAuditoriaAtual: (auditoria) => set({ auditoriaAtual: auditoria }),
  atualizarProgresso: (itensRespondidos) =>
    set((state) => ({
      auditoriaAtual: state.auditoriaAtual
        ? { ...state.auditoriaAtual, itensRespondidos }
        : null,
    })),
}));

interface TutorialState {
  tutorialCompleto: Record<PerfilUsuario, boolean>;
  tourAtivo: boolean;
  iniciarTour: (perfil: PerfilUsuario) => void;
  finalizarTour: (perfil: PerfilUsuario) => void;
  pausarTour: () => void;
  verificarTutorialCompleto: (perfil: PerfilUsuario) => boolean;
}

const tutorialCompletoInicial: Record<PerfilUsuario, boolean> = {
  [PerfilUsuario.MASTER]: false,
  [PerfilUsuario.GESTOR]: false,
  [PerfilUsuario.AUDITOR]: false,
};

export const useTutorialStore = create<TutorialState>()(
  persist(
    (set, get) => ({
      tutorialCompleto: tutorialCompletoInicial,
      tourAtivo: false,
      iniciarTour: (perfil: PerfilUsuario) => {
        set({ tourAtivo: true });
      },
      finalizarTour: (perfil: PerfilUsuario) => {
        const { tutorialCompleto } = get();
        set({
          tourAtivo: false,
          tutorialCompleto: {
            ...tutorialCompleto,
            [perfil]: true,
          },
        });
      },
      pausarTour: () => {
        set({ tourAtivo: false });
      },
      verificarTutorialCompleto: (perfil: PerfilUsuario) => {
        const { tutorialCompleto } = get();
        return tutorialCompleto[perfil] === true;
      },
    }),
    {
      name: 'tutorial-storage',
    }
  )
);

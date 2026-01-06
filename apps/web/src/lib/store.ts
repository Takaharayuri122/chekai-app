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
        localStorage.setItem('token', token);
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
        state?.setHasHydrated(true);
        // Verificar se há token no localStorage e atualizar isAuthenticated
        if (typeof window !== 'undefined' && state) {
          const token = localStorage.getItem('token');
          if (token && state.token) {
            state.isAuthenticated = true;
          } else if (!token) {
            state.isAuthenticated = false;
            state.token = null;
            state.usuario = null;
          }
        }
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


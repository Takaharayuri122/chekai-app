import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export enum PerfilUsuario {
  MASTER = 'master',
  ANALISTA = 'analista',
  AUDITOR = 'auditor',
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  analistaId?: string;
  tenantId?: string;
}

interface AuthState {
  token: string | null;
  usuario: Usuario | null;
  isAuthenticated: boolean;
  setAuth: (token: string, usuario: Usuario) => void;
  logout: () => void;
  isMaster: () => boolean;
  isAnalista: () => boolean;
  isAuditor: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      usuario: null,
      isAuthenticated: false,
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
      isAnalista: () => {
        const { usuario } = get();
        return usuario?.perfil === PerfilUsuario.ANALISTA;
      },
      isAuditor: () => {
        const { usuario } = get();
        return usuario?.perfil === PerfilUsuario.AUDITOR;
      },
    }),
    {
      name: 'auth-storage',
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


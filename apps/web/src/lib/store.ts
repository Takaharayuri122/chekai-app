import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: string;
}

interface AuthState {
  token: string | null;
  usuario: Usuario | null;
  isAuthenticated: boolean;
  setAuth: (token: string, usuario: Usuario) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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


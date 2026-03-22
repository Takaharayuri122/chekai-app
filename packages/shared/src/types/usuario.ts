import { PerfilUsuario, StatusUsuario } from './enums';

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  telefone?: string;
  status: StatusUsuario;
  gestorId?: string;
  tenantId?: string;
  logoUrl?: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface LoginResponse {
  accessToken: string;
  usuario: Usuario;
}

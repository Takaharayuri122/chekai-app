import { apiGet, apiPut } from './client';
import type { Usuario } from '@meta-app/shared';

/**
 * Campos do próprio perfil que o usuário pode editar no app.
 * Mantido enxuto para respeitar o `forbidNonWhitelisted` do `AtualizarUsuarioDto`.
 */
export interface AtualizarPerfilPayload {
  nome?: string;
  telefone?: string;
}

/**
 * Busca os dados de um usuário pelo ID (`GET /usuarios/:id`).
 */
export async function buscarUsuario(id: string): Promise<Usuario> {
  return apiGet<Usuario>(`/usuarios/${id}`);
}

/**
 * Atualiza os dados do próprio perfil (`PUT /usuarios/:id`).
 */
export async function atualizarPerfil(
  id: string,
  dados: AtualizarPerfilPayload,
): Promise<Usuario> {
  return apiPut<Usuario>(`/usuarios/${id}`, dados);
}

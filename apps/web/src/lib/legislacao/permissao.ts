import { PerfilUsuario } from '@/lib/store';

/**
 * Mesma regra da API: MASTER sempre pode; GESTOR só com a permissão liberada.
 * Tolera sessões persistidas antes da flag existir (undefined para MASTER).
 */
export function podeGerenciarLegislacoes(
  usuario: { perfil: PerfilUsuario; podeGerenciarLegislacoes?: boolean } | null | undefined,
): boolean {
  if (!usuario) return false;
  if (usuario.perfil === PerfilUsuario.MASTER) return true;
  return usuario.perfil === PerfilUsuario.GESTOR && usuario.podeGerenciarLegislacoes === true;
}

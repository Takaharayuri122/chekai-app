import { PerfilUsuario } from '../../usuario/entities/usuario.entity';

/**
 * Permissão efetiva para gerenciar legislações: MASTER sempre; GESTOR somente com a flag.
 */
export function podeGerenciarLegislacoes(u: {
  perfil: PerfilUsuario;
  podeGerenciarLegislacoes?: boolean | null;
}): boolean {
  return (
    u.perfil === PerfilUsuario.MASTER ||
    (u.perfil === PerfilUsuario.GESTOR && u.podeGerenciarLegislacoes === true)
  );
}

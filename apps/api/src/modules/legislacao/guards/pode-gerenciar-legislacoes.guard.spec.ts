import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PerfilUsuario } from '../../usuario/entities/usuario.entity';
import { PodeGerenciarLegislacoesGuard } from './pode-gerenciar-legislacoes.guard';

function contexto(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PodeGerenciarLegislacoesGuard', () => {
  const guard = new PodeGerenciarLegislacoesGuard();
  const mensagem = 'Você não tem permissão para gerenciar legislações.';

  it('bloqueia GESTOR sem a permissão', () => {
    const chamada = () =>
      guard.canActivate(contexto({ perfil: PerfilUsuario.GESTOR, podeGerenciarLegislacoes: false }));
    expect(chamada).toThrow(ForbiddenException);
    expect(chamada).toThrow(mensagem);
  });

  it('bloqueia AUDITOR mesmo com a flag', () => {
    expect(() =>
      guard.canActivate(contexto({ perfil: PerfilUsuario.AUDITOR, podeGerenciarLegislacoes: true })),
    ).toThrow(mensagem);
  });

  it('libera MASTER e GESTOR com a permissão', () => {
    expect(guard.canActivate(contexto({ perfil: PerfilUsuario.MASTER }))).toBe(true);
    expect(
      guard.canActivate(contexto({ perfil: PerfilUsuario.GESTOR, podeGerenciarLegislacoes: true })),
    ).toBe(true);
  });
});

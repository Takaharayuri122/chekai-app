import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { podeGerenciarLegislacoes } from '../lib/permissao';

/**
 * Libera a rota apenas para quem pode gerenciar legislações (MASTER, ou GESTOR com a permissão).
 * Deve vir depois do JwtAuthGuard.
 */
@Injectable()
export class PodeGerenciarLegislacoesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (!user || !podeGerenciarLegislacoes(user)) {
      throw new ForbiddenException('Você não tem permissão para gerenciar legislações.');
    }
    return true;
  }
}

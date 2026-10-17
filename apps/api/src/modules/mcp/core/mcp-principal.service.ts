import { Injectable, UnauthorizedException } from '@nestjs/common';
import { StatusUsuario } from '../../usuario/entities/usuario.entity';
import { UsuarioService } from '../../usuario/usuario.service';
import { ContextoAcessoMcp } from '../oauth/oauth.types';
import { McpPrincipal } from './mcp.types';

@Injectable()
export class McpPrincipalService {
  constructor(private readonly usuarios: UsuarioService) {}

  async obter(contexto: ContextoAcessoMcp): Promise<McpPrincipal> {
    const usuario = await this.usuarios.buscarPorId(contexto.id);
    if (usuario.status !== StatusUsuario.ATIVO) {
      throw new UnauthorizedException('Usuário inativo');
    }
    return {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      perfil: usuario.perfil,
      gestorId: usuario.gestorId,
      tenantId: usuario.tenantId,
      scopes: contexto.scope.split(' ').filter(Boolean),
    };
  }
}

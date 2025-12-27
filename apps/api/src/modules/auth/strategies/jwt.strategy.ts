import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsuarioService } from '../../usuario/usuario.service';
import { PerfilUsuario } from '../../usuario/entities/usuario.entity';

interface JwtPayload {
  sub: string;
  email: string;
  perfil: PerfilUsuario;
}

/**
 * Estratégia JWT para autenticação via Passport.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly usuarioService: UsuarioService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<{ id: string; email: string; perfil: PerfilUsuario; analistaId?: string | null; tenantId?: string | null }> {
    const usuario = await this.usuarioService.buscarPorId(payload.sub);
    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Usuário inválido ou inativo');
    }
    return {
      id: payload.sub,
      email: payload.email,
      perfil: payload.perfil,
      analistaId: usuario.analistaId ?? undefined,
      tenantId: usuario.tenantId ?? undefined,
    };
  }
}


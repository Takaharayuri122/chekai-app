import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { StatusUsuario } from '../../usuario/entities/usuario.entity';
import { OauthConfigService } from './oauth-config.service';
import { hashSegredo, iguaisConstante, pkceS256 } from './oauth-hash.util';
import { OauthMetadataService } from './oauth-metadata.service';
import {
  AcessoMcpNegado,
  ConcessaoOauth,
  OauthAccessRepositorio,
  OauthCodeRepositorio,
  OauthConcessaoRepositorio,
  OauthRefreshRepositorio,
  PedidoToken,
  RelogioPorta,
  RespostaToken,
  ResultadoAcessoMcp,
  SegredoPorta,
  UsuarioOtp,
  UsuarioOtpPorta,
} from './oauth.types';

export type { PedidoToken, RespostaToken, ResultadoAcessoMcp } from './oauth.types';

interface ClaimsAccess {
  iss: string;
  sub: string;
  aud: string;
  resource: string;
  scope: string;
  perfil: string;
  jti: string;
  iat: number;
  exp: number;
}

@Injectable()
export class OauthTokenService {
  private readonly metadata: OauthMetadataService;
  private readonly jwt: JwtService;

  constructor(
    private readonly config: OauthConfigService,
    private readonly usuarios: UsuarioOtpPorta,
    private readonly codes: OauthCodeRepositorio,
    private readonly concessoes: OauthConcessaoRepositorio,
    private readonly refreshes: OauthRefreshRepositorio,
    private readonly acessos: OauthAccessRepositorio,
    private readonly relogio: RelogioPorta,
    private readonly segredos: SegredoPorta,
    @Optional() jwt?: JwtService,
  ) {
    this.metadata = new OauthMetadataService(config);
    this.jwt = jwt ?? new JwtService();
  }

  async emitirToken(pedido: PedidoToken): Promise<RespostaToken> {
    if (pedido.grantType === 'authorization_code') return this.trocarCodigo(pedido);
    if (pedido.grantType === 'refresh_token') return this.renovar(pedido);
    throw new UnauthorizedException('Grant inválido');
  }

  async revogar(pedido: { token: string }): Promise<void> {
    if (!pedido.token) return;
    const hash = hashSegredo(pedido.token);
    const access = await this.acessos.buscarPorHash(hash);
    const refresh = access ? null : await this.refreshes.buscarPorHash(hash);
    const concessaoId = access?.concessaoId ?? refresh?.concessaoId;
    if (!concessaoId) return;
    const concessao = await this.concessoes.buscarPorId(concessaoId);
    if (!concessao || concessao.revogadaEm) return;
    await this.revogarFamilia(concessaoId);
  }

  async exigirAcesso(authorization: string | undefined): Promise<ResultadoAcessoMcp> {
    const negado = (): AcessoMcpNegado => this.metadata.respostaNaoAutenticado();
    if (!authorization?.startsWith('Bearer ')) return negado();
    const token = authorization.slice(7).trim();
    if (!token) return negado();
    try {
      const ambiente = this.config.resolver();
      const agora = this.relogio.agora();
      const payload = this.jwt.verify<ClaimsAccess>(token, {
        secret: ambiente.chaveAssinatura,
        algorithms: ['HS256'],
        issuer: ambiente.issuer,
        audience: ambiente.endpointMcp,
        clockTimestamp: Math.floor(agora.getTime() / 1000),
      });
      if (payload.resource !== ambiente.endpointMcp || !payload.jti || !payload.sub) return negado();
      const access = await this.acessos.buscarPorJti(payload.jti);
      if (
        !access ||
        access.revogadoEm ||
        access.expiraEm.getTime() <= agora.getTime() ||
        !iguaisConstante(access.tokenHash, hashSegredo(token))
      ) return negado();
      const concessao = await this.concessoes.buscarPorId(access.concessaoId);
      if (!concessao || concessao.revogadaEm || concessao.usuarioId !== payload.sub) return negado();
      const usuario = await this.usuarios.buscarPorId(payload.sub);
      if (!usuario || usuario.status !== StatusUsuario.ATIVO) return negado();
      return {
        ok: true,
        contexto: {
          id: usuario.id,
          email: usuario.email,
          perfil: usuario.perfil,
          gestorId: usuario.gestorId,
          tenantId: usuario.tenantId,
          scope: concessao.scopes,
          jti: payload.jti,
        },
      };
    } catch {
      return negado();
    }
  }

  private async trocarCodigo(pedido: PedidoToken): Promise<RespostaToken> {
    if (!pedido.code) throw new UnauthorizedException('Authorization code inválido');
    const code = await this.codes.buscarPorHash(hashSegredo(pedido.code));
    if (!code) throw new UnauthorizedException('Authorization code inválido');
    const agora = this.relogio.agora();
    const primeiroUso = (await this.codes.marcarUsado(code.id, agora)) !== false;
    const challenge = pedido.codeVerifier ? pkceS256(pedido.codeVerifier) : '';
    if (
      code.usadoEm ||
      !primeiroUso ||
      code.expiraEm.getTime() <= agora.getTime() ||
      !pedido.codeVerifier ||
      !iguaisConstante(challenge, code.codeChallenge) ||
      pedido.redirectUri !== code.redirectUri ||
      pedido.resource !== code.resource ||
      !code.clientId ||
      pedido.clientId !== code.clientId
    ) {
      throw new UnauthorizedException('Authorization code inválido');
    }
    const usuario = await this.usuarios.buscarPorId(code.usuarioId);
    if (!usuario || usuario.status !== StatusUsuario.ATIVO) {
      throw new UnauthorizedException('Usuário inativo');
    }
    const concessao: ConcessaoOauth = {
      id: this.segredos.uuid(),
      clienteId: code.clienteId,
      usuarioId: code.usuarioId,
      resource: code.resource,
      scopes: code.scopes,
      revogadaEm: null,
    };
    await this.concessoes.salvar(concessao);
    return this.emitirPar(concessao, usuario);
  }

  private async renovar(pedido: PedidoToken): Promise<RespostaToken> {
    if (!pedido.refreshToken) throw new UnauthorizedException('Refresh token inválido');
    const refresh = await this.refreshes.buscarPorHash(hashSegredo(pedido.refreshToken));
    if (!refresh) throw new UnauthorizedException('Refresh token inválido');
    const concessao = await this.concessoes.buscarPorId(refresh.concessaoId);
    if (!concessao || concessao.revogadaEm || refresh.revogadoEm) {
      throw new UnauthorizedException('Refresh token inválido');
    }
    if (refresh.usadoEm) {
      await this.revogarFamilia(refresh.concessaoId);
      throw new UnauthorizedException('Reuso de refresh token');
    }
    const agora = this.relogio.agora();
    if (refresh.expiraEm.getTime() <= agora.getTime()) {
      throw new UnauthorizedException('Refresh token expirado');
    }
    const usuario = await this.usuarios.buscarPorId(concessao.usuarioId);
    if (!usuario || usuario.status !== StatusUsuario.ATIVO) {
      throw new UnauthorizedException('Usuário inativo');
    }
    if ((await this.refreshes.marcarUsado(refresh.id, agora)) === false) {
      await this.revogarFamilia(refresh.concessaoId);
      throw new UnauthorizedException('Reuso de refresh token');
    }
    return this.emitirPar(concessao, usuario);
  }

  private async emitirPar(concessao: ConcessaoOauth, usuario: UsuarioOtp): Promise<RespostaToken> {
    const ambiente = this.config.resolver();
    const agora = this.relogio.agora();
    const iat = Math.floor(agora.getTime() / 1000);
    const jti = this.segredos.uuid();
    const claims: ClaimsAccess = {
      iss: ambiente.issuer,
      sub: usuario.id,
      aud: ambiente.endpointMcp,
      resource: ambiente.endpointMcp,
      scope: concessao.scopes,
      perfil: usuario.perfil,
      jti,
      iat,
      exp: iat + ambiente.accessTokenTtlSeconds,
    };
    const access = this.jwt.sign(claims, { secret: ambiente.chaveAssinatura, algorithm: 'HS256' });
    const refresh = this.segredos.opaco();
    await this.acessos.salvar({
      id: this.segredos.uuid(),
      jti,
      tokenHash: hashSegredo(access),
      concessaoId: concessao.id,
      expiraEm: new Date(agora.getTime() + ambiente.accessTokenTtlSeconds * 1000),
      revogadoEm: null,
    });
    await this.refreshes.salvar({
      id: this.segredos.uuid(),
      tokenHash: hashSegredo(refresh),
      concessaoId: concessao.id,
      expiraEm: new Date(agora.getTime() + ambiente.refreshTokenTtlSeconds * 1000),
      usadoEm: null,
      revogadoEm: null,
    });
    return {
      access_token: access,
      token_type: 'Bearer',
      expires_in: ambiente.accessTokenTtlSeconds,
      refresh_token: refresh,
      scope: concessao.scopes,
    };
  }

  private async revogarFamilia(concessaoId: string): Promise<void> {
    const agora = this.relogio.agora();
    await this.concessoes.revogar(concessaoId, agora);
    await this.refreshes.revogarPorConcessao(concessaoId, agora);
    await this.acessos.revogarPorConcessao(concessaoId, agora);
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { StatusUsuario } from '../../usuario/entities/usuario.entity';
import { SCOPES_OPERACIONAIS } from './oauth.constants';
import { OauthClienteService } from './oauth-cliente.service';
import { OauthConfigService } from './oauth-config.service';
import { hashSegredo } from './oauth-hash.util';
import {
  ClienteOauth,
  Consentimento,
  EmailOtpPorta,
  OauthCodeRepositorio,
  OauthSessaoRepositorio,
  QueryAutorizacao,
  RelogioPorta,
  SegredoPorta,
  UsuarioOtpPorta,
} from './oauth.types';

const OTP_MOCK = '252622';
const VALIDADE_MS = 10 * 60 * 1000;

@Injectable()
export class OauthAutorizacaoService {
  constructor(
    private readonly config: OauthConfigService,
    private readonly usuarios: UsuarioOtpPorta,
    private readonly clientes: OauthClienteService,
    private readonly sessoes: OauthSessaoRepositorio,
    private readonly codes: OauthCodeRepositorio,
    private readonly email: EmailOtpPorta,
    private readonly relogio: RelogioPorta,
    private readonly segredos: SegredoPorta,
  ) {}

  async solicitarOtp(input: { email: string }): Promise<{ message: string }> {
    const usuario = await this.usuarios.buscarPorEmail(input.email);
    if (!usuario) throw new UnauthorizedException('E-mail não cadastrado');
    if (usuario.status === StatusUsuario.NAO_CONFIRMADO) {
      throw new ForbiddenException('Convite pendente. Verifique seu e-mail para aceitar o convite.');
    }
    if (usuario.status !== StatusUsuario.ATIVO) {
      throw new ForbiddenException('Usuário inativo');
    }
    const codigo = this.segredos.otp();
    const expiraEm = new Date(this.relogio.agora().getTime() + VALIDADE_MS);
    await this.usuarios.atualizarOtp(usuario.id, codigo, expiraEm);
    await this.email.enviarEmailOTP(usuario.email, usuario.nome, codigo);
    return { message: 'Código OTP enviado por e-mail' };
  }

  async validarOtp(input: { email: string; codigo: string }): Promise<{ sessaoConsentimento: string }> {
    const usuario = await this.usuarios.buscarPorEmail(input.email);
    if (!usuario || usuario.status !== StatusUsuario.ATIVO) {
      throw new UnauthorizedException('Usuário inativo ou não confirmado');
    }
    const ambiente = this.config.resolver();
    const mock = ambiente.aceitaOtpMock && input.codigo === OTP_MOCK;
    if (!mock) {
      if (!usuario.otpCode || !usuario.otpExpiresAt) {
        throw new BadRequestException('Código OTP não solicitado ou expirado');
      }
      if (usuario.otpExpiresAt.getTime() < this.relogio.agora().getTime()) {
        throw new BadRequestException('Código OTP expirado. Solicite um novo código.');
      }
      if (usuario.otpCode !== input.codigo) {
        throw new UnauthorizedException('Código OTP inválido');
      }
      await this.usuarios.limparOtp(usuario.id);
    }

    const segredo = this.segredos.opaco();
    await this.sessoes.salvar({
      id: this.segredos.uuid(),
      sessaoHash: hashSegredo(segredo),
      usuarioId: usuario.id,
      expiraEm: new Date(this.relogio.agora().getTime() + VALIDADE_MS),
      usadoEm: null,
    });
    return { sessaoConsentimento: segredo };
  }

  async iniciarAutorizacao(query: QueryAutorizacao): Promise<{ url: string }> {
    await this.validarPedido(query);
    const url = new URL('/oauth/autorizar', `${this.config.resolver().frontendUrl}/`);
    this.aplicarQuery(url, query);
    return { url: url.toString() };
  }

  async consentir(input: Consentimento): Promise<{ redirectPara: string }> {
    const cliente = await this.validarPedido(input);
    const agora = this.relogio.agora();
    const sessao = input.sessaoConsentimento
      ? await this.sessoes.buscarPorHash(hashSegredo(input.sessaoConsentimento))
      : null;
    if (!sessao || sessao.usadoEm || sessao.expiraEm.getTime() <= agora.getTime()) {
      throw new UnauthorizedException('Sessão de consentimento inválida');
    }
    const usuario = await this.usuarios.buscarPorId(sessao.usuarioId);
    if (!usuario || usuario.status !== StatusUsuario.ATIVO) {
      throw new UnauthorizedException('Usuário inativo ou não confirmado');
    }
    if ((await this.sessoes.marcarUsado(sessao.id, agora)) === false) {
      throw new UnauthorizedException('Sessão de consentimento inválida');
    }
    const code = this.segredos.opaco();
    await this.codes.salvar({
      id: this.segredos.uuid(),
      codeHash: hashSegredo(code),
      clienteId: cliente.id,
      clientId: cliente.clientId,
      usuarioId: usuario.id,
      redirectUri: input.redirectUri,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: 'S256',
      resource: input.resource,
      scopes: input.scope,
      expiraEm: new Date(agora.getTime() + VALIDADE_MS),
      usadoEm: null,
    });
    const redirect = new URL(input.redirectUri);
    redirect.searchParams.set('code', code);
    redirect.searchParams.set('state', input.state);
    return { redirectPara: redirect.toString() };
  }

  private async validarPedido(query: QueryAutorizacao): Promise<ClienteOauth> {
    const ambiente = this.config.resolver();
    if (
      query.responseType !== 'code' ||
      !query.state ||
      !query.codeChallenge ||
      query.codeChallengeMethod !== 'S256' ||
      query.resource !== ambiente.endpointMcp ||
      !query.scope
    ) {
      throw new BadRequestException('Pedido OAuth inválido');
    }
    const scopes = query.scope.split(' ');
    if (scopes.some((scope) => !scope || !(SCOPES_OPERACIONAIS as readonly string[]).includes(scope))) {
      throw new BadRequestException('Scope inválido');
    }
    const cliente = await this.clientes.resolver(query.clientId);
    if (!cliente || !query.redirectUri || !cliente.redirectUris.includes(query.redirectUri)) {
      throw new BadRequestException('Cliente ou redirect_uri inválido');
    }
    return cliente;
  }

  private aplicarQuery(url: URL, query: QueryAutorizacao): void {
    const valores: Record<string, string | undefined> = {
      response_type: query.responseType,
      client_id: query.clientId,
      redirect_uri: query.redirectUri,
      code_challenge: query.codeChallenge,
      code_challenge_method: query.codeChallengeMethod,
      resource: query.resource,
      scope: query.scope,
      state: query.state,
    };
    Object.entries(valores).forEach(([chave, valor]) => {
      if (valor !== undefined) url.searchParams.set(chave, valor);
    });
  }
}

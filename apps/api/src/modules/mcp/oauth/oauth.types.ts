import { PerfilUsuario, StatusUsuario } from '../../usuario/entities/usuario.entity';

export interface UsuarioOtp {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  status: StatusUsuario;
  gestorId: string | null;
  tenantId: string | null;
  otpCode: string | null;
  otpExpiresAt: Date | null;
}

export abstract class UsuarioOtpPorta {
  abstract buscarPorEmail(email: string): Promise<UsuarioOtp | null>;
  abstract buscarPorId(id: string): Promise<UsuarioOtp | null>;
  abstract atualizarOtp(id: string, codigo: string, expiraEm: Date): Promise<void>;
  abstract limparOtp(id: string): Promise<void>;
}

export abstract class EmailOtpPorta {
  abstract enviarEmailOTP(email: string, nome: string, codigo: string): Promise<void>;
}

export abstract class RelogioPorta {
  abstract agora(): Date;
}

export abstract class SegredoPorta {
  abstract otp(): string;
  abstract opaco(): string;
  abstract uuid(): string;
}

export interface DocumentoCimd {
  redirect_uris: string[];
  client_name?: string;
}

export interface ClienteOauth {
  id: string;
  clientId: string;
  nome: string | null;
  redirectUris: string[];
  origem: 'cimd' | 'registro';
  documento: DocumentoCimd | null;
}

export abstract class OauthClienteRepositorio {
  abstract buscarPorClientId(clientId: string): Promise<ClienteOauth | null>;
  abstract salvar(cliente: ClienteOauth): Promise<void>;
}

export abstract class OauthCimdPorta {
  abstract obter(clientId: string): Promise<DocumentoCimd | null>;
}

export interface SessaoConsentimento {
  id: string;
  sessaoHash: string;
  usuarioId: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

/**
 * `marcarUsado` devolve `false` quando outro pedido já consumiu o registro;
 * `void` equivale a sucesso.
 */
export abstract class OauthSessaoRepositorio {
  abstract salvar(sessao: SessaoConsentimento): Promise<void>;
  abstract buscarPorHash(sessaoHash: string): Promise<SessaoConsentimento | null>;
  abstract marcarUsado(id: string, quando: Date): Promise<boolean | void>;
}

export interface AuthorizationCodeOauth {
  id: string;
  codeHash: string;
  clienteId: string;
  /** `oauth_clientes.client_id`, lido por junção; não é coluna de `oauth_authorization_codes`. */
  clientId?: string;
  usuarioId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  scopes: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

export abstract class OauthCodeRepositorio {
  abstract salvar(code: AuthorizationCodeOauth): Promise<void>;
  abstract buscarPorHash(codeHash: string): Promise<AuthorizationCodeOauth | null>;
  abstract marcarUsado(id: string, quando: Date): Promise<boolean | void>;
}

export interface ConcessaoOauth {
  id: string;
  clienteId: string;
  usuarioId: string;
  resource: string;
  scopes: string;
  revogadaEm: Date | null;
}

export abstract class OauthConcessaoRepositorio {
  abstract salvar(concessao: ConcessaoOauth): Promise<void>;
  abstract buscarPorId(id: string): Promise<ConcessaoOauth | null>;
  abstract revogar(id: string, quando: Date): Promise<void>;
}

export interface RefreshOauth {
  id: string;
  tokenHash: string;
  concessaoId: string;
  expiraEm: Date;
  usadoEm: Date | null;
  revogadoEm: Date | null;
}

export abstract class OauthRefreshRepositorio {
  abstract salvar(refresh: RefreshOauth): Promise<void>;
  abstract buscarPorHash(tokenHash: string): Promise<RefreshOauth | null>;
  abstract marcarUsado(id: string, quando: Date): Promise<boolean | void>;
  abstract revogarPorConcessao(concessaoId: string, quando: Date): Promise<void>;
}

export interface AccessOauth {
  id: string;
  jti: string;
  tokenHash: string;
  concessaoId: string;
  expiraEm: Date;
  revogadoEm: Date | null;
}

export abstract class OauthAccessRepositorio {
  abstract salvar(access: AccessOauth): Promise<void>;
  abstract buscarPorHash(tokenHash: string): Promise<AccessOauth | null>;
  abstract buscarPorJti(jti: string): Promise<AccessOauth | null>;
  abstract revogarPorConcessao(concessaoId: string, quando: Date): Promise<void>;
}

export interface QueryAutorizacao {
  responseType: string;
  clientId: string;
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  resource?: string;
  scope?: string;
  state?: string;
}

export interface Consentimento extends QueryAutorizacao {
  sessaoConsentimento: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  scope: string;
  state: string;
}

export interface PedidoToken {
  grantType: 'authorization_code' | 'refresh_token';
  code?: string;
  redirectUri?: string;
  codeVerifier?: string;
  resource?: string;
  refreshToken?: string;
  clientId?: string;
}

export interface RespostaToken {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface ContextoAcessoMcp {
  id: string;
  email: string;
  perfil: PerfilUsuario;
  gestorId: string | null;
  tenantId: string | null;
  scope: string;
  jti: string;
}

export interface AcessoMcpNegado {
  ok: false;
  status: 401;
  headers: { 'WWW-Authenticate': string };
}

export type ResultadoAcessoMcp = { ok: true; contexto: ContextoAcessoMcp } | AcessoMcpNegado;

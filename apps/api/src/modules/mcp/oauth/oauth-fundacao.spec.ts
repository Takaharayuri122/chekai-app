/**
 * RED da fundação OAuth 2.1 (UC-01 e UC-02).
 * Os módulos importados abaixo ainda não existem: a suíte deve falhar ao carregar.
 * Tools MCP não entram neste arquivo.
 */
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException, RequestMethod, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PerfilUsuario, StatusUsuario } from '../../usuario/entities/usuario.entity';
import { ROTAS_OAUTH_SEM_PREFIXO_API, SCOPES_OPERACIONAIS } from './oauth.constants';
import { OauthAutorizacaoService } from './oauth-autorizacao.service';
import { OauthClienteService } from './oauth-cliente.service';
import { OauthConfigService } from './oauth-config.service';
import { OauthMetadataService } from './oauth-metadata.service';
import { OauthTokenService } from './oauth-token.service';

const AGORA = new Date('2020-01-01T00:00:00.000Z');
const VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CHALLENGE = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
const CLIENT_ID = 'https://cliente.exemplo/oauth/client.json';
const CLIENTE_INTERNO = '11111111-1111-4111-8111-111111111111';
const REDIRECT = 'https://cliente.exemplo/callback';
const ENDPOINT = 'http://localhost:3001/mcp';
const METADATA_RECURSO = 'http://localhost:3001/.well-known/oauth-protected-resource';
const SCOPE = 'chekai:contexto chekai:clientes:ler';
const CHAVES_ENV = [
  'NODE_ENV',
  'FRONTEND_URL',
  'MCP_PUBLIC_URL',
  'OAUTH_ISSUER',
  'OAUTH_ACCESS_TOKEN_TTL',
  'OAUTH_REFRESH_TOKEN_TTL',
  'OAUTH_JWT_SECRET',
  'JWT_SECRET',
] as const;

const ENV_BASE: Record<string, string> = {
  NODE_ENV: 'development',
  FRONTEND_URL: 'http://localhost:3031',
  MCP_PUBLIC_URL: 'http://localhost:3001',
  OAUTH_ISSUER: 'http://issuer.local',
  OAUTH_ACCESS_TOKEN_TTL: '3600',
  OAUTH_REFRESH_TOKEN_TTL: '1209600',
  OAUTH_JWT_SECRET: 'chave-oauth-distinta',
  JWT_SECRET: 'chave-web',
};

interface UsuarioLinha {
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

interface ClienteLinha {
  id: string;
  clientId: string;
  nome: string | null;
  redirectUris: string[];
  origem: 'cimd' | 'registro';
  documento: { redirect_uris: string[]; client_name?: string } | null;
}

interface SessaoLinha {
  id: string;
  sessaoHash: string;
  usuarioId: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

interface CodeLinha {
  id: string;
  codeHash: string;
  clienteId: string;
  usuarioId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  scopes: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

interface ConcessaoLinha {
  id: string;
  clienteId: string;
  usuarioId: string;
  resource: string;
  scopes: string;
  revogadaEm: Date | null;
}

interface RefreshLinha {
  id: string;
  tokenHash: string;
  concessaoId: string;
  expiraEm: Date;
  usadoEm: Date | null;
  revogadoEm: Date | null;
}

interface AccessLinha {
  id: string;
  jti: string;
  tokenHash: string;
  concessaoId: string;
  expiraEm: Date;
  revogadoEm: Date | null;
}

interface Harness {
  config: OauthConfigService;
  autorizacao: OauthAutorizacaoService;
  clientesServico: OauthClienteService;
  tokens: OauthTokenService;
  metadata: OauthMetadataService;
  usuario: UsuarioLinha;
  relogio: { agora(): Date; avancar(segundos: number): void };
  email: { enviarEmailOTP: jest.Mock };
  cimd: { obter: jest.Mock };
  clientes: { itens: ClienteLinha[] };
  sessoes: { itens: SessaoLinha[] };
  codes: { itens: CodeLinha[] };
  concessoes: { itens: ConcessaoLinha[] };
  refreshes: { itens: RefreshLinha[] };
  acessos: { itens: AccessLinha[] };
}

type AcessoNegado = { ok: false; status: 401; headers: { 'WWW-Authenticate': string } };
type AcessoPermitido = {
  ok: true;
  contexto: {
    id: string;
    email: string;
    perfil: PerfilUsuario;
    gestorId: string | null;
    tenantId: string | null;
    scope: string;
    jti: string;
  };
};

function hashSegredo(valor: string): string {
  return createHash('sha256').update(valor, 'utf8').digest('hex');
}

function lerPayload(token: string): Record<string, unknown> {
  const corpo = token.split('.')[1];
  if (!corpo) {
    throw new Error('jwt malformado');
  }
  return JSON.parse(Buffer.from(corpo, 'base64url').toString('utf8')) as Record<string, unknown>;
}

function mensagemDe(fn: () => void): string {
  try {
    fn();
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro);
  }
  throw new Error('era esperado um erro de configuração');
}

function configDe(env: Record<string, string | undefined>): ConfigService {
  return {
    get: (chave: string, padrao?: unknown) => {
      const valor = env[chave];
      if (valor === undefined || valor === '') {
        return padrao as string | undefined;
      }
      return valor;
    },
  } as unknown as ConfigService;
}

function aplicarEnv(env: Record<string, string | undefined>): () => void {
  const anterior: Record<string, string | undefined> = {};
  CHAVES_ENV.forEach((chave) => {
    anterior[chave] = process.env[chave];
    if (env[chave] === undefined) {
      delete process.env[chave];
    } else {
      process.env[chave] = env[chave];
    }
  });
  return () => {
    CHAVES_ENV.forEach((chave) => {
      if (anterior[chave] === undefined) {
        delete process.env[chave];
      } else {
        process.env[chave] = anterior[chave];
      }
    });
  };
}

async function comEnv<T>(env: Record<string, string | undefined>, fn: () => Promise<T> | T): Promise<T> {
  const restaurar = aplicarEnv(env);
  try {
    return await fn();
  } finally {
    restaurar();
  }
}

function lerRepo(relativo: string): string {
  return readFileSync(join(__dirname, '../../../../../../', relativo), 'utf8');
}

function queryValida(scope: string = SCOPE) {
  return {
    responseType: 'code',
    clientId: CLIENT_ID,
    redirectUri: REDIRECT,
    codeChallenge: CHALLENGE,
    codeChallengeMethod: 'S256',
    resource: ENDPOINT,
    scope,
    state: 'estado-1',
  };
}

function consentimento(sessaoConsentimento: string, scope: string = SCOPE) {
  return {
    sessaoConsentimento,
    ...queryValida(scope),
  };
}

function pedidoCodigo(code: string, sobre: Partial<{
  redirectUri: string;
  codeVerifier: string;
  resource: string;
  clientId: string;
}> = {}): {
  grantType: 'authorization_code';
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  resource: string;
  clientId: string;
} {
  return {
    grantType: 'authorization_code',
    code,
    redirectUri: REDIRECT,
    codeVerifier: VERIFIER,
    resource: ENDPOINT,
    clientId: CLIENT_ID,
    ...sobre,
  };
}

function comoNegado(resultado: AcessoPermitido | AcessoNegado): AcessoNegado {
  if (resultado.ok) {
    throw new Error('esperado 401');
  }
  return resultado;
}

function comoContexto(resultado: AcessoPermitido | AcessoNegado): AcessoPermitido['contexto'] {
  if (!resultado.ok) {
    throw new Error('esperado acesso');
  }
  return resultado.contexto;
}

function criarHarness(env: Record<string, string | undefined>): Harness {
  const usuario: UsuarioLinha = {
    id: '22222222-2222-4222-8222-222222222222',
    nome: 'Gestora Teste',
    email: 'gestora@exemplo.com',
    perfil: PerfilUsuario.GESTOR,
    status: StatusUsuario.ATIVO,
    gestorId: '22222222-2222-4222-8222-222222222222',
    tenantId: '22222222-2222-4222-8222-222222222222',
    otpCode: null,
    otpExpiresAt: null,
  };
  const relogio = (() => {
    let instante = new Date(AGORA.getTime());
    return {
      agora(): Date {
        return new Date(instante.getTime());
      },
      avancar(segundos: number): void {
        instante = new Date(instante.getTime() + segundos * 1000);
      },
    };
  })();
  const segredos = (() => {
    let n = 0;
    return {
      otp(): string {
        return '482913';
      },
      opaco(): string {
        n += 1;
        return `segredo-${n}`;
      },
      uuid(): string {
        n += 1;
        return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
      },
    };
  })();
  const usuarios = {
    usuario,
    async buscarPorEmail(email: string) {
      if (usuario.email !== email) return null;
      return { ...usuario };
    },
    async buscarPorId(id: string) {
      if (usuario.id !== id) return null;
      return { ...usuario };
    },
    async atualizarOtp(id: string, codigo: string, expiraEm: Date) {
      if (usuario.id !== id) throw new Error('usuario ausente');
      usuario.otpCode = codigo;
      usuario.otpExpiresAt = expiraEm;
    },
    async limparOtp(id: string) {
      if (usuario.id !== id) throw new Error('usuario ausente');
      usuario.otpCode = null;
      usuario.otpExpiresAt = null;
    },
  };
  const clientes = {
    itens: [{
      id: CLIENTE_INTERNO,
      clientId: CLIENT_ID,
      nome: 'Cliente MCP',
      redirectUris: [REDIRECT],
      origem: 'cimd' as const,
      documento: null,
    }],
    async buscarPorClientId(clientId: string) {
      const item = this.itens.find((linha: ClienteLinha) => linha.clientId === clientId);
      if (!item) return null;
      return { ...item, redirectUris: [...item.redirectUris] };
    },
    async salvar(cliente: ClienteLinha) {
      if (this.itens.some((linha: ClienteLinha) => linha.clientId === cliente.clientId)) {
        throw new Error('client_id duplicado');
      }
      this.itens.push({ ...cliente, redirectUris: [...cliente.redirectUris] });
    },
  };
  const sessoes = memoria<SessaoLinha>('sessaoHash');
  const codes = memoria<CodeLinha>('codeHash');
  const concessoes = {
    itens: [] as ConcessaoLinha[],
    async salvar(concessao: ConcessaoLinha) {
      this.itens.push({ ...concessao });
    },
    async buscarPorId(id: string) {
      const item = this.itens.find((linha: ConcessaoLinha) => linha.id === id);
      return item ? { ...item } : null;
    },
    async revogar(id: string, quando: Date) {
      const item = this.itens.find((linha: ConcessaoLinha) => linha.id === id);
      if (!item) throw new Error(`concessao ${id} ausente`);
      item.revogadaEm = quando;
    },
  };
  const refreshes = memoriaRefresh();
  const acessos = memoriaAccess();
  const email = { enviarEmailOTP: jest.fn(async () => undefined) };
  const cimd = { obter: jest.fn(async () => null) };
  const config = new OauthConfigService(configDe(env));
  const clientesServico = new OauthClienteService(clientes, cimd, segredos);
  const autorizacao = new OauthAutorizacaoService(
    config,
    usuarios,
    clientesServico,
    sessoes,
    codes,
    email,
    relogio,
    segredos,
  );
  const tokens = new OauthTokenService(
    config,
    usuarios,
    codes,
    concessoes,
    refreshes,
    acessos,
    relogio,
    segredos,
  );
  return {
    config,
    autorizacao,
    clientesServico,
    tokens,
    metadata: new OauthMetadataService(config),
    usuario,
    relogio,
    email,
    cimd,
    clientes,
    sessoes,
    codes,
    concessoes,
    refreshes,
    acessos,
  };
}

function memoria<T extends { id: string }>(campoHash: keyof T) {
  return {
    itens: [] as T[],
    async salvar(registro: T) {
      this.itens.push({ ...registro });
    },
    async buscarPorHash(hash: string) {
      const item = this.itens.find((linha: T) => linha[campoHash] === hash);
      return item ? { ...item } : null;
    },
    async marcarUsado(id: string, quando: Date) {
      const item = this.itens.find((linha: T) => linha.id === id) as { usadoEm: Date | null } | undefined;
      if (!item) throw new Error(`registro ${id} ausente`);
      item.usadoEm = quando;
    },
  };
}

function memoriaRefresh() {
  return {
    itens: [] as RefreshLinha[],
    async salvar(registro: RefreshLinha) {
      this.itens.push({ ...registro });
    },
    async buscarPorHash(tokenHash: string) {
      const item = this.itens.find((linha: RefreshLinha) => linha.tokenHash === tokenHash);
      return item ? { ...item } : null;
    },
    async marcarUsado(id: string, quando: Date) {
      const item = this.itens.find((linha: RefreshLinha) => linha.id === id);
      if (!item) throw new Error(`refresh ${id} ausente`);
      item.usadoEm = quando;
    },
    async revogarPorConcessao(concessaoId: string, quando: Date) {
      this.itens.forEach((linha: RefreshLinha) => {
        if (linha.concessaoId === concessaoId) linha.revogadoEm = quando;
      });
    },
  };
}

function memoriaAccess() {
  return {
    itens: [] as AccessLinha[],
    async salvar(registro: AccessLinha) {
      this.itens.push({ ...registro });
    },
    async buscarPorHash(tokenHash: string) {
      const item = this.itens.find((linha: AccessLinha) => linha.tokenHash === tokenHash);
      return item ? { ...item } : null;
    },
    async buscarPorJti(jti: string) {
      const item = this.itens.find((linha: AccessLinha) => linha.jti === jti);
      return item ? { ...item } : null;
    },
    async revogarPorConcessao(concessaoId: string, quando: Date) {
      this.itens.forEach((linha: AccessLinha) => {
        if (linha.concessaoId === concessaoId) linha.revogadoEm = quando;
      });
    },
  };
}

function comHarness(
  fn: (h: Harness) => Promise<void>,
  env: Record<string, string | undefined> = ENV_BASE,
): Promise<void> {
  return comEnv(env, () => fn(criarHarness(env)));
}

async function novoCodigo(h: Harness, scope: string = SCOPE): Promise<string> {
  await h.autorizacao.solicitarOtp({ email: h.usuario.email });
  const { sessaoConsentimento } = await h.autorizacao.validarOtp({
    email: h.usuario.email,
    codigo: '482913',
  });
  await h.autorizacao.iniciarAutorizacao(queryValida(scope));
  const { redirectPara } = await h.autorizacao.consentir(consentimento(sessaoConsentimento, scope));
  const code = new URL(redirectPara).searchParams.get('code');
  if (!code) throw new Error('code ausente no redirect');
  return code;
}

function linhaDoCodigo(h: Harness, code: string): CodeLinha {
  const linha = h.codes.itens.find((item) => item.codeHash === hashSegredo(code));
  if (!linha) throw new Error('authorization code não persistido como hash');
  return linha;
}

function refreshesVigentes(h: Harness): RefreshLinha[] {
  return h.refreshes.itens.filter((item) => {
    const concessao = h.concessoes.itens.find((linha) => linha.id === item.concessaoId);
    return !item.usadoEm && !item.revogadoEm && Boolean(concessao) && !concessao?.revogadaEm;
  });
}

async function conceder(h: Harness) {
  const code = await novoCodigo(h);
  return h.tokens.emitirToken(pedidoCodigo(code));
}

describe('UC-01: autorizar cliente MCP com OTP e PKCE', () => {
  it('deve responder 401 com resource_metadata e publicar o metadata OAuth fora de /api', async () => {
    // Arrange
    await comHarness(async (h) => {
      // Act
      const documento = h.metadata.authorizationServer();
      const recurso = h.metadata.recursoProtegido();
      const cabecalho = h.metadata.respostaNaoAutenticado().headers['WWW-Authenticate'];
      const semToken = comoNegado(await h.tokens.exigirAcesso(undefined));
      const vazio = comoNegado(await h.tokens.exigirAcesso(''));
      const descritas = ROTAS_OAUTH_SEM_PREFIXO_API
        .map((rota: { path: string; method: RequestMethod }) => `${RequestMethod[rota.method]} ${rota.path}`)
        .sort();

      // Assert
      expect(documento.issuer).toBe('http://issuer.local');
      expect(documento.authorization_endpoint).toBe('http://localhost:3001/oauth/authorize');
      expect(documento.token_endpoint).toBe('http://localhost:3001/oauth/token');
      expect(documento.revocation_endpoint).toBe('http://localhost:3001/oauth/revoke');
      expect(documento.registration_endpoint).toBe('http://localhost:3001/oauth/register');
      expect(documento.response_types_supported).toEqual(['code']);
      expect(documento.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
      expect(documento.code_challenge_methods_supported).toEqual(['S256']);
      expect(documento.token_endpoint_auth_methods_supported).toEqual(['none']);
      expect(documento.scopes_supported).toEqual([...SCOPES_OPERACIONAIS]);
      expect(recurso.resource).toBe(ENDPOINT);
      expect(recurso.authorization_servers).toEqual(['http://issuer.local']);
      expect(recurso.bearer_methods_supported).toEqual(['header']);
      expect(recurso.scopes_supported).toEqual([...SCOPES_OPERACIONAIS]);
      expect(cabecalho).toContain(`resource_metadata="${METADATA_RECURSO}"`);
      expect(cabecalho).toContain('error="invalid_token"');
      expect(cabecalho).not.toContain('/api/');
      expect(semToken).toEqual({ ok: false, status: 401, headers: { 'WWW-Authenticate': cabecalho } });
      expect(vazio.status).toBe(401);
      expect(descritas).toEqual([
        'GET .well-known/oauth-authorization-server',
        'GET .well-known/oauth-protected-resource',
        'GET mcp',
        'GET oauth/authorize',
        'POST mcp',
        'POST oauth/authorize',
        'POST oauth/otp/solicitar',
        'POST oauth/otp/validar',
        'POST oauth/register',
        'POST oauth/revoke',
        'POST oauth/token',
      ]);
      expect([...SCOPES_OPERACIONAIS]).toEqual([
        'chekai:contexto',
        'chekai:clientes:ler',
        'chekai:checklists:ler',
        'chekai:auditorias:ler',
        'chekai:auditorias:escrever',
        'chekai:auditorias:finalizar',
        'chekai:agenda:ler',
        'chekai:agenda:concluir',
        'chekai:tarefas:ler',
        'chekai:tarefas:escrever',
        'chekai:relatorios:ler',
        'chekai:relatorios:escrever',
        'chekai:relatorios:finalizar',
      ]);
    });

    await comHarness(async (h) => {
      expect(h.metadata.authorizationServer().token_endpoint).toBe('http://localhost:3001/oauth/token');
      expect(h.metadata.recursoProtegido().resource).toBe('http://localhost:3001/mcp');
    }, { ...ENV_BASE, MCP_PUBLIC_URL: 'http://localhost:3001/' });
  });

  it('deve versionar o schema OAuth em scripts e excluir as rotas do prefixo /api', () => {
    // Arrange
    const main = lerRepo('apps/api/src/main.ts');
    const appModule = lerRepo('apps/api/src/app.module.ts');
    const sql = lerRepo('scripts/criar-tabelas-oauth-mcp.sql');

    // Act / Assert
    expect(main).toMatch(/setGlobalPrefix\(\s*'api'\s*,\s*\{[\s\S]*ROTAS_OAUTH_SEM_PREFIXO_API/);
    expect(appModule).toContain('McpModule');
    [
      'oauth_clientes',
      'oauth_sessoes_consentimento',
      'oauth_authorization_codes',
      'oauth_concessoes',
      'oauth_refresh_tokens',
      'oauth_access_tokens',
    ].forEach((tabela) => {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${tabela}`);
    });
    expect(sql).toContain('code_hash');
    expect(sql).toContain('sessao_hash');
    expect(sql).toContain('token_hash');
    expect(sql).toContain('jti');
  });

  it('deve emitir code, access token de 1 hora e refresh da concessão', async () => {
    await comHarness(async (h) => {
      // Arrange
      expect(createHash('sha256').update(VERIFIER).digest('base64url')).toBe(CHALLENGE);
      await h.autorizacao.solicitarOtp({ email: h.usuario.email });
      const { sessaoConsentimento } = await h.autorizacao.validarOtp({
        email: h.usuario.email,
        codigo: '482913',
      });
      const inicio = await h.autorizacao.iniciarAutorizacao(queryValida());

      // Act
      const consent = await h.autorizacao.consentir(consentimento(sessaoConsentimento));
      const redirect = new URL(consent.redirectPara);
      const code = redirect.searchParams.get('code') as string;
      const resposta = await h.tokens.emitirToken(pedidoCodigo(code));
      const payload = lerPayload(resposta.access_token);
      const acesso = comoContexto(await h.tokens.exigirAcesso(`Bearer ${resposta.access_token}`));
      const codeLinha = linhaDoCodigo(h, code);
      const refreshLinha = h.refreshes.itens.find((item) => item.tokenHash === hashSegredo(resposta.refresh_token));
      const accessLinha = h.acessos.itens.find((item) => item.tokenHash === hashSegredo(resposta.access_token));

      // Assert
      const tela = new URL(inicio.url);
      expect(`${tela.origin}${tela.pathname}`).toBe('http://localhost:3031/oauth/autorizar');
      expect(tela.searchParams.get('state')).toBe('estado-1');
      expect(tela.searchParams.get('code_challenge')).toBe(CHALLENGE);
      expect(tela.searchParams.get('redirect_uri')).toBe(REDIRECT);
      expect(tela.searchParams.get('resource')).toBe(ENDPOINT);
      expect(tela.searchParams.get('client_id')).toBe(CLIENT_ID);
      expect(redirect.searchParams.get('state')).toBe('estado-1');
      expect(h.sessoes.itens[0].sessaoHash).toBe(hashSegredo(sessaoConsentimento));
      expect(h.sessoes.itens[0].usadoEm).not.toBeNull();
      expect(JSON.stringify(h.sessoes.itens)).not.toContain(sessaoConsentimento);
      expect(codeLinha.clienteId).toBe(CLIENTE_INTERNO);
      expect(codeLinha.usuarioId).toBe(h.usuario.id);
      expect(codeLinha.redirectUri).toBe(REDIRECT);
      expect(codeLinha.codeChallenge).toBe(CHALLENGE);
      expect(codeLinha.resource).toBe(ENDPOINT);
      expect(codeLinha.scopes).toBe(SCOPE);
      expect(codeLinha.usadoEm).not.toBeNull();
      expect(codeLinha.expiraEm.toISOString()).toBe(new Date(AGORA.getTime() + 10 * 60 * 1000).toISOString());
      expect(JSON.stringify(h.codes.itens)).not.toContain(code);
      expect(resposta.token_type).toBe('Bearer');
      expect(resposta.expires_in).toBe(3600);
      expect(resposta.scope).toBe(SCOPE);
      expect(payload).toMatchObject({
        iss: 'http://issuer.local',
        sub: h.usuario.id,
        aud: ENDPOINT,
        resource: ENDPOINT,
        scope: SCOPE,
        perfil: PerfilUsuario.GESTOR,
      });
      expect(payload.iat).toBe(Math.floor(AGORA.getTime() / 1000));
      expect(payload.exp).toBe(Math.floor(AGORA.getTime() / 1000) + 3600);
      expect(payload.gestorId).toBeUndefined();
      expect(payload.tenantId).toBeUndefined();
      expect(refreshLinha?.expiraEm.toISOString()).toBe(new Date(AGORA.getTime() + 1209600 * 1000).toISOString());
      expect(JSON.stringify(h.refreshes.itens)).not.toContain(resposta.refresh_token);
      expect(accessLinha?.jti).toBe(payload.jti);
      expect(accessLinha?.expiraEm.toISOString()).toBe(new Date(AGORA.getTime() + 3600 * 1000).toISOString());
      expect(JSON.stringify(h.acessos.itens)).not.toContain(resposta.access_token);
      expect(h.concessoes.itens[0]).toMatchObject({
        clienteId: CLIENTE_INTERNO,
        usuarioId: h.usuario.id,
        resource: ENDPOINT,
        scopes: SCOPE,
        revogadaEm: null,
      });
      expect(acesso).toMatchObject({
        id: h.usuario.id,
        email: h.usuario.email,
        perfil: PerfilUsuario.GESTOR,
        gestorId: h.usuario.gestorId,
        tenantId: h.usuario.tenantId,
        scope: SCOPE,
        jti: payload.jti,
      });
      await expect(h.autorizacao.consentir(consentimento(sessaoConsentimento))).rejects.toBeInstanceOf(UnauthorizedException);
      expect(h.codes.itens).toHaveLength(1);
    });
  });

  it('deve emitir OTP de 6 dígitos com validade de 10 minutos', async () => {
    await comHarness(async (h) => {
      // Act
      const resposta = await h.autorizacao.solicitarOtp({ email: h.usuario.email });

      // Assert
      expect(resposta).toEqual({ message: 'Código OTP enviado por e-mail' });
      expect(h.usuario.otpCode).toMatch(/^\d{6}$/);
      expect(h.usuario.otpCode).toBe('482913');
      expect(h.usuario.otpExpiresAt?.toISOString()).toBe(new Date(AGORA.getTime() + 10 * 60 * 1000).toISOString());
      expect(h.email.enviarEmailOTP).toHaveBeenCalledWith('gestora@exemplo.com', 'Gestora Teste', '482913');
      expect(JSON.stringify(resposta)).not.toContain('482913');
    });
  });

  it('deve recusar redirect, PKCE, resource ou reuso de code', async () => {
    await comHarness(async (h) => {
      // Arrange
      const recusarInicio = async (parcial: Record<string, string | undefined>, apagar: string[] = []) => {
        const query: Record<string, string | undefined> = { ...queryValida(), ...parcial };
        apagar.forEach((chave) => {
          delete query[chave];
        });
        const antes = h.codes.itens.length;
        await expect(h.autorizacao.iniciarAutorizacao(query as never)).rejects.toBeInstanceOf(BadRequestException);
        expect(h.codes.itens.length).toBe(antes);
      };

      // Act / Assert
      await recusarInicio({ redirectUri: 'https://evil.exemplo/callback' });
      await recusarInicio({ redirectUri: `${REDIRECT}/` });
      await recusarInicio({}, ['codeChallenge']);
      await recusarInicio({ codeChallengeMethod: 'plain' });
      await recusarInicio({}, ['codeChallengeMethod']);
      await recusarInicio({ responseType: 'token' });
      await recusarInicio({}, ['state']);
      await recusarInicio({ resource: 'http://localhost:3001/outro' });
      await recusarInicio({}, ['resource']);
      await recusarInicio({ clientId: 'cliente-desconhecido' });

      const recusarTroca = async (code: string, sobre: Partial<{
        redirectUri: string;
        codeVerifier: string;
        resource: string;
        clientId: string;
      }> = {}, apagarVerifier = false) => {
        const pedido = pedidoCodigo(code, sobre);
        if (apagarVerifier) delete pedido.codeVerifier;
        await expect(h.tokens.emitirToken(pedido)).rejects.toBeInstanceOf(UnauthorizedException);
        expect(linhaDoCodigo(h, code).usadoEm).not.toBeNull();
        expect(h.refreshes.itens).toHaveLength(0);
      };

      await recusarTroca(await novoCodigo(h), { codeVerifier: 'verifier-invalido' });
      await recusarTroca(await novoCodigo(h), {}, true);
      await recusarTroca(await novoCodigo(h), { redirectUri: 'https://evil.exemplo/callback' });
      await recusarTroca(await novoCodigo(h), { resource: 'http://localhost:3001/outro' });
      await recusarTroca(await novoCodigo(h), { clientId: 'outro-cliente' });

      const codeOk = await novoCodigo(h);
      const resposta = await h.tokens.emitirToken(pedidoCodigo(codeOk));
      const jti = h.acessos.itens[0].jti;
      const iat = Math.floor(AGORA.getTime() / 1000);
      const oauthJwt = new JwtService({ secret: 'chave-oauth-distinta' });
      const audienciaErrada = oauthJwt.sign({
        iss: 'http://issuer.local',
        sub: h.usuario.id,
        aud: 'http://localhost:3001/outro',
        resource: ENDPOINT,
        scope: SCOPE,
        perfil: PerfilUsuario.GESTOR,
        jti,
        iat,
        exp: iat + 3600,
      });
      const resourceErrado = oauthJwt.sign({
        iss: 'http://issuer.local',
        sub: h.usuario.id,
        aud: ENDPOINT,
        resource: 'http://localhost:3001/outro',
        scope: SCOPE,
        perfil: PerfilUsuario.GESTOR,
        jti,
        iat,
        exp: iat + 3600,
      });

      expect(comoNegado(await h.tokens.exigirAcesso(`Bearer ${audienciaErrada}`)).status).toBe(401);
      expect(comoNegado(await h.tokens.exigirAcesso(`Bearer ${resourceErrado}`)).status).toBe(401);
      comoContexto(await h.tokens.exigirAcesso(`Bearer ${resposta.access_token}`));
      await expect(h.tokens.emitirToken(pedidoCodigo(codeOk))).rejects.toBeInstanceOf(UnauthorizedException);
      expect(h.refreshes.itens).toHaveLength(1);
      expect(h.acessos.itens).toHaveLength(1);
      expect(h.concessoes.itens[0].revogadaEm).toBeNull();
    });
  });

  it('deve recusar OTP de conta nao_confirmado', async () => {
    await comHarness(async (h) => {
      // Arrange
      h.usuario.status = StatusUsuario.NAO_CONFIRMADO;

      // Act / Assert
      await expect(h.autorizacao.solicitarOtp({ email: h.usuario.email })).rejects.toThrow(
        'Convite pendente. Verifique seu e-mail para aceitar o convite.',
      );
      await expect(h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '482913' })).rejects.toThrow(
        'Usuário inativo ou não confirmado',
      );
      expect(h.sessoes.itens).toHaveLength(0);
      expect(h.email.enviarEmailOTP).not.toHaveBeenCalled();
    });
  });

  it('deve recusar OTP de conta inativo', async () => {
    await comHarness(async (h) => {
      // Arrange
      h.usuario.status = StatusUsuario.INATIVO;

      // Act / Assert
      await expect(h.autorizacao.solicitarOtp({ email: h.usuario.email })).rejects.toThrow('Usuário inativo');
      await expect(h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '482913' })).rejects.toThrow(
        'Usuário inativo ou não confirmado',
      );
      expect(h.email.enviarEmailOTP).not.toHaveBeenCalled();
    });
  });

  it('deve falhar de forma explícita sem FRONTEND_URL', async () => {
    await comEnv({ NODE_ENV: 'development' }, () => {
      // Arrange
      const config = new OauthConfigService(configDe({ NODE_ENV: 'development' }));

      // Act
      const aoResolver = mensagemDe(() => config.resolver());
      const aoSubir = mensagemDe(() => config.assertAmbiente());

      // Assert
      expect(aoResolver).toContain('FRONTEND_URL');
      expect(aoSubir).toContain('FRONTEND_URL');
      expect(aoResolver.toLowerCase()).not.toContain('localhost');
    });
  });

  it('deve aceitar o OTP mock só fora de produção', async () => {
    // Arrange / Act / Assert
    await comHarness(async (h) => {
      h.usuario.otpCode = '111111';
      h.usuario.otpExpiresAt = new Date(AGORA.getTime() + 60_000);
      const resultado = await h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '252622' });
      expect(resultado.sessaoConsentimento.split('.')).toHaveLength(1);
      expect(h.usuario.otpCode).toBe('111111');
    });

    await comHarness(async (h) => {
      await expect(h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '252622' })).rejects.toThrow(
        'Código OTP não solicitado ou expirado',
      );
      expect(h.sessoes.itens).toHaveLength(0);
    }, { ...ENV_BASE, NODE_ENV: 'production' });
  });

  it('deve recusar scope desconhecido e não conceder scope por omissão', async () => {
    await comHarness(async (h) => {
      // Arrange
      await h.autorizacao.solicitarOtp({ email: h.usuario.email });
      const { sessaoConsentimento } = await h.autorizacao.validarOtp({
        email: h.usuario.email,
        codigo: '482913',
      });
      const recusar = async (scope?: string) => {
        const query: Record<string, string | undefined> = { ...queryValida(), scope };
        if (scope === undefined) delete query.scope;
        await expect(h.autorizacao.iniciarAutorizacao(query as never)).rejects.toBeInstanceOf(BadRequestException);
      };

      // Act / Assert
      await recusar(undefined);
      await recusar('');
      await recusar('chekai:admin');
      await recusar('chekai:contexto chekai:admin');
      await expect(
        h.autorizacao.consentir(consentimento(sessaoConsentimento, 'chekai:admin')),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(h.codes.itens).toHaveLength(0);

      const code = await novoCodigo(h, SCOPE);
      expect(linhaDoCodigo(h, code).scopes).toBe(SCOPE);
      const todos = [...SCOPES_OPERACIONAIS].join(' ');
      const codeTodos = await novoCodigo(h, todos);
      expect(linhaDoCodigo(h, codeTodos).scopes).toBe(todos);
    });
  });

  it('deve recusar OTP inválido ou expirado sem emitir code', async () => {
    await comHarness(async (h) => {
      // Arrange
      h.usuario.otpCode = '111111';
      h.usuario.otpExpiresAt = new Date(AGORA.getTime() + 60_000);

      // Act / Assert
      await expect(h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '482913' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(h.usuario.otpCode).toBe('111111');

      h.usuario.otpExpiresAt = new Date(AGORA.getTime() - 1000);
      await expect(h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '111111' })).rejects.toBeInstanceOf(
        BadRequestException,
      );

      h.usuario.otpCode = null;
      h.usuario.otpExpiresAt = null;
      await expect(h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '482913' })).rejects.toThrow(
        'Código OTP não solicitado ou expirado',
      );
      expect(h.sessoes.itens).toHaveLength(0);
      expect(h.codes.itens).toHaveLength(0);
    });
  });

  it('deve recusar o OTP correto depois de 5 falhas durante a validade', async () => {
    await comHarness(async (h) => {
      await h.autorizacao.solicitarOtp({ email: h.usuario.email });

      for (let tentativa = 0; tentativa < 5; tentativa += 1) {
        await expect(
          h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '000000' }),
        ).rejects.toThrow('Código OTP inválido');
      }

      await expect(
        h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '482913' }),
      ).rejects.toThrow('Muitas tentativas. Solicite um novo código.');
      expect(h.sessoes.itens).toHaveLength(0);
      expect(h.usuario.otpCode).toBe('482913');
    });
  });

  it('deve aceitar o OTP depois de 4 falhas e zerar o limite nesse sucesso', async () => {
    await comHarness(async (h) => {
      await h.autorizacao.solicitarOtp({ email: h.usuario.email });
      for (let tentativa = 0; tentativa < 4; tentativa += 1) {
        await expect(
          h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '000000' }),
        ).rejects.toThrow('Código OTP inválido');
      }

      await expect(
        h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '482913' }),
      ).resolves.toHaveProperty('sessaoConsentimento');

      h.usuario.otpCode = '482913';
      h.usuario.otpExpiresAt = new Date(AGORA.getTime() + 10 * 60 * 1000);
      for (let tentativa = 0; tentativa < 4; tentativa += 1) {
        await expect(
          h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '000000' }),
        ).rejects.toThrow('Código OTP inválido');
      }
      await expect(
        h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '482913' }),
      ).resolves.toHaveProperty('sessaoConsentimento');
    });
  });

  it('deve zerar o limite de OTP quando um novo código é solicitado', async () => {
    await comHarness(async (h) => {
      await h.autorizacao.solicitarOtp({ email: h.usuario.email });
      for (let tentativa = 0; tentativa < 5; tentativa += 1) {
        await expect(
          h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '000000' }),
        ).rejects.toThrow('Código OTP inválido');
      }
      await expect(
        h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '482913' }),
      ).rejects.toThrow('Muitas tentativas. Solicite um novo código.');

      await h.autorizacao.solicitarOtp({ email: h.usuario.email });
      await expect(
        h.autorizacao.validarOtp({ email: h.usuario.email, codigo: '482913' }),
      ).resolves.toHaveProperty('sessaoConsentimento');
    });
  });

  it('deve resolver o Client ID Metadata Document e registrar cliente só como fallback', async () => {
    await comHarness(async (h) => {
      // Arrange
      const cimdId = 'https://outro.exemplo/oauth/client.json';
      h.cimd.obter.mockImplementation(async (clientId: string) => {
        if (clientId !== cimdId) return null;
        return { redirect_uris: ['https://outro.exemplo/callback'], client_name: 'Outro' };
      });

      // Act
      const inicio = await h.autorizacao.iniciarAutorizacao({
        ...queryValida(),
        clientId: cimdId,
        redirectUri: 'https://outro.exemplo/callback',
      });
      await h.autorizacao.iniciarAutorizacao({
        ...queryValida(),
        clientId: cimdId,
        redirectUri: 'https://outro.exemplo/callback',
      });
      const salvo = h.clientes.itens.find((item) => item.clientId === cimdId);
      const registrado = await h.clientesServico.registrar({
        clientName: 'Fallback',
        redirectUris: ['https://fallback.exemplo/callback'],
      });

      // Assert
      expect(new URL(inicio.url).searchParams.get('client_id')).toBe(cimdId);
      expect(h.cimd.obter).toHaveBeenCalledTimes(1);
      expect(salvo).toMatchObject({
        origem: 'cimd',
        nome: 'Outro',
        redirectUris: ['https://outro.exemplo/callback'],
        documento: { redirect_uris: ['https://outro.exemplo/callback'], client_name: 'Outro' },
      });
      expect(registrado.client_id.startsWith('https://')).toBe(false);
      expect(h.clientes.itens.find((item) => item.clientId === registrado.client_id)).toMatchObject({
        origem: 'registro',
        nome: 'Fallback',
        redirectUris: ['https://fallback.exemplo/callback'],
        documento: null,
      });
      const fallback = await h.autorizacao.iniciarAutorizacao({
        ...queryValida(),
        clientId: registrado.client_id,
        redirectUri: 'https://fallback.exemplo/callback',
      });
      expect(new URL(fallback.url).searchParams.get('redirect_uri')).toBe('https://fallback.exemplo/callback');
      await expect(h.autorizacao.iniciarAutorizacao({
        ...queryValida(),
        clientId: registrado.client_id,
        redirectUri: 'https://fallback.exemplo/outro',
      })).rejects.toBeInstanceOf(BadRequestException);
      await expect(h.autorizacao.iniciarAutorizacao({
        ...queryValida(),
        clientId: 'http://outro.exemplo/oauth/client.json',
      })).rejects.toBeInstanceOf(BadRequestException);
      await expect(h.autorizacao.iniciarAutorizacao({
        ...queryValida(),
        clientId: 'cliente-opaco',
      })).rejects.toBeInstanceOf(BadRequestException);
      expect(h.cimd.obter).toHaveBeenCalledTimes(1);
      await expect(h.clientesServico.registrar({ redirectUris: [] })).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  it('deve recusar subir em produção sem URL, issuer, TTLs e chave OAuth própria', async () => {
    // Arrange
    const producaoIncompleta = {
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://chekai.com.br',
    };

    // Act / Assert
    await comEnv(producaoIncompleta, () => {
      const config = new OauthConfigService(configDe(producaoIncompleta));
      const mensagem = mensagemDe(() => config.onModuleInit());
      expect(mensagem).toContain('MCP_PUBLIC_URL');
      expect(mensagem).toContain('OAUTH_ISSUER');
      expect(mensagem).toContain('OAUTH_ACCESS_TOKEN_TTL');
      expect(mensagem).toContain('OAUTH_REFRESH_TOKEN_TTL');
      expect(mensagem).toContain('OAUTH_JWT_SECRET');
      expect(mensagemDe(() => config.assertAmbiente())).toContain('MCP_PUBLIC_URL');
    });

    const completa: Record<string, string> = {
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://chekai.com.br',
      MCP_PUBLIC_URL: 'https://api.chekai.com.br',
      OAUTH_ISSUER: 'https://issuer.chekai.com.br',
      OAUTH_ACCESS_TOKEN_TTL: '3600',
      OAUTH_REFRESH_TOKEN_TTL: '1209600',
      OAUTH_JWT_SECRET: 'chave-oauth',
      JWT_SECRET: 'chave-web',
    };
    await comEnv({ ...completa, OAUTH_JWT_SECRET: 'mesma', JWT_SECRET: 'mesma' }, () => {
      const config = new OauthConfigService(configDe({ ...completa, OAUTH_JWT_SECRET: 'mesma', JWT_SECRET: 'mesma' }));
      const mensagem = mensagemDe(() => config.assertAmbiente());
      expect(mensagem).toContain('OAUTH_JWT_SECRET');
      expect(mensagem).toContain('JWT_SECRET');
    });
    await comEnv({ ...completa, OAUTH_ACCESS_TOKEN_TTL: 'abc' }, () => {
      const config = new OauthConfigService(configDe({ ...completa, OAUTH_ACCESS_TOKEN_TTL: 'abc' }));
      expect(mensagemDe(() => config.assertAmbiente())).toContain('OAUTH_ACCESS_TOKEN_TTL');
    });
    await comEnv({ ...completa, OAUTH_REFRESH_TOKEN_TTL: '0' }, () => {
      const config = new OauthConfigService(configDe({ ...completa, OAUTH_REFRESH_TOKEN_TTL: '0' }));
      expect(mensagemDe(() => config.assertAmbiente())).toContain('OAUTH_REFRESH_TOKEN_TTL');
    });
    await comEnv(completa, () => {
      const config = new OauthConfigService(configDe(completa));
      expect(config.onModuleInit()).toBeUndefined();
      expect(config.resolver().aceitaOtpMock).toBe(false);
      expect(config.resolver().chaveAssinatura).not.toBe(config.resolver().chaveJwtWeb);
    });
    await comEnv({ NODE_ENV: 'development', FRONTEND_URL: 'http://localhost:3031' }, () => {
      const config = new OauthConfigService(configDe({
        NODE_ENV: 'development',
        FRONTEND_URL: 'http://localhost:3031',
      }));
      expect(config.onModuleInit()).toBeUndefined();
      expect(config.resolver()).toMatchObject({
        mcpPublicUrl: 'http://localhost:3001',
        issuer: 'http://localhost:3001',
        endpointMcp: 'http://localhost:3001/mcp',
        accessTokenTtlSeconds: 3600,
        refreshTokenTtlSeconds: 1209600,
        chaveAssinatura: 'dev-oauth-mcp-key',
        chaveJwtWeb: 'secret',
        frontendUrl: 'http://localhost:3031',
        aceitaOtpMock: true,
      });
    });
  });
});

describe('UC-02: renovar e revogar a concessão OAuth', () => {
  it('deve rotacionar o refresh e revogar a família no reuso', async () => {
    await comHarness(async (h) => {
      // Arrange
      const primeiro = await conceder(h);

      // Act
      const segundo = await h.tokens.emitirToken({
        grantType: 'refresh_token',
        refreshToken: primeiro.refresh_token,
      });

      // Assert
      expect(segundo.expires_in).toBe(3600);
      expect(segundo.refresh_token).not.toBe(primeiro.refresh_token);
      expect(segundo.access_token).not.toBe(primeiro.access_token);
      expect(lerPayload(segundo.access_token).perfil).toBe(PerfilUsuario.GESTOR);
      expect(refreshesVigentes(h)).toHaveLength(1);
      expect(refreshesVigentes(h)[0].tokenHash).toBe(hashSegredo(segundo.refresh_token));
      comoContexto(await h.tokens.exigirAcesso(`Bearer ${primeiro.access_token}`));
      comoContexto(await h.tokens.exigirAcesso(`Bearer ${segundo.access_token}`));

      await expect(h.tokens.emitirToken({
        grantType: 'refresh_token',
        refreshToken: primeiro.refresh_token,
      })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshesVigentes(h)).toHaveLength(0);
      expect(h.concessoes.itens[0].revogadaEm).not.toBeNull();
      await expect(h.tokens.emitirToken({
        grantType: 'refresh_token',
        refreshToken: segundo.refresh_token,
      })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(comoNegado(await h.tokens.exigirAcesso(`Bearer ${primeiro.access_token}`)).status).toBe(401);
      expect(comoNegado(await h.tokens.exigirAcesso(`Bearer ${segundo.access_token}`)).status).toBe(401);
    });
  });

  it('deve responder 401 com resource_metadata quando o access expira sem refresh válido', async () => {
    await comHarness(async (h) => {
      // Arrange
      const resposta = await conceder(h);

      // Act
      h.relogio.avancar(3601);
      const negado = comoNegado(await h.tokens.exigirAcesso(`Bearer ${resposta.access_token}`));
      const renovado = await h.tokens.emitirToken({
        grantType: 'refresh_token',
        refreshToken: resposta.refresh_token,
      });

      // Assert
      expect(negado.status).toBe(401);
      expect(negado.headers['WWW-Authenticate']).toContain(`resource_metadata="${METADATA_RECURSO}"`);
      expect(renovado.expires_in).toBe(3600);
    });
  });

  it('deve invalidar a família na revogação explícita', async () => {
    await comHarness(async (h) => {
      // Arrange
      const resposta = await conceder(h);

      // Act
      await h.tokens.revogar({ token: resposta.access_token });

      // Assert
      expect(comoNegado(await h.tokens.exigirAcesso(`Bearer ${resposta.access_token}`)).status).toBe(401);
      await expect(h.tokens.emitirToken({
        grantType: 'refresh_token',
        refreshToken: resposta.refresh_token,
      })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(refreshesVigentes(h)).toHaveLength(0);
      await expect(h.tokens.revogar({ token: resposta.refresh_token })).resolves.toBeUndefined();
    });
  });

  it('deve recusar conta que não está ativa', async () => {
    await comHarness(async (h) => {
      // Arrange
      const resposta = await conceder(h);
      const refreshesAntes = h.refreshes.itens.length;
      h.usuario.status = StatusUsuario.INATIVO;

      // Act / Assert
      await expect(h.tokens.emitirToken({
        grantType: 'refresh_token',
        refreshToken: resposta.refresh_token,
      })).rejects.toBeInstanceOf(UnauthorizedException);
      expect(h.refreshes.itens).toHaveLength(refreshesAntes);
      expect(h.refreshes.itens[0].usadoEm).toBeNull();
      expect(comoNegado(await h.tokens.exigirAcesso(`Bearer ${resposta.access_token}`)).status).toBe(401);
    });
  });

  it('deve reler o perfil e rejeitar o JWT web no MCP', async () => {
    await comHarness(async (h) => {
      // Arrange
      const resposta = await conceder(h);
      comoContexto(await h.tokens.exigirAcesso(`Bearer ${resposta.access_token}`));
      h.usuario.perfil = PerfilUsuario.AUDITOR;
      h.usuario.gestorId = '33333333-3333-4333-8333-333333333333';
      h.usuario.tenantId = '33333333-3333-4333-8333-333333333333';

      // Act
      const renovado = await h.tokens.emitirToken({
        grantType: 'refresh_token',
        refreshToken: resposta.refresh_token,
      });
      const claimRenovado = lerPayload(renovado.access_token);
      const contextoRenovado = comoContexto(await h.tokens.exigirAcesso(`Bearer ${renovado.access_token}`));
      h.usuario.perfil = PerfilUsuario.MASTER;
      h.usuario.gestorId = '44444444-4444-4444-8444-444444444444';
      const contextoRelido = comoContexto(await h.tokens.exigirAcesso(`Bearer ${renovado.access_token}`));
      const web = new JwtService({ secret: 'chave-web' });
      const jwtWeb = web.sign({
        sub: h.usuario.id,
        email: h.usuario.email,
        perfil: PerfilUsuario.MASTER,
      });
      const negado = comoNegado(await h.tokens.exigirAcesso(`Bearer ${jwtWeb}`));

      // Assert
      expect(claimRenovado.perfil).toBe(PerfilUsuario.AUDITOR);
      expect(contextoRenovado.perfil).toBe(PerfilUsuario.AUDITOR);
      expect(contextoRenovado.gestorId).toBe('33333333-3333-4333-8333-333333333333');
      expect(contextoRelido.perfil).toBe(PerfilUsuario.MASTER);
      expect(contextoRelido.gestorId).toBe('44444444-4444-4444-8444-444444444444');
      expect(lerPayload(renovado.access_token).perfil).toBe(PerfilUsuario.AUDITOR);
      expect(negado.headers['WWW-Authenticate']).toContain(`resource_metadata="${METADATA_RECURSO}"`);
      expect(() => web.verify(resposta.access_token)).toThrow();
      expect(() => web.verify(renovado.access_token)).toThrow();
    });
  });
});

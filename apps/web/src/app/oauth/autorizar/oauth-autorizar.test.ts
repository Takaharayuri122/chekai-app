/**
 * RED — tela Next `/oauth/autorizar` (UC-01 do canal MCP).
 *
 * Rastreabilidade: RN-AUTH-001, RN-AUTH-003, RN-AUTH-004, RN-AUTH-007,
 * RN-AUTH-009, RN-AUTH-010, RN-MCP-001, RN-MCP-002, RN-MCP-005.
 * Plano: tela e-mail → OTP → consentimento, só scopes operacionais, preservando
 * `state`, PKCE e `redirect_uri`.
 *
 * O Vitest em `apps/web/vitest.config.ts` usa `environment: 'node'` e o
 * `package.json` não traz jsdom nem Testing Library. A página não é renderizada
 * aqui. A especificação fica nestas funções puras, que `page.tsx` deve usar:
 *
 * - `lerParametrosOAuth` / `serializarParametrosOAuth`
 * - `estadoInicial` / `aposOtpSolicitado` / `aposOtpValidado` / `voltarParaEmail`
 * - `prepararSolicitarOtp` / `prepararValidarOtp` / `corpoConsentir`
 * - `scopesParaConsentimento` / `SCOPES_OPERACIONAIS` / `ROTULOS_SCOPES`
 * - `interpretarErroSolicitarOtp` / `interpretarErroValidarOtp` / `interpretarErroConsentimento`
 * - `redirectFinalSeguro` / `redirectRecusaSeguro`
 * - `urlOauth` / `cabecalhosOauth` / `ROTAS_OAUTH_DA_TELA` / `DURACAO_OTP_MS`
 *
 * O módulo `./oauth-autorizar` ainda não existe. O import fica no `beforeEach`,
 * com caminho calculado em runtime, para o Vitest coletar os casos e cada um
 * falhar (RED) sem resolver o arquivo na transformação.
 * Não cobre `page.tsx` nem a API.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';

type ModuloAutorizar = {
  DURACAO_OTP_MS: number;
  ROTAS_OAUTH_DA_TELA: {
    solicitarOtp: string;
    validarOtp: string;
    consentir: string;
  };
  ROTULOS_SCOPES: Record<string, string>;
  SCOPES_OPERACIONAIS: readonly string[];
  aposOtpSolicitado: (estado: EstadoFluxo, email: string) => EstadoFluxo;
  aposOtpValidado: (estado: EstadoFluxo, sessaoConsentimento: string) => EstadoFluxo;
  cabecalhosOauth: () => Record<string, string>;
  corpoConsentir: (estado: EstadoFluxo) => Record<string, string>;
  estadoInicial: (parametros: ParametrosOAuth) => EstadoFluxo;
  interpretarErroConsentimento: (erro: { status: number; message: string }) => { navegar: false; mensagem: string };
  interpretarErroSolicitarOtp: (erro: { status: number; message: string }) => { etapa: 'email'; mensagem: string };
  interpretarErroValidarOtp: (erro: { status: number; message: string }) => {
    etapa: 'otp';
    mensagem: string;
    sessaoConsentimento: null;
  };
  lerParametrosOAuth: (search: string | URLSearchParams | Record<string, string | string[] | undefined>) =>
    | { ok: true; parametros: ParametrosOAuth }
    | { ok: false; mensagem: string };
  prepararSolicitarOtp: (email: string) => { ok: true; corpo: { email: string } } | { ok: false; mensagem: string };
  prepararValidarOtp: (email: string, codigo: string) =>
    | { ok: true; corpo: { email: string; codigo: string } }
    | { ok: false; mensagem: string };
  redirectFinalSeguro: (redirectPara: string, parametros: ParametrosOAuth) =>
    | { ok: true; url: string }
    | { ok: false; mensagem: string };
  redirectRecusaSeguro: (parametros: ParametrosOAuth) => { ok: true; url: string } | { ok: false; mensagem: string };
  scopesParaConsentimento: (scope: string) =>
    | { ok: true; itens: Array<{ id: string; rotulo: string }> }
    | { ok: false; mensagem: string };
  serializarParametrosOAuth: (parametros: ParametrosOAuth) => string;
  urlOauth: (origemApi: string, rota: string) => string;
  voltarParaEmail: (estado: EstadoFluxo) => EstadoFluxo;
};

interface ParametrosOAuth {
  responseType: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  scope: string;
  state: string;
}

interface EstadoFluxo {
  etapa: 'email' | 'otp' | 'consentimento';
  email: string;
  sessaoConsentimento: string | null;
  parametros: ParametrosOAuth;
  mensagem: string | null;
}

let duracaoOtpMs: ModuloAutorizar['DURACAO_OTP_MS'];
let rotasOauthDaTela: ModuloAutorizar['ROTAS_OAUTH_DA_TELA'];
let rotulosScopes: ModuloAutorizar['ROTULOS_SCOPES'];
let scopesOperacionais: ModuloAutorizar['SCOPES_OPERACIONAIS'];
let aposOtpSolicitado: ModuloAutorizar['aposOtpSolicitado'];
let aposOtpValidado: ModuloAutorizar['aposOtpValidado'];
let cabecalhosOauth: ModuloAutorizar['cabecalhosOauth'];
let corpoConsentir: ModuloAutorizar['corpoConsentir'];
let estadoInicial: ModuloAutorizar['estadoInicial'];
let interpretarErroConsentimento: ModuloAutorizar['interpretarErroConsentimento'];
let interpretarErroSolicitarOtp: ModuloAutorizar['interpretarErroSolicitarOtp'];
let interpretarErroValidarOtp: ModuloAutorizar['interpretarErroValidarOtp'];
let lerParametrosOAuth: ModuloAutorizar['lerParametrosOAuth'];
let prepararSolicitarOtp: ModuloAutorizar['prepararSolicitarOtp'];
let prepararValidarOtp: ModuloAutorizar['prepararValidarOtp'];
let redirectFinalSeguro: ModuloAutorizar['redirectFinalSeguro'];
let redirectRecusaSeguro: ModuloAutorizar['redirectRecusaSeguro'];
let scopesParaConsentimento: ModuloAutorizar['scopesParaConsentimento'];
let serializarParametrosOAuth: ModuloAutorizar['serializarParametrosOAuth'];
let urlOauth: ModuloAutorizar['urlOauth'];
let voltarParaEmail: ModuloAutorizar['voltarParaEmail'];

beforeEach(async () => {
  const alvo = pathToFileURL(path.join(
    path.dirname(new URL(import.meta.url).pathname),
    'oauth-autorizar.ts',
  )).href;
  let modulo: ModuloAutorizar;
  try {
    modulo = await import(/* @vite-ignore */ alvo) as ModuloAutorizar;
  } catch (erro) {
    const detalhe = erro instanceof Error ? erro.message : String(erro);
    throw new Error(`RED: oauth-autorizar ainda não existe. ${detalhe}`);
  }
  duracaoOtpMs = modulo.DURACAO_OTP_MS;
  rotasOauthDaTela = modulo.ROTAS_OAUTH_DA_TELA;
  rotulosScopes = modulo.ROTULOS_SCOPES;
  scopesOperacionais = modulo.SCOPES_OPERACIONAIS;
  aposOtpSolicitado = modulo.aposOtpSolicitado;
  aposOtpValidado = modulo.aposOtpValidado;
  cabecalhosOauth = modulo.cabecalhosOauth;
  corpoConsentir = modulo.corpoConsentir;
  estadoInicial = modulo.estadoInicial;
  interpretarErroConsentimento = modulo.interpretarErroConsentimento;
  interpretarErroSolicitarOtp = modulo.interpretarErroSolicitarOtp;
  interpretarErroValidarOtp = modulo.interpretarErroValidarOtp;
  lerParametrosOAuth = modulo.lerParametrosOAuth;
  prepararSolicitarOtp = modulo.prepararSolicitarOtp;
  prepararValidarOtp = modulo.prepararValidarOtp;
  redirectFinalSeguro = modulo.redirectFinalSeguro;
  redirectRecusaSeguro = modulo.redirectRecusaSeguro;
  scopesParaConsentimento = modulo.scopesParaConsentimento;
  serializarParametrosOAuth = modulo.serializarParametrosOAuth;
  urlOauth = modulo.urlOauth;
  voltarParaEmail = modulo.voltarParaEmail;
});

const DESAFIO = 'E'.repeat(43);
const SESSAO = 'sessao-opaca-de-consentimento';
const CODE = 'codigo-de-autorizacao-opaco';

const MENSAGEM_CONVITE = 'Convite pendente. Verifique seu e-mail para aceitar o convite.';
const MENSAGEM_INATIVO = 'Usuário inativo';
const MENSAGEM_EMAIL_DESCONHECIDO = 'E-mail não cadastrado';
const MENSAGEM_OTP_AUSENTE = 'Código OTP não solicitado ou expirado';
const MENSAGEM_OTP_EXPIRADO = 'Código OTP expirado. Solicite um novo código.';
const MENSAGEM_OTP_INVALIDO = 'Código OTP inválido';
const MENSAGEM_OTP_BLOQUEADO = 'Muitas tentativas. Solicite um novo código.';
const MENSAGEM_CONTA_INATIVA = 'Usuário inativo ou não confirmado';
const MENSAGEM_SESSAO = 'Sessão de consentimento inválida';
const MENSAGEM_PEDIDO = 'Pedido OAuth inválido';
const MENSAGEM_SCOPE = 'Scope inválido';
const MENSAGEM_CLIENTE = 'Cliente ou redirect_uri inválido';
const MENSAGEM_REDIRECT = 'Redirecionamento recusado';

const ROTULOS_ESPERADOS: Record<string, string> = {
  'chekai:contexto': 'Ver sua identificação',
  'chekai:clientes:ler': 'Ver clientes e unidades',
  'chekai:checklists:ler': 'Ver checklists',
  'chekai:auditorias:ler': 'Ver auditorias',
  'chekai:auditorias:escrever': 'Responder auditorias',
  'chekai:auditorias:finalizar': 'Finalizar auditorias',
  'chekai:agenda:ler': 'Ver a agenda',
  'chekai:agenda:concluir': 'Concluir agendamentos',
  'chekai:tarefas:ler': 'Ver tarefas',
  'chekai:tarefas:escrever': 'Criar e atualizar tarefas',
  'chekai:relatorios:ler': 'Ver relatórios',
  'chekai:relatorios:escrever': 'Escrever relatórios',
  'chekai:relatorios:finalizar': 'Finalizar relatórios',
};

function paramsBase(sobre: Record<string, string> = {}): Record<string, string> {
  return {
    response_type: 'code',
    client_id: 'https://cliente.example/oauth/client.json',
    redirect_uri: 'https://cliente.example/callback',
    code_challenge: DESAFIO,
    code_challenge_method: 'S256',
    resource: 'https://api.chekai.com.br/mcp',
    scope: 'chekai:contexto chekai:clientes:ler',
    state: 'estado-opaco',
    ...sobre,
  };
}

function queryDe(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

function exigirParametros(search: string | URLSearchParams | Record<string, string | string[] | undefined>): ParametrosOAuth {
  const actual = lerParametrosOAuth(search);
  expect(actual.ok).toBe(true);
  if (!actual.ok) throw new Error(actual.mensagem);
  return actual.parametros;
}

function redirectDaApi(redirectUri: string, code: string, state: string): string {
  const url = new URL(redirectUri);
  url.searchParams.set('code', code);
  url.searchParams.set('state', state);
  return url.toString();
}

describe('UC-01: Validar e preservar os parâmetros OAuth', () => {
  it('lê os oito parâmetros snake_case da query da tela', () => {
    const inputSearch = queryDe(paramsBase());

    const actual = lerParametrosOAuth(inputSearch);

    expect(actual).toEqual({
      ok: true,
      parametros: {
        responseType: 'code',
        clientId: 'https://cliente.example/oauth/client.json',
        redirectUri: 'https://cliente.example/callback',
        codeChallenge: DESAFIO,
        codeChallengeMethod: 'S256',
        resource: 'https://api.chekai.com.br/mcp',
        scope: 'chekai:contexto chekai:clientes:ler',
        state: 'estado-opaco',
      },
    });
  });

  it('aceita URLSearchParams e o registro de searchParams do Next', () => {
    const inputRecord = paramsBase();

    expect(lerParametrosOAuth(new URLSearchParams(inputRecord)).ok).toBe(true);
    expect(lerParametrosOAuth(inputRecord).ok).toBe(true);
  });

  it('preserva state, PKCE, resource e redirect_uri com barra final e query própria', () => {
    const inputState = 'a b&c=1';
    const inputRedirect = 'https://cliente.example/callback/?foo=1';
    const inputResource = 'https://api.chekai.com.br/mcp/';
    const inputSearch = queryDe(paramsBase({
      state: inputState,
      redirect_uri: inputRedirect,
      resource: inputResource,
    }));

    const actual = exigirParametros(inputSearch);
    const actualQuery = serializarParametrosOAuth(actual);
    const actualDeVolta = exigirParametros(actualQuery);

    expect(actual.state).toBe(inputState);
    expect(actual.codeChallenge).toBe(DESAFIO);
    expect(actual.codeChallengeMethod).toBe('S256');
    expect(actual.redirectUri).toBe(inputRedirect);
    expect(actual.resource).toBe(inputResource);
    expect(actualDeVolta).toEqual(actual);
    expect(actualQuery).not.toContain('code_verifier');
    expect(actualQuery).not.toContain('sessao');
  });

  it('serializa de volta em snake_case, sem camelCase', () => {
    const input = exigirParametros(queryDe(paramsBase()));

    const actual = new URLSearchParams(serializarParametrosOAuth(input));

    expect([...actual.keys()].sort()).toEqual([
      'client_id',
      'code_challenge',
      'code_challenge_method',
      'redirect_uri',
      'resource',
      'response_type',
      'scope',
      'state',
    ]);
    expect(actual.get('code_challenge')).toBe(DESAFIO);
    expect(actual.get('state')).toBe('estado-opaco');
  });

  it.each([
    ['response_type', 'token'],
    ['code_challenge_method', 'plain'],
    ['code_challenge', 'curto'],
    ['code_challenge', `${DESAFIO}=`],
    ['redirect_uri', 'javascript:alert(1)'],
    ['redirect_uri', 'data:text/html,oi'],
    ['redirect_uri', '//evil.example/callback'],
    ['redirect_uri', 'https://user:pass@cliente.example/callback'],
    ['resource', 'mcp'],
    ['resource', 'javascript:alert(1)'],
    ['state', ''],
    ['scope', ''],
    ['client_id', ''],
  ])('recusa %s=%s como pedido OAuth inválido', (chave, valor) => {
    const input = paramsBase({ [chave]: valor });

    const actual = lerParametrosOAuth(input);

    expect(actual).toEqual({ ok: false, mensagem: MENSAGEM_PEDIDO });
  });

  it('recusa parâmetro obrigatório ausente e valor repetido ambíguo', () => {
    const semState = paramsBase();
    delete semState.state;
    const inputAmbiguo = {
      ...paramsBase(),
      redirect_uri: ['https://cliente.example/callback', 'https://evil.example/callback'],
    };

    expect(lerParametrosOAuth(semState)).toEqual({ ok: false, mensagem: MENSAGEM_PEDIDO });
    expect(lerParametrosOAuth(inputAmbiguo)).toEqual({ ok: false, mensagem: MENSAGEM_PEDIDO });
  });

  it('não troca resource por um endpoint fixo: a audiência é revalidada na API', () => {
    const inputResource = 'https://outro.example/mcp';

    const actual = exigirParametros(queryDe(paramsBase({ resource: inputResource })));

    expect(actual.resource).toBe(inputResource);
  });

  it('aponta OTP e consentimento para fora do prefixo /api e sem Authorization', () => {
    expect(duracaoOtpMs).toBe(10 * 60 * 1000);
    expect(rotasOauthDaTela).toEqual({
      solicitarOtp: '/oauth/otp/solicitar',
      validarOtp: '/oauth/otp/validar',
      consentir: '/oauth/authorize',
    });
    expect(urlOauth('http://localhost:3001/api', rotasOauthDaTela.solicitarOtp))
      .toBe('http://localhost:3001/oauth/otp/solicitar');
    expect(urlOauth('https://api.chekai.com.br/api/', rotasOauthDaTela.consentir))
      .toBe('https://api.chekai.com.br/oauth/authorize');
    expect(cabecalhosOauth()).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
    expect(cabecalhosOauth()).not.toHaveProperty('Authorization');
  });
});

describe('UC-01: Etapas e-mail, OTP e consentimento', () => {
  const parametros = () => exigirParametros(queryDe(paramsBase()));

  it('começa no e-mail, sem sessão e sem mensagem', () => {
    const input = parametros();

    const actual = estadoInicial(input);

    expect(actual).toEqual({
      etapa: 'email',
      email: '',
      sessaoConsentimento: null,
      parametros: input,
      mensagem: null,
    });
  });

  it('avança para o OTP depois do envio e conserva os parâmetros', () => {
    const inputEstado = estadoInicial(parametros());
    const inputPedido = prepararSolicitarOtp('  ana@exemplo.com ');

    expect(inputPedido).toEqual({ ok: true, corpo: { email: 'ana@exemplo.com' } });
    const actual = aposOtpSolicitado(inputEstado, 'ana@exemplo.com');

    expect(actual.etapa).toBe('otp');
    expect(actual.email).toBe('ana@exemplo.com');
    expect(actual.sessaoConsentimento).toBeNull();
    expect(actual.parametros).toEqual(inputEstado.parametros);
    expect(serializarParametrosOAuth(actual.parametros)).not.toContain('ana%40');
  });

  it('avança para o consentimento só com sessão opaca devolvida pela API', () => {
    const inputOtp = aposOtpSolicitado(estadoInicial(parametros()), 'ana@exemplo.com');
    const inputCodigo = prepararValidarOtp('ana@exemplo.com', '123456');

    expect(inputCodigo).toEqual({
      ok: true,
      corpo: { email: 'ana@exemplo.com', codigo: '123456' },
    });
    const actual = aposOtpValidado(inputOtp, SESSAO);

    expect(actual.etapa).toBe('consentimento');
    expect(actual.sessaoConsentimento).toBe(SESSAO);
    expect(actual.parametros).toEqual(inputOtp.parametros);
    expect(serializarParametrosOAuth(actual.parametros)).not.toContain(SESSAO);
  });

  it('não pula do e-mail para o consentimento nem aceita sessão vazia', () => {
    const inputEmail = estadoInicial(parametros());

    expect(() => aposOtpValidado(inputEmail, SESSAO)).toThrow(MENSAGEM_PEDIDO);
    expect(() => aposOtpValidado(
      aposOtpSolicitado(inputEmail, 'ana@exemplo.com'),
      '   ',
    )).toThrow(MENSAGEM_SESSAO);
  });

  it('voltar ao e-mail apaga a sessão e mantém PKCE, state e redirect_uri', () => {
    const input = aposOtpValidado(
      aposOtpSolicitado(estadoInicial(parametros()), 'ana@exemplo.com'),
      SESSAO,
    );

    const actual = voltarParaEmail(input);

    expect(actual.etapa).toBe('email');
    expect(actual.sessaoConsentimento).toBeNull();
    expect(actual.parametros).toEqual(input.parametros);
  });

  it('recusa e-mail inválido e código que não tem 6 dígitos', () => {
    expect(prepararSolicitarOtp('ana')).toEqual({ ok: false, mensagem: 'E-mail inválido' });
    expect(prepararSolicitarOtp('')).toEqual({ ok: false, mensagem: 'E-mail inválido' });
    expect(prepararValidarOtp('ana@exemplo.com', '12345')).toEqual({
      ok: false,
      mensagem: 'O código deve ter 6 dígitos',
    });
    expect(prepararValidarOtp('ana@exemplo.com', '12345a')).toEqual({
      ok: false,
      mensagem: 'O código deve ter 6 dígitos',
    });
    expect(prepararValidarOtp('ana@exemplo.com', ' 123456')).toEqual({
      ok: false,
      mensagem: 'O código deve ter 6 dígitos',
    });
  });

  it('monta o consentimento com a query original e a sessão, sem e-mail nem verifier', () => {
    const input = aposOtpValidado(
      aposOtpSolicitado(estadoInicial(parametros()), 'ana@exemplo.com'),
      SESSAO,
    );

    const actual = corpoConsentir(input);

    expect(actual).toEqual({
      response_type: 'code',
      client_id: 'https://cliente.example/oauth/client.json',
      redirect_uri: 'https://cliente.example/callback',
      code_challenge: DESAFIO,
      code_challenge_method: 'S256',
      resource: 'https://api.chekai.com.br/mcp',
      scope: 'chekai:contexto chekai:clientes:ler',
      state: 'estado-opaco',
      sessao_consentimento: SESSAO,
    });
    expect(actual).not.toHaveProperty('email');
    expect(actual).not.toHaveProperty('codigo');
    expect(actual).not.toHaveProperty('code_verifier');
  });

  it('não monta consentimento fora dessa etapa', () => {
    expect(() => corpoConsentir(estadoInicial(parametros()))).toThrow(MENSAGEM_SESSAO);
  });
});

describe('UC-01: Scopes operacionais legíveis', () => {
  it('mostra os 13 scopes da primeira onda em português, na ordem pedida', () => {
    const inputScope = scopesOperacionais.join(' ');

    const actual = scopesParaConsentimento(inputScope);

    expect(scopesOperacionais).toEqual(Object.keys(ROTULOS_ESPERADOS));
    expect(rotulosScopes).toEqual(ROTULOS_ESPERADOS);
    expect(actual).toEqual({
      ok: true,
      itens: scopesOperacionais.map((id) => ({ id, rotulo: ROTULOS_ESPERADOS[id] })),
    });
  });

  it('lista somente os scopes solicitados, sem repetir o identificador cru', () => {
    const actual = scopesParaConsentimento('chekai:relatorios:finalizar chekai:contexto');

    expect(actual).toEqual({
      ok: true,
      itens: [
        { id: 'chekai:relatorios:finalizar', rotulo: 'Finalizar relatórios' },
        { id: 'chekai:contexto', rotulo: 'Ver sua identificação' },
      ],
    });
    if (actual.ok) {
      for (const item of actual.itens) {
        expect(item.rotulo.toLowerCase()).not.toContain(item.id);
        expect(item.rotulo).not.toMatch(/scope|token|api|jwt/i);
      }
    }
  });

  it('recusa o pedido inteiro quando há scope desconhecido e não lista o restante', () => {
    const actual = scopesParaConsentimento('chekai:contexto chekai:equipe chekai:clientes:ler');
    const actualParametros = lerParametrosOAuth(paramsBase({
      scope: 'chekai:contexto chekai:admin',
    }));

    expect(actual).toEqual({ ok: false, mensagem: MENSAGEM_SCOPE });
    expect(actualParametros).toEqual({ ok: false, mensagem: MENSAGEM_SCOPE });
  });

  it('recusa scope vazio, token em branco e duplicado', () => {
    expect(scopesParaConsentimento('')).toEqual({ ok: false, mensagem: MENSAGEM_SCOPE });
    expect(scopesParaConsentimento('chekai:contexto  chekai:clientes:ler')).toEqual({
      ok: false,
      mensagem: MENSAGEM_SCOPE,
    });
    expect(scopesParaConsentimento('chekai:contexto chekai:contexto')).toEqual({
      ok: false,
      mensagem: MENSAGEM_SCOPE,
    });
  });
});

describe('UC-01: Erros de conta, OTP e consentimento', () => {
  it('mantém o e-mail nas recusas de convite pendente, inativo e e-mail desconhecido', () => {
    expect(interpretarErroSolicitarOtp({ status: 403, message: MENSAGEM_CONVITE })).toEqual({
      etapa: 'email',
      mensagem: MENSAGEM_CONVITE,
    });
    expect(interpretarErroSolicitarOtp({ status: 403, message: MENSAGEM_INATIVO })).toEqual({
      etapa: 'email',
      mensagem: MENSAGEM_INATIVO,
    });
    expect(interpretarErroSolicitarOtp({ status: 401, message: MENSAGEM_EMAIL_DESCONHECIDO })).toEqual({
      etapa: 'email',
      mensagem: MENSAGEM_EMAIL_DESCONHECIDO,
    });
  });

  it('não cria sessão quando o OTP é inválido, expirado ou a conta deixou de estar ativa', () => {
    const esperado = [
      { status: 401, message: MENSAGEM_OTP_INVALIDO },
      { status: 401, message: MENSAGEM_OTP_BLOQUEADO },
      { status: 400, message: MENSAGEM_OTP_AUSENTE },
      { status: 400, message: MENSAGEM_OTP_EXPIRADO },
      { status: 401, message: MENSAGEM_CONTA_INATIVA },
    ];

    for (const input of esperado) {
      expect(interpretarErroValidarOtp(input)).toEqual({
        etapa: 'otp',
        mensagem: input.message,
        sessaoConsentimento: null,
      });
    }
  });

  it('não trata mensagem desconhecida nem HTML como sucesso', () => {
    expect(interpretarErroSolicitarOtp({ status: 500, message: '<script>alert(1)</script>' })).toEqual({
      etapa: 'email',
      mensagem: 'Não foi possível enviar o código.',
    });
    expect(interpretarErroValidarOtp({ status: 500, message: '' })).toEqual({
      etapa: 'otp',
      mensagem: 'Não foi possível validar o código.',
      sessaoConsentimento: null,
    });
  });

  it('erro no consentimento não libera navegação', () => {
    const esperado = [MENSAGEM_PEDIDO, MENSAGEM_SCOPE, MENSAGEM_CLIENTE, MENSAGEM_SESSAO, MENSAGEM_CONTA_INATIVA];

    for (const message of esperado) {
      expect(interpretarErroConsentimento({ status: 400, message })).toEqual({
        navegar: false,
        mensagem: message,
      });
    }
    expect(interpretarErroConsentimento({
      status: 401,
      message: 'https://evil.example/callback?code=roubado',
    })).toEqual({
      navegar: false,
      mensagem: 'Não foi possível concluir a autorização.',
    });
  });
});

describe('UC-01: Redirect final seguro', () => {
  const parametros = () => exigirParametros(queryDe(paramsBase()));

  it('aceita o redirect da API quando code e state estão na redirect_uri original', () => {
    const inputParametros = parametros();
    const inputUrl = redirectDaApi(inputParametros.redirectUri, CODE, inputParametros.state);

    const actual = redirectFinalSeguro(inputUrl, inputParametros);

    expect(actual).toEqual({ ok: true, url: inputUrl });
    const actualUrl = new URL(actual.ok ? actual.url : 'https://invalido.example');
    expect(actualUrl.searchParams.get('code')).toBe(CODE);
    expect(actualUrl.searchParams.get('state')).toBe('estado-opaco');
    expect(actualUrl.searchParams.has('code_challenge')).toBe(false);
    expect(actualUrl.searchParams.has('sessao_consentimento')).toBe(false);
  });

  it('preserva a query que já existia na redirect_uri e a barra final', () => {
    const inputRedirect = 'https://cliente.example/callback/?foo=1';
    const inputParametros = exigirParametros(queryDe(paramsBase({ redirect_uri: inputRedirect })));
    const inputUrl = redirectDaApi(inputRedirect, CODE, inputParametros.state);

    const actual = redirectFinalSeguro(inputUrl, inputParametros);

    expect(actual.ok).toBe(true);
    if (actual.ok) {
      const actualUrl = new URL(actual.url);
      expect(actualUrl.pathname).toBe('/callback/');
      expect(actualUrl.searchParams.get('foo')).toBe('1');
      expect(actualUrl.searchParams.get('code')).toBe(CODE);
      expect(actualUrl.searchParams.get('state')).toBe(inputParametros.state);
    }
  });

  it.each([
    ['host diferente', (redirectUri: string, state: string) => redirectDaApi('https://evil.example/callback', CODE, state)],
    ['subdomínio parecido', (redirectUri: string, state: string) => redirectDaApi('https://cliente.example.evil.example/callback', CODE, state)],
    ['caminho diferente', (redirectUri: string, state: string) => redirectDaApi('https://cliente.example/callback/extra', CODE, state)],
    ['barra final a menos', (redirectUri: string, state: string) => redirectDaApi('https://cliente.example/callback', CODE, state)],
    ['esquema diferente', (redirectUri: string, state: string) => redirectDaApi('http://cliente.example/callback/', CODE, state)],
    ['state trocado', (redirectUri: string) => redirectDaApi(redirectUri, CODE, 'outro-state')],
    ['sem code', (redirectUri: string, state: string) => redirectDaApi(redirectUri, '', state)],
    ['javascript', () => 'javascript:alert(1)'],
    ['fragmento', (redirectUri: string, state: string) => `${redirectDaApi(redirectUri, CODE, state)}#acesso`],
  ])('recusa redirect com %s', (_nome, montar) => {
    const inputParametros = exigirParametros(queryDe(paramsBase({
      redirect_uri: 'https://cliente.example/callback/',
    })));
    const inputUrl = montar(inputParametros.redirectUri, inputParametros.state);

    expect(redirectFinalSeguro(inputUrl, inputParametros)).toEqual({
      ok: false,
      mensagem: MENSAGEM_REDIRECT,
    });
  });

  it('recusa parâmetro extra e userinfo no redirect final', () => {
    const inputParametros = parametros();
    const comExtra = new URL(redirectDaApi(inputParametros.redirectUri, CODE, inputParametros.state));
    comExtra.searchParams.set('access_token', 'jwt-web');
    const comUserinfo = redirectDaApi(
      'https://user:pass@cliente.example/callback',
      CODE,
      inputParametros.state,
    );

    expect(redirectFinalSeguro(comExtra.toString(), inputParametros)).toEqual({
      ok: false,
      mensagem: MENSAGEM_REDIRECT,
    });
    expect(redirectFinalSeguro(comUserinfo, inputParametros)).toEqual({
      ok: false,
      mensagem: MENSAGEM_REDIRECT,
    });
  });

  it('recusa autorização devolvendo error=access_denied e o state original, sem code', () => {
    const inputParametros = exigirParametros(queryDe(paramsBase({
      redirect_uri: 'https://cliente.example/callback/?foo=1',
      state: 'estado opaco',
    })));

    const actual = redirectRecusaSeguro(inputParametros);

    expect(actual.ok).toBe(true);
    if (actual.ok) {
      const actualUrl = new URL(actual.url);
      expect(actualUrl.origin).toBe('https://cliente.example');
      expect(actualUrl.pathname).toBe('/callback/');
      expect(actualUrl.searchParams.get('foo')).toBe('1');
      expect(actualUrl.searchParams.get('error')).toBe('access_denied');
      expect(actualUrl.searchParams.get('state')).toBe('estado opaco');
      expect(actualUrl.searchParams.has('code')).toBe(false);
      expect(actualUrl.hash).toBe('');
    }
  });

  it('não monta recusa se a redirect_uri deixar de ser http(s) absoluta', () => {
    const inputParametros: ParametrosOAuth = {
      ...exigirParametros(queryDe(paramsBase())),
      redirectUri: 'javascript:alert(1)',
    };

    expect(redirectRecusaSeguro(inputParametros)).toEqual({
      ok: false,
      mensagem: MENSAGEM_REDIRECT,
    });
  });
});

describe('UC-01 FA-08: O mock de desenvolvimento não cria sessão na tela', () => {
  it('envia 252622 como qualquer código de 6 dígitos, sem sessão local', () => {
    const actual = prepararValidarOtp('ana@exemplo.com', '252622');

    expect(actual).toEqual({
      ok: true,
      corpo: { email: 'ana@exemplo.com', codigo: '252622' },
    });
    expect(actual).not.toHaveProperty('sessaoConsentimento');
  });
});

/**
 * Regras puras da tela `/oauth/autorizar`.
 * Parâmetros e sessão de consentimento ficam na memória da página; este módulo
 * não lê armazenamento local nem anexa o JWT do web.
 */

export const DURACAO_OTP_MS = 10 * 60 * 1000;

export const ROTAS_OAUTH_DA_TELA = {
  solicitarOtp: '/oauth/otp/solicitar',
  validarOtp: '/oauth/otp/validar',
  consentir: '/oauth/authorize',
} as const;

export const ROTULOS_SCOPES: Record<string, string> = {
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

export const SCOPES_OPERACIONAIS: readonly string[] = [
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
];

const MENSAGEM_PEDIDO = 'Pedido OAuth inválido';
const MENSAGEM_SCOPE = 'Scope inválido';
const MENSAGEM_SESSAO = 'Sessão de consentimento inválida';
const MENSAGEM_REDIRECT = 'Redirecionamento recusado';

const MENSAGENS_SOLICITAR_OTP = new Set([
  'Convite pendente. Verifique seu e-mail para aceitar o convite.',
  'Usuário inativo',
  'E-mail não cadastrado',
]);

const MENSAGENS_VALIDAR_OTP = new Set([
  'Código OTP inválido',
  'Código OTP não solicitado ou expirado',
  'Código OTP expirado. Solicite um novo código.',
  'Usuário inativo ou não confirmado',
]);

const MENSAGENS_CONSENTIMENTO = new Set([
  'Pedido OAuth inválido',
  'Scope inválido',
  'Cliente ou redirect_uri inválido',
  'Sessão de consentimento inválida',
  'Usuário inativo ou não confirmado',
]);

const CHAVES_OAUTH = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'resource',
  'scope',
  'state',
] as const;

const DESAFIO_PKCE = /^[A-Za-z0-9_-]{43}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODIGO_OTP = /^\d{6}$/;

export interface ParametrosOAuth {
  responseType: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  scope: string;
  state: string;
}

export interface EstadoFluxo {
  etapa: 'email' | 'otp' | 'consentimento';
  email: string;
  sessaoConsentimento: string | null;
  parametros: ParametrosOAuth;
  mensagem: string | null;
}

type EntradaParametros = string | URLSearchParams | Record<string, string | string[] | undefined>;

export function urlOauth(origemApi: string, rota: string): string {
  const base = origemApi.replace(/\/+$/, '').replace(/\/api$/, '');
  const caminho = rota.startsWith('/') ? rota : `/${rota}`;
  return `${base}${caminho}`;
}

export function cabecalhosOauth(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

export function lerParametrosOAuth(
  search: EntradaParametros,
): { ok: true; parametros: ParametrosOAuth } | { ok: false; mensagem: string } {
  const mapa = mapaDeParametros(search);
  if (!mapa) return { ok: false, mensagem: MENSAGEM_PEDIDO };

  const valores: Record<string, string> = {};
  for (const chave of CHAVES_OAUTH) {
    const lista = mapa.get(chave);
    if (!lista || lista.length !== 1 || lista[0] === '') {
      return { ok: false, mensagem: MENSAGEM_PEDIDO };
    }
    valores[chave] = lista[0];
  }

  if (valores.response_type !== 'code') return { ok: false, mensagem: MENSAGEM_PEDIDO };
  if (valores.code_challenge_method !== 'S256') return { ok: false, mensagem: MENSAGEM_PEDIDO };
  if (!DESAFIO_PKCE.test(valores.code_challenge)) return { ok: false, mensagem: MENSAGEM_PEDIDO };
  if (!urlHttpAbsoluta(valores.redirect_uri)) return { ok: false, mensagem: MENSAGEM_PEDIDO };
  if (!urlHttpAbsoluta(valores.resource)) return { ok: false, mensagem: MENSAGEM_PEDIDO };

  const scopes = scopesParaConsentimento(valores.scope);
  if (!scopes.ok) return scopes;

  return {
    ok: true,
    parametros: {
      responseType: valores.response_type,
      clientId: valores.client_id,
      redirectUri: valores.redirect_uri,
      codeChallenge: valores.code_challenge,
      codeChallengeMethod: valores.code_challenge_method,
      resource: valores.resource,
      scope: valores.scope,
      state: valores.state,
    },
  };
}

export function serializarParametrosOAuth(parametros: ParametrosOAuth): string {
  const params = new URLSearchParams();
  params.set('response_type', parametros.responseType);
  params.set('client_id', parametros.clientId);
  params.set('redirect_uri', parametros.redirectUri);
  params.set('code_challenge', parametros.codeChallenge);
  params.set('code_challenge_method', parametros.codeChallengeMethod);
  params.set('resource', parametros.resource);
  params.set('scope', parametros.scope);
  params.set('state', parametros.state);
  return params.toString();
}

export function estadoInicial(parametros: ParametrosOAuth): EstadoFluxo {
  return {
    etapa: 'email',
    email: '',
    sessaoConsentimento: null,
    parametros: { ...parametros },
    mensagem: null,
  };
}

export function prepararSolicitarOtp(
  email: string,
): { ok: true; corpo: { email: string } } | { ok: false; mensagem: string } {
  const normalizado = email.trim();
  if (!EMAIL.test(normalizado)) return { ok: false, mensagem: 'E-mail inválido' };
  return { ok: true, corpo: { email: normalizado } };
}

export function aposOtpSolicitado(estado: EstadoFluxo, email: string): EstadoFluxo {
  return {
    ...estado,
    etapa: 'otp',
    email,
    sessaoConsentimento: null,
    parametros: { ...estado.parametros },
    mensagem: null,
  };
}

export function prepararValidarOtp(
  email: string,
  codigo: string,
): { ok: true; corpo: { email: string; codigo: string } } | { ok: false; mensagem: string } {
  if (!CODIGO_OTP.test(codigo)) {
    return { ok: false, mensagem: 'O código deve ter 6 dígitos' };
  }
  return { ok: true, corpo: { email: email.trim(), codigo } };
}

export function aposOtpValidado(estado: EstadoFluxo, sessaoConsentimento: string): EstadoFluxo {
  if (estado.etapa !== 'otp') throw new Error(MENSAGEM_PEDIDO);
  if (sessaoConsentimento.trim() === '') throw new Error(MENSAGEM_SESSAO);
  return {
    ...estado,
    etapa: 'consentimento',
    sessaoConsentimento,
    parametros: { ...estado.parametros },
    mensagem: null,
  };
}

export function voltarParaEmail(estado: EstadoFluxo): EstadoFluxo {
  return {
    ...estado,
    etapa: 'email',
    sessaoConsentimento: null,
    parametros: { ...estado.parametros },
    mensagem: null,
  };
}

export function corpoConsentir(estado: EstadoFluxo): Record<string, string> {
  if (estado.etapa !== 'consentimento' || !estado.sessaoConsentimento?.trim()) {
    throw new Error(MENSAGEM_SESSAO);
  }
  return {
    response_type: estado.parametros.responseType,
    client_id: estado.parametros.clientId,
    redirect_uri: estado.parametros.redirectUri,
    code_challenge: estado.parametros.codeChallenge,
    code_challenge_method: estado.parametros.codeChallengeMethod,
    resource: estado.parametros.resource,
    scope: estado.parametros.scope,
    state: estado.parametros.state,
    sessao_consentimento: estado.sessaoConsentimento,
  };
}

export function scopesParaConsentimento(
  scope: string,
): { ok: true; itens: Array<{ id: string; rotulo: string }> } | { ok: false; mensagem: string } {
  if (scope === '') return { ok: false, mensagem: MENSAGEM_SCOPE };
  const partes = scope.split(' ');
  const vistos = new Set<string>();
  const itens: Array<{ id: string; rotulo: string }> = [];
  for (const id of partes) {
    const rotulo = ROTULOS_SCOPES[id];
    if (!id || !rotulo || vistos.has(id)) return { ok: false, mensagem: MENSAGEM_SCOPE };
    vistos.add(id);
    itens.push({ id, rotulo });
  }
  return { ok: true, itens };
}

export function interpretarErroSolicitarOtp(
  erro: { status: number; message: string },
): { etapa: 'email'; mensagem: string } {
  return {
    etapa: 'email',
    mensagem: MENSAGENS_SOLICITAR_OTP.has(erro.message)
      ? erro.message
      : 'Não foi possível enviar o código.',
  };
}

export function interpretarErroValidarOtp(
  erro: { status: number; message: string },
): { etapa: 'otp'; mensagem: string; sessaoConsentimento: null } {
  return {
    etapa: 'otp',
    mensagem: MENSAGENS_VALIDAR_OTP.has(erro.message)
      ? erro.message
      : 'Não foi possível validar o código.',
    sessaoConsentimento: null,
  };
}

export function interpretarErroConsentimento(
  erro: { status: number; message: string },
): { navegar: false; mensagem: string } {
  return {
    navegar: false,
    mensagem: MENSAGENS_CONSENTIMENTO.has(erro.message)
      ? erro.message
      : 'Não foi possível concluir a autorização.',
  };
}

export function redirectFinalSeguro(
  redirectPara: string,
  parametros: ParametrosOAuth,
): { ok: true; url: string } | { ok: false; mensagem: string } {
  const destino = urlHttpAbsoluta(redirectPara);
  const origem = urlHttpAbsoluta(parametros.redirectUri);
  if (!destino || !origem || !mesmoAlvo(destino, origem)) {
    return { ok: false, mensagem: MENSAGEM_REDIRECT };
  }
  const codes = destino.searchParams.getAll('code');
  const states = destino.searchParams.getAll('state');
  if (codes.length !== 1 || codes[0] === '') return { ok: false, mensagem: MENSAGEM_REDIRECT };
  if (states.length !== 1 || states[0] !== parametros.state) {
    return { ok: false, mensagem: MENSAGEM_REDIRECT };
  }
  if (paresRestantes(destino) !== paresRestantes(origem)) {
    return { ok: false, mensagem: MENSAGEM_REDIRECT };
  }
  return { ok: true, url: redirectPara };
}

export function redirectRecusaSeguro(
  parametros: ParametrosOAuth,
): { ok: true; url: string } | { ok: false; mensagem: string } {
  const origem = urlHttpAbsoluta(parametros.redirectUri);
  if (!origem) return { ok: false, mensagem: MENSAGEM_REDIRECT };
  origem.searchParams.delete('code');
  origem.searchParams.set('error', 'access_denied');
  origem.searchParams.set('state', parametros.state);
  origem.hash = '';
  return { ok: true, url: origem.toString() };
}

function mapaDeParametros(search: EntradaParametros): Map<string, string[]> | null {
  const mapa = new Map<string, string[]>();
  const adicionar = (chave: string, valor: string) => {
    const atual = mapa.get(chave) ?? [];
    atual.push(valor);
    mapa.set(chave, atual);
  };

  if (typeof search === 'string' || search instanceof URLSearchParams) {
    const params = typeof search === 'string'
      ? new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
      : search;
    for (const [chave, valor] of params.entries()) adicionar(chave, valor);
    return mapa;
  }

  if (!search || typeof search !== 'object') return null;
  for (const [chave, valor] of Object.entries(search)) {
    if (typeof valor === 'string') {
      adicionar(chave, valor);
    } else if (Array.isArray(valor)) {
      for (const item of valor) {
        if (typeof item !== 'string') return null;
        adicionar(chave, item);
      }
    } else if (valor !== undefined) {
      return null;
    }
  }
  return mapa;
}

function urlHttpAbsoluta(valor: string): URL | null {
  try {
    const url = new URL(valor);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username !== '' || url.password !== '') return null;
    if (url.hash !== '') return null;
    return url;
  } catch {
    return null;
  }
}

function mesmoAlvo(destino: URL, origem: URL): boolean {
  return destino.protocol === origem.protocol
    && destino.hostname === origem.hostname
    && destino.port === origem.port
    && destino.pathname === origem.pathname
    && destino.username === ''
    && destino.password === ''
    && destino.hash === '';
}

function paresRestantes(url: URL): string {
  const pares: string[] = [];
  url.searchParams.forEach((valor, chave) => {
    if (chave === 'code' || chave === 'state') return;
    pares.push(`${chave}=${valor}`);
  });
  pares.sort();
  return pares.join('\n');
}

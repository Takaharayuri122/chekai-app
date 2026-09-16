import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

const IA_TIMEOUT_MS = 45000;

/**
 * Erro específico para bloqueio de IA por saldo de créditos insuficiente (RN-CRD-003).
 * Permite a UI diferenciar falta de créditos de falha de rede.
 */
export class CreditoInsuficienteError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = 'CreditoInsuficienteError';
  }
}

export interface GeracaoTextoIa {
  descricaoTecnica: string;
  referenciaLegal: string;
  riscoEnvolvido: string;
  planoAcao: {
    acoesCorretivas: string[];
    acoesPreventivas: string[];
    prazoSugerido: string;
    responsavelSugerido: string;
  };
}

export interface PlanoAcaoIa {
  acoesCorretivas: string[];
  acoesPreventivas: string[];
  prazoSugerido: string;
}

export interface AnaliseImagemChecklistIa {
  descricaoIa: string;
  tipoNaoConformidade: string;
  gravidade: string;
  sugestoes: string[];
  referenciaLegal: string;
  imagemRelevante: boolean;
}

export interface SugestaoNaoConformidade {
  descricao: string;
  planoAcao: string;
  referenciaLegal?: string;
}

const PADROES_ERRO_CREDITO = ['crédito', 'credito', 'assinatura ativa', 'limite de cr'];

/**
 * Indica se a mensagem de erro da API corresponde a bloqueio por saldo de créditos.
 */
export function isErroCredito(mensagem: string): boolean {
  const normalizada = mensagem.toLowerCase();
  return PADROES_ERRO_CREDITO.some((padrao) => normalizada.includes(padrao));
}

function extrairMensagemErro(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const mensagem = (payload as { message?: string | string[] }).message;
    if (Array.isArray(mensagem)) {
      return mensagem[0] ?? 'Erro inesperado na IA.';
    }
    if (typeof mensagem === 'string') {
      return mensagem;
    }
  }
  return 'Erro inesperado na IA.';
}

function tratarErro(status: number, corpo: string): never {
  let mensagem = 'Erro inesperado na IA.';
  try {
    mensagem = extrairMensagemErro(corpo ? JSON.parse(corpo) : {});
  } catch {
    mensagem = 'Erro inesperado na IA.';
  }
  if (status === 400 && isErroCredito(mensagem)) {
    throw new CreditoInsuficienteError(mensagem);
  }
  throw new Error(mensagem);
}

async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function postIaJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), IA_TIMEOUT_MS);
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const headers = await buildHeaders();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const text = await response.text();
    if (!response.ok) {
      tratarErro(response.status, text);
    }
    const json = text ? (JSON.parse(text) as { data?: T }) : {};
    if (json.data === undefined) {
      throw new Error('Resposta inválida do servidor.');
    }
    return json.data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof CreditoInsuficienteError) throw err;
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error('Tempo de conexão expirado.');
      }
      const msg = err.message;
      if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) {
        throw new Error('Sem conexão com o servidor.');
      }
      throw err;
    }
    throw new Error('Sem conexão com o servidor.');
  }
}

/**
 * Gera descrição técnica + plano de ação a partir de uma descrição simples de não conformidade.
 * Endpoint debita créditos via CreditoService (auditoria-tokens.mdc).
 */
export async function gerarTextoNaoConformidade(
  descricao: string,
  tipoEstabelecimento?: string,
): Promise<GeracaoTextoIa> {
  return postIaJson<GeracaoTextoIa>('/ia/gerar-texto', { descricao, tipoEstabelecimento });
}

/**
 * Gera plano de ação para uma não conformidade já descrita.
 * Endpoint debita créditos via CreditoService (auditoria-tokens.mdc).
 */
export async function gerarPlanoAcao(
  descricaoNaoConformidade: string,
  referenciaLegal?: string,
): Promise<PlanoAcaoIa> {
  return postIaJson<PlanoAcaoIa>('/ia/plano-acao', {
    descricaoNaoConformidade,
    referenciaLegal,
  });
}

/**
 * Analisa a imagem de uma foto no contexto de um item de checklist (multipart).
 * Endpoint debita créditos via CreditoService (auditoria-tokens.mdc).
 */
export async function analisarImagemChecklist(
  filePath: string,
  perguntaChecklist: string,
  categoria?: string,
  tipoEstabelecimento?: string,
): Promise<AnaliseImagemChecklistIa> {
  const token = await SecureStore.getItemAsync('auth_token');
  const parameters: Record<string, string> = { perguntaChecklist };
  if (categoria) parameters.categoria = categoria;
  if (tipoEstabelecimento) parameters.tipoEstabelecimento = tipoEstabelecimento;
  const result = await FileSystem.uploadAsync(`${API_URL}/ia/analisar-checklist`, filePath, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'imagem',
    parameters,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (result.status >= 400) {
    tratarErro(result.status, result.body);
  }
  const json = JSON.parse(result.body) as { data: AnaliseImagemChecklistIa };
  return json.data;
}

/**
 * Formata o plano de ação estruturado da IA em texto corrido para exibição/edição.
 */
export function formatarPlanoAcao(plano: GeracaoTextoIa['planoAcao'] | PlanoAcaoIa): string {
  const linhas: string[] = [];
  if (plano.acoesCorretivas?.length) {
    linhas.push('Ações corretivas:');
    plano.acoesCorretivas.forEach((acao) => linhas.push(`• ${acao}`));
  }
  if (plano.acoesPreventivas?.length) {
    if (linhas.length) linhas.push('');
    linhas.push('Ações preventivas:');
    plano.acoesPreventivas.forEach((acao) => linhas.push(`• ${acao}`));
  }
  if (plano.prazoSugerido) {
    if (linhas.length) linhas.push('');
    linhas.push(`Prazo sugerido: ${plano.prazoSugerido}`);
  }
  if ('responsavelSugerido' in plano && plano.responsavelSugerido) {
    linhas.push(`Responsável sugerido: ${plano.responsavelSugerido}`);
  }
  return linhas.join('\n');
}

/**
 * Gera sugestão de não conformidade (descrição técnica + plano de ação) a partir
 * do enunciado do item de checklist, usando o endpoint real de geração de texto.
 */
export async function getSugestaoIa(
  contexto: string,
  tipoEstabelecimento?: string,
): Promise<SugestaoNaoConformidade> {
  const resultado = await gerarTextoNaoConformidade(contexto, tipoEstabelecimento);
  return {
    descricao: resultado.descricaoTecnica,
    planoAcao: formatarPlanoAcao(resultado.planoAcao),
    referenciaLegal: resultado.referenciaLegal,
  };
}

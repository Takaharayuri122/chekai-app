import { apiGet, apiPost, apiPut } from './client';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

export interface CreateAuditoriaPayload {
  localId: string;
  clienteId: string;
  unidadeId: string;
  templateId: string;
  dataInicio: string;
  latitudeInicio?: number;
  longitudeInicio?: number;
}

export interface ItemPayload {
  localId: string;
  templateItemId: string;
  resposta: string;
  observacao?: string;
  descricaoNaoConformidade?: string;
  descricaoIa?: string;
  complementoDescricao?: string;
  planoAcaoFinal?: string;
  referenciaLegal?: string;
  pontuacao: number;
}

export interface FinalizarPayload {
  latitude?: number;
  longitude?: number;
  observacoesGerais?: string;
}

export interface AuditoriaApi {
  id: string;
  status: string;
  pontuacaoTotal: number | string | null;
  pdfUrl: string | null;
}

export async function createAuditoria(
  payload: CreateAuditoriaPayload,
): Promise<{ id: string; itens: Array<{ id: string; templateItemId: string }> }> {
  const body: {
    unidadeId: string;
    templateId: string;
    latitude?: number;
    longitude?: number;
  } = { unidadeId: payload.unidadeId, templateId: payload.templateId };
  if (payload.latitudeInicio != null) body.latitude = payload.latitudeInicio;
  if (payload.longitudeInicio != null) body.longitude = payload.longitudeInicio;
  return apiPost<{ id: string; itens: Array<{ id: string; templateItemId: string }> }>(
    '/auditorias',
    body,
  );
}

export async function submitItem(
  auditoriaRemoteId: string,
  itemRemoteId: string,
  item: ItemPayload,
): Promise<void> {
  return apiPut<void>(`/auditorias/${auditoriaRemoteId}/itens/${itemRemoteId}`, {
    resposta: item.resposta,
    observacao: item.observacao,
    descricaoNaoConformidade: item.descricaoNaoConformidade,
    descricaoIa: item.descricaoIa,
    complementoDescricao: item.complementoDescricao,
    planoAcaoSugerido: item.planoAcaoFinal,
    referenciaLegal: item.referenciaLegal,
  });
}

export async function uploadFoto(
  auditoriaRemoteId: string,
  itemRemoteId: string,
  filePath: string
): Promise<{ id: string; url: string }> {
  const token = await SecureStore.getItemAsync('auth_token');
  const result = await FileSystem.uploadAsync(
    `${API_URL}/auditorias/${auditoriaRemoteId}/itens/${itemRemoteId}/fotos`,
    filePath,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  if (result.status >= 400) {
    throw new Error('Falha no upload da foto.');
  }
  const json = JSON.parse(result.body) as { data: { id: string; url: string } };
  return json.data;
}

/**
 * Persiste no servidor a análise de IA de uma foto já enviada.
 */
export async function salvarAnaliseFoto(
  auditoriaRemoteId: string,
  itemRemoteId: string,
  fotoRemoteId: string,
  analiseIa: string,
): Promise<void> {
  return apiPut<void>(
    `/auditorias/${auditoriaRemoteId}/itens/${itemRemoteId}/fotos/${fotoRemoteId}/analise`,
    { analiseIa },
  );
}

export async function finalizarAuditoria(
  auditoriaRemoteId: string,
  payload: FinalizarPayload
): Promise<AuditoriaApi> {
  return apiPut<AuditoriaApi>(`/auditorias/${auditoriaRemoteId}/finalizar`, payload);
}

/**
 * Busca a auditoria oficial no servidor (usado para obter a pontuação calculada pela API).
 */
export async function getAuditoria(auditoriaRemoteId: string): Promise<AuditoriaApi> {
  return apiGet<AuditoriaApi>(`/auditorias/${auditoriaRemoteId}`);
}

export interface AuditoriaDetalheFoto {
  id: string;
  url: string;
  analiseIa?: string | null;
  tamanhoBytes?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface AuditoriaDetalheOpcaoConfig {
  valor: string;
  fotoObrigatoria: boolean;
  observacaoObrigatoria: boolean;
  pontuacao?: number | null;
}

export interface AuditoriaDetalheTemplateItem {
  id: string;
  pergunta: string;
  ordem: number;
  peso: number;
  legislacaoReferencia?: string | null;
  categoria?: string | null;
  criticidade?: string | null;
  opcoesRespostaConfig?: AuditoriaDetalheOpcaoConfig[];
  usarRespostasPersonalizadas?: boolean;
  tipoRespostaCustomizada?: string | null;
}

export interface AuditoriaDetalheItem {
  id: string;
  templateItemId: string;
  resposta?: string;
  observacao?: string | null;
  descricaoNaoConformidade?: string | null;
  descricaoIa?: string | null;
  complementoDescricao?: string | null;
  planoAcaoSugerido?: string | null;
  planoAcaoFinal?: string | null;
  referenciaLegal?: string | null;
  pontuacao?: number | null;
  templateItem?: AuditoriaDetalheTemplateItem;
  fotos?: AuditoriaDetalheFoto[];
}

export interface AuditoriaDetalheTemplate {
  id: string;
  nome?: string;
  descricao?: string | null;
  tipoAtividade?: string | null;
  versao?: string | null;
  status?: string | null;
}

export interface AuditoriaDetalhe {
  id: string;
  status: string;
  templateId?: string;
  template?: AuditoriaDetalheTemplate;
  itens?: AuditoriaDetalheItem[];
}

/**
 * Busca o detalhe completo da auditoria (`GET /auditorias/:id`), incluindo as relations
 * `template`, `itens.templateItem` e `itens.fotos` — usado para hidratar localmente o
 * checklist (perguntas/respostas) e as fotos remotas no SQLite.
 */
export async function getAuditoriaDetalhe(auditoriaRemoteId: string): Promise<AuditoriaDetalhe> {
  return apiGet<AuditoriaDetalhe>(`/auditorias/${auditoriaRemoteId}`);
}

export type RiscoGeral = 'baixo' | 'medio' | 'alto' | 'critico';

export interface ResumoExecutivo {
  resumo: string;
  pontosFortes: string[];
  pontosFracos: string[];
  recomendacoesPrioritarias: string[];
  riscoGeral: RiscoGeral;
  tendencias: string[];
}

/**
 * Gera (via IA) e persiste no servidor o resumo executivo de uma auditoria finalizada.
 * O débito de créditos é feito no servidor (auditoria de tokens). Online-only.
 */
export async function getResumoExecutivo(auditoriaRemoteId: string): Promise<ResumoExecutivo> {
  return apiGet<ResumoExecutivo>(`/auditorias/${auditoriaRemoteId}/resumo-executivo`);
}

export interface HistoricoUnidadeItem {
  id: string;
  dataInicio?: string | null;
  dataFim?: string | null;
  pontuacaoTotal: number | string | null;
  template?: { nome?: string } | null;
}

/**
 * Lista o histórico de auditorias finalizadas de uma unidade (máx. 30, ordenadas por data).
 */
export async function getHistoricoUnidade(unidadeRemoteId: string): Promise<HistoricoUnidadeItem[]> {
  return apiGet<HistoricoUnidadeItem[]>(`/auditorias/historico-unidade/${unidadeRemoteId}`);
}

/**
 * Reabre uma auditoria finalizada no servidor (`PUT /auditorias/:id/reabrir`).
 * AUDITOR só consegue reabrir as próprias auditorias. Online-only.
 */
export async function reabrirAuditoria(auditoriaRemoteId: string): Promise<AuditoriaApi> {
  return apiPut<AuditoriaApi>(`/auditorias/${auditoriaRemoteId}/reabrir`, undefined);
}

/**
 * Baixa o PDF do relatório de uma auditoria finalizada (`GET /auditorias/:id/pdf`,
 * stream `application/pdf`) para um arquivo local. Retorna o caminho do arquivo salvo.
 * Online-only para baixar; após baixado pode ser aberto offline.
 */
export async function baixarPdfAuditoria(
  auditoriaRemoteId: string,
  destinoLocal: string,
): Promise<string> {
  const token = await SecureStore.getItemAsync('auth_token');
  const resultado = await FileSystem.downloadAsync(
    `${API_URL}/auditorias/${auditoriaRemoteId}/pdf`,
    destinoLocal,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (resultado.status >= 400) {
    throw new Error('Não foi possível baixar o PDF do relatório.');
  }
  return resultado.uri;
}

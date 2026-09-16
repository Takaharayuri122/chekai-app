import { apiGet, apiPost, apiPut, apiDelete } from './client';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

export type StatusRelatorioTecnicoApi = 'rascunho' | 'finalizado';

export interface IniciarRelatorioTecnicoPayload {
  clienteId: string;
  unidadeId: string;
}

/**
 * Payload de atualização do relatório técnico. Espelha exatamente os campos do
 * `CriarRelatorioTecnicoDto` da API — qualquer campo extra é rejeitado por
 * `forbidNonWhitelisted`. Todos opcionais para suportar PUT parcial.
 */
export interface AtualizarRelatorioTecnicoPayload {
  clienteId?: string;
  unidadeId?: string;
  identificacao?: string;
  descricaoOcorrenciaHtml?: string;
  avaliacaoTecnicaHtml?: string;
  acoesExecutadas?: string[];
  recomendacoesConsultoraHtml?: string;
  planoAcaoSugeridoHtml?: string;
  apoioAnaliticoChekAi?: string;
  assinaturaNomeConsultora?: string;
  responsavel?: string;
  status?: StatusRelatorioTecnicoApi;
}

export interface RelatorioTecnicoFotoApi {
  id: string;
  url: string;
  nomeOriginal?: string | null;
  tamanhoBytes?: number | null;
}

export interface RelatorioTecnicoApi {
  id: string;
  clienteId: string;
  unidadeId: string | null;
  consultoraId: string;
  identificacao: string;
  descricaoOcorrenciaHtml: string;
  avaliacaoTecnicaHtml: string;
  acoesExecutadas: string[];
  recomendacoesConsultoraHtml: string;
  planoAcaoSugeridoHtml: string;
  apoioAnaliticoChekAi: string | null;
  status: StatusRelatorioTecnicoApi;
  assinaturaNomeConsultora: string;
  responsavel: string;
  pdfUrl: string | null;
  criadoEm?: string;
  atualizadoEm?: string;
  cliente?: { id: string; razaoSocial?: string; nomeFantasia?: string | null };
  unidade?: { id: string; nome?: string } | null;
  fotos?: RelatorioTecnicoFotoApi[];
}

/**
 * Pré-cria um relatório técnico no servidor (vínculo cliente/unidade), retornando
 * o registro com `id` remoto. Online-only.
 */
export async function iniciarRelatorioTecnico(
  payload: IniciarRelatorioTecnicoPayload,
): Promise<RelatorioTecnicoApi> {
  return apiPost<RelatorioTecnicoApi>('/relatorios-tecnicos/iniciar', {
    clienteId: payload.clienteId,
    unidadeId: payload.unidadeId,
  });
}

/**
 * Atualiza os campos de um relatório técnico (`PUT /relatorios-tecnicos/:id`).
 * Envia apenas os campos definidos no payload, alinhados ao DTO real da API.
 */
export async function atualizarRelatorioTecnico(
  remoteId: string,
  payload: AtualizarRelatorioTecnicoPayload,
): Promise<RelatorioTecnicoApi> {
  return apiPut<RelatorioTecnicoApi>(`/relatorios-tecnicos/${remoteId}`, payload);
}

export async function getRelatorioTecnico(remoteId: string): Promise<RelatorioTecnicoApi> {
  return apiGet<RelatorioTecnicoApi>(`/relatorios-tecnicos/${remoteId}`);
}

/**
 * Envia uma evidência fotográfica (multipart `file`) ao relatório técnico.
 * Sem processamento por IA (RN-REL-006). Online-only.
 */
export async function uploadRelatorioFoto(
  remoteId: string,
  filePath: string,
): Promise<{ id: string; url: string }> {
  const token = await SecureStore.getItemAsync('auth_token');
  const result = await FileSystem.uploadAsync(
    `${API_URL}/relatorios-tecnicos/${remoteId}/fotos`,
    filePath,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (result.status >= 400) {
    throw new Error('Falha no upload da foto.');
  }
  const json = JSON.parse(result.body) as { data: { id: string; url: string } };
  return json.data;
}

export async function removerRelatorioFoto(
  remoteId: string,
  fotoRemoteId: string,
): Promise<void> {
  return apiDelete(`/relatorios-tecnicos/${remoteId}/fotos/${fotoRemoteId}`);
}

/**
 * Gera o apoio analítico por IA (somente leitura — RN-REL-005). Online-only;
 * débito de créditos ocorre no servidor.
 */
export async function gerarApoioAnalitico(
  remoteId: string,
  prompt?: string,
): Promise<RelatorioTecnicoApi> {
  return apiPost<RelatorioTecnicoApi>(
    `/relatorios-tecnicos/${remoteId}/gerar-apoio-analitico`,
    prompt ? { prompt } : {},
  );
}

/**
 * Baixa o PDF do relatório técnico (`GET /relatorios-tecnicos/:id/pdf`, stream
 * `application/pdf`) para um arquivo local, retornando o caminho salvo. Online-only.
 */
export async function baixarPdfRelatorioTecnico(
  remoteId: string,
  destinoLocal: string,
): Promise<string> {
  const token = await SecureStore.getItemAsync('auth_token');
  const resultado = await FileSystem.downloadAsync(
    `${API_URL}/relatorios-tecnicos/${remoteId}/pdf`,
    destinoLocal,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );
  if (resultado.status >= 400) {
    throw new Error('Não foi possível baixar o PDF do relatório técnico.');
  }
  return resultado.uri;
}

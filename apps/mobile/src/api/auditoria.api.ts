import { apiPost, apiPut } from './client';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

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
  planoAcaoFinal?: string;
  pontuacao: number;
}

export interface FinalizarPayload {
  dataFim: string;
  latitudeFim?: number;
  longitudeFim?: number;
  assinaturaNome?: string;
}

export interface AuditoriaResumo {
  remoteId: string;
  analiseIa: string | null;
  resumoExecutivo: string | null;
  pdfUrl: string | null;
  pontuacaoTotal: number;
}

export async function createAuditoria(
  payload: CreateAuditoriaPayload,
): Promise<{ id: string; itens: Array<{ id: string; templateItemId: string }> }> {
  return apiPost<{ id: string; itens: Array<{ id: string; templateItemId: string }> }>(
    '/auditorias',
    { unidadeId: payload.unidadeId, templateId: payload.templateId },
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
    planoAcaoSugerido: item.planoAcaoFinal,
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
      fieldName: 'foto',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }
  );
  if (result.status >= 400) {
    throw new Error('Falha no upload da foto.');
  }
  const json = JSON.parse(result.body) as { data: { id: string; url: string } };
  return json.data;
}

export async function finalizarAuditoria(
  auditoriaRemoteId: string,
  payload: FinalizarPayload
): Promise<AuditoriaResumo> {
  return apiPut<AuditoriaResumo>(`/auditorias/${auditoriaRemoteId}/finalizar`, payload);
}

export async function getSugestaoIa(
  itemId: string,
  contexto: string
): Promise<{ descricao: string; planoAcao: string }> {
  // apiPost does not accept AbortSignal — enforce timeout via Promise.race
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('timeout')), 10_000)
  );
  return Promise.race([
    apiPost<{ descricao: string; planoAcao: string }>(
      `/auditorias/ia/sugestao-nc`,
      { itemId, contexto }
    ),
    timeout,
  ]);
}

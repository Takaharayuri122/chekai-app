import { apiGet, apiPost } from './client';

export type StatusCheckinApi = 'aberto' | 'fechado';

export interface CheckinApi {
  id: string;
  usuarioId: string;
  clienteId: string;
  unidadeId: string;
  status: StatusCheckinApi;
  dataCheckin: string;
  dataCheckout?: string | null;
  latitudeCheckin: number;
  longitudeCheckin: number;
  latitudeCheckout?: number | null;
  longitudeCheckout?: number | null;
  alerta3hEmitidoEm?: string | null;
  comentario?: string | null;
  encerradoAutomaticamente?: boolean;
  usuario?: { id: string; nome: string; email: string };
  cliente?: { id: string; razaoSocial?: string; nomeFantasia?: string | null };
  unidade?: { id: string; nome?: string };
}

export interface EstadoCheckinAberto {
  checkin: CheckinApi | null;
  isAtrasado3h: boolean;
}

export interface AlertaCheckinAberto {
  possuiAlerta: boolean;
  mensagem: string | null;
  checkin: CheckinApi | null;
}

/**
 * Payload de início do check-in. Espelha exatamente o `IniciarCheckinDto` da API —
 * qualquer campo extra é rejeitado por `forbidNonWhitelisted`.
 */
export interface IniciarCheckinPayload {
  clienteId: string;
  unidadeId: string;
  latitude: number;
  longitude: number;
}

export interface FinalizarCheckinPayload {
  latitude: number;
  longitude: number;
}

export interface OpcaoFiltroCheckin {
  id: string;
  nome: string;
}

export interface FiltrosCheckinsApi {
  auditores: OpcaoFiltroCheckin[];
  clientes: OpcaoFiltroCheckin[];
}

export interface ListaPaginadaCheckins {
  items: CheckinApi[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ListarCheckinsFiltros {
  page?: number;
  limit?: number;
  auditorId?: string;
  clienteId?: string;
  dataInicio?: string;
  dataFim?: string;
}

/**
 * Inicia um check-in (online-only). A regra de "apenas 1 aberto" (RN-CKI-001), a
 * validação da unidade (RN-CKI-002) e do vínculo do gestor (RN-CKI-003) são aplicadas
 * no servidor; em caso de violação a API retorna erro com mensagem.
 */
export async function iniciarCheckin(payload: IniciarCheckinPayload): Promise<CheckinApi> {
  return apiPost<CheckinApi>('/checkins/iniciar', payload);
}

/** Finaliza (checkout) um check-in aberto do próprio usuário (RN-CKI-004). */
export async function finalizarCheckin(id: string, payload: FinalizarCheckinPayload): Promise<CheckinApi> {
  return apiPost<CheckinApi>(`/checkins/${id}/finalizar`, payload);
}

/** Busca o check-in aberto do usuário atual e se ele está atrasado (>3h). */
export async function buscarCheckinAberto(): Promise<EstadoCheckinAberto> {
  return apiGet<EstadoCheckinAberto>('/checkins/me/aberto');
}

/** Busca o alerta de check-in aberto há mais de 3 horas (RN-CKI-005). */
export async function buscarAlertaCheckin(): Promise<AlertaCheckinAberto> {
  return apiGet<AlertaCheckinAberto>('/checkins/me/alertas');
}

/** Listagem administrativa (GESTOR/MASTER) — secundária no app do auditor. */
export async function listarCheckins(filtros: ListarCheckinsFiltros = {}): Promise<ListaPaginadaCheckins> {
  const params = new URLSearchParams();
  if (filtros.page != null) params.set('page', String(filtros.page));
  if (filtros.limit != null) params.set('limit', String(filtros.limit));
  if (filtros.auditorId) params.set('auditorId', filtros.auditorId);
  if (filtros.clienteId) params.set('clienteId', filtros.clienteId);
  if (filtros.dataInicio) params.set('dataInicio', filtros.dataInicio);
  if (filtros.dataFim) params.set('dataFim', filtros.dataFim);
  const query = params.toString();
  return apiGet<ListaPaginadaCheckins>(`/checkins${query ? `?${query}` : ''}`);
}

/** Opções de filtro (auditores/clientes) da listagem administrativa. */
export async function buscarFiltrosCheckins(): Promise<FiltrosCheckinsApi> {
  return apiGet<FiltrosCheckinsApi>('/checkins/filtros');
}

import { api, Cliente, Unidade } from '../api';

export interface CheckinRegistro {
  id: string;
  usuarioId: string;
  clienteId: string;
  unidadeId: string;
  status: 'aberto' | 'fechado';
  dataCheckin: string;
  dataCheckout?: string | null;
  latitudeCheckin: number;
  longitudeCheckin: number;
  latitudeCheckout?: number | null;
  longitudeCheckout?: number | null;
  alerta3hEmitidoEm?: string | null;
  usuario?: {
    id: string;
    nome: string;
    email: string;
  };
  cliente?: Cliente;
  unidade?: Unidade;
}

export interface EstadoCheckinAberto {
  checkin: CheckinRegistro | null;
  isAtrasado3h: boolean;
}

export interface AlertaCheckinAberto {
  possuiAlerta: boolean;
  mensagem: string | null;
  checkin: CheckinRegistro | null;
}

interface IniciarCheckinRequest {
  clienteId: string;
  unidadeId: string;
  latitude: number;
  longitude: number;
}

interface FinalizarCheckinRequest {
  latitude: number;
  longitude: number;
}

interface ListarCheckinsFiltros {
  page?: number;
  limit?: number;
  auditorId?: string;
  clienteId?: string;
  dataInicio?: string;
  dataFim?: string;
}

interface ListaPaginadaCheckins {
  items: CheckinRegistro[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

interface FiltrosCheckinsResponse {
  auditores: Array<{ id: string; nome: string }>;
  clientes: Array<{ id: string; nome: string }>;
}

export const checkinService = {
  async iniciar(data: IniciarCheckinRequest): Promise<CheckinRegistro> {
    const response = await api.post('/checkins/iniciar', data);
    return response.data.data;
  },
  async finalizar(id: string, data: FinalizarCheckinRequest): Promise<CheckinRegistro> {
    const response = await api.post(`/checkins/${id}/finalizar`, data);
    return response.data.data;
  },
  async buscarAberto(): Promise<EstadoCheckinAberto> {
    const response = await api.get('/checkins/me/aberto');
    return response.data.data;
  },
  async buscarAlerta(): Promise<AlertaCheckinAberto> {
    const response = await api.get('/checkins/me/alertas');
    return response.data.data;
  },
  async listar(filtros: ListarCheckinsFiltros): Promise<ListaPaginadaCheckins> {
    const response = await api.get('/checkins', { params: filtros });
    return response.data.data;
  },
  async buscarPorId(id: string): Promise<CheckinRegistro> {
    const response = await api.get(`/checkins/${id}`);
    return response.data.data;
  },
  async buscarFiltros(): Promise<FiltrosCheckinsResponse> {
    const response = await api.get('/checkins/filtros');
    return response.data.data;
  },
};

import { api, Cliente, Unidade } from '../api';
import { abrirPdfBlobEmNovaAba, type ResultadoAberturaPdf } from '../pdf-abertura';

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
  comentario?: string | null;
  encerradoAutomaticamente?: boolean;
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

export type AgruparHorasCheckin = 'cliente' | 'usuario';

export interface ItemRelatorioHorasCheckin {
  id: string;
  nome: string;
  quantidade: number;
  minutosFechados: number;
  minutosAbertos: number;
  minutosTotal: number;
}

export interface RelatorioHorasCheckin {
  agruparPor: AgruparHorasCheckin;
  dataInicio: string;
  dataFim: string;
  totalGeralMinutos: number;
  itens: ItemRelatorioHorasCheckin[];
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

export interface EditarCheckinRequest {
  dataCheckin?: string;
  dataCheckout?: string | null;
  comentario?: string | null;
}

interface ListarCheckinsFiltros {
  page?: number;
  limit?: number;
  auditorId?: string;
  clienteId?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface RelatorioHorasFiltros {
  agruparPor: AgruparHorasCheckin;
  dataInicio: string;
  dataFim: string;
  auditorId?: string;
  clienteId?: string;
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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const checkinService = {
  async iniciar(data: IniciarCheckinRequest): Promise<CheckinRegistro> {
    const response = await api.post('/checkins/iniciar', data);
    return response.data.data;
  },
  async finalizar(id: string, data: FinalizarCheckinRequest): Promise<CheckinRegistro> {
    const response = await api.post(`/checkins/${id}/finalizar`, data);
    return response.data.data;
  },
  async editar(id: string, data: EditarCheckinRequest): Promise<CheckinRegistro> {
    const response = await api.patch(`/checkins/${id}`, data);
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
  async relatorioHoras(filtros: RelatorioHorasFiltros): Promise<RelatorioHorasCheckin> {
    const response = await api.get('/checkins/relatorio-horas', { params: filtros });
    return response.data.data;
  },
  async baixarPdfRelatorioHoras(filtros: RelatorioHorasFiltros): Promise<ResultadoAberturaPdf> {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({
      agruparPor: filtros.agruparPor,
      dataInicio: filtros.dataInicio,
      dataFim: filtros.dataFim,
    });
    if (filtros.auditorId) {
      params.set('auditorId', filtros.auditorId);
    }
    if (filtros.clienteId) {
      params.set('clienteId', filtros.clienteId);
    }
    const response = await fetch(`${API_URL}/checkins/relatorio-horas/pdf?${params.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error('Erro ao gerar PDF do relatório de horas');
    }
    const blob = await response.blob();
    return abrirPdfBlobEmNovaAba(blob, 'relatorio-horas-checkin.pdf');
  },
};

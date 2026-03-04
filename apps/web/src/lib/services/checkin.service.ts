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
};

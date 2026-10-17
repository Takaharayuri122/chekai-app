import { api } from '../api';

export type StatusAgenda = 'agendada' | 'realizada' | 'cancelada';
export type RecorrenciaAgenda = 'nenhuma' | 'semanal' | 'quinzenal' | 'mensal';

export const STATUS_AGENDA_LABELS: Record<StatusAgenda, string> = {
  agendada: 'Agendada',
  realizada: 'Realizada',
  cancelada: 'Cancelada',
};

export const RECORRENCIA_LABELS: Record<RecorrenciaAgenda, string> = {
  nenhuma: 'Não repete',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
};

export interface AgendaItem {
  id: string;
  dataPrevista: string;
  recorrencia: RecorrenciaAgenda;
  status: StatusAgenda;
  observacao?: string | null;
  unidadeId: string;
  templateId: string;
  responsavelId?: string | null;
  unidade?: { id: string; nome: string; cliente?: { nomeFantasia?: string; razaoSocial?: string } };
  template?: { id: string; nome: string };
  responsavel?: { id: string; nome: string } | null;
}

export interface SalvarAgenda {
  unidadeId: string;
  templateId: string;
  responsavelId?: string;
  dataPrevista: string;
  recorrencia: RecorrenciaAgenda;
  observacao?: string;
}

export const agendaService = {
  async listar(page = 1, limit = 20, status?: StatusAgenda, responsavelId?: string, periodo?: { de: string; ate: string }) {
    const response = await api.get('/agenda', { params: { page, limit, status, responsavelId, de: periodo?.de, ate: periodo?.ate } });
    return response.data.data as { items: AgendaItem[]; total: number };
  },
  async criar(dados: SalvarAgenda): Promise<AgendaItem> {
    const response = await api.post('/agenda', dados);
    return response.data.data;
  },
  async atualizar(id: string, dados: Partial<Omit<SalvarAgenda, 'unidadeId' | 'templateId'>> & { status?: StatusAgenda }) {
    const response = await api.patch(`/agenda/${id}`, dados);
    return response.data.data as AgendaItem;
  },
  async concluir(id: string): Promise<AgendaItem> {
    const response = await api.post(`/agenda/${id}/concluir`);
    return response.data.data;
  },
  async remover(id: string): Promise<void> {
    await api.delete(`/agenda/${id}`);
  },
};

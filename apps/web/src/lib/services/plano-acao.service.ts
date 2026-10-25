import { api } from '../api';

export type StatusTarefaPlanoAcao = 'pendente' | 'em_andamento' | 'concluida' | 'cancelada';

export const STATUS_TAREFA_LABELS: Record<StatusTarefaPlanoAcao, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export interface TarefaPlanoAcao {
  id: string;
  titulo: string;
  descricao?: string | null;
  referenciaLegal?: string | null;
  prazo: string;
  status: StatusTarefaPlanoAcao;
  concluidaEm?: string | null;
  responsavelId?: string | null;
  responsavel?: { id: string; nome: string } | null;
  auditoriaId?: string | null;
  auditoria?: { id: string; unidade?: { nome: string } } | null;
}

export interface ResumoPlanoAcao {
  atrasadas: number;
  proximos7Dias: number;
  futuras: number;
  concluidas: number;
}

export interface SalvarTarefaPlanoAcao {
  titulo: string;
  descricao?: string;
  responsavelId?: string;
  auditoriaId?: string;
  prazo: string;
}

export const planoAcaoService = {
  async listar(page = 1, limit = 20, status?: StatusTarefaPlanoAcao, responsavelId?: string) {
    const response = await api.get('/planos-acao', { params: { page, limit, status, responsavelId } });
    return response.data.data as { items: TarefaPlanoAcao[]; total: number };
  },
  async resumo(): Promise<ResumoPlanoAcao> {
    const response = await api.get('/planos-acao/resumo');
    return response.data.data;
  },
  async criar(dados: SalvarTarefaPlanoAcao): Promise<TarefaPlanoAcao> {
    const response = await api.post('/planos-acao', dados);
    return response.data.data;
  },
  async atualizar(
    id: string,
    dados: Partial<Omit<SalvarTarefaPlanoAcao, 'auditoriaId'>> & { status?: StatusTarefaPlanoAcao },
  ): Promise<TarefaPlanoAcao> {
    const response = await api.patch(`/planos-acao/${id}`, dados);
    return response.data.data;
  },
  async gerarDaAuditoria(auditoriaId: string): Promise<{ criadas: number }> {
    const response = await api.post(`/planos-acao/gerar-da-auditoria/${auditoriaId}`);
    return response.data.data;
  },
  async remover(id: string): Promise<void> {
    await api.delete(`/planos-acao/${id}`);
  },
};

import { apiGet } from './client';

export interface AgendaItemApi {
  id: string;
  dataPrevista: string;
  status: string;
  unidade?: { id: string; nome: string } | null;
  template?: { id: string; nome: string } | null;
}

export interface TarefaPlanoAcaoApi {
  id: string;
  titulo: string;
  prazo: string;
  status: string;
}

interface Paginado<T> {
  items: T[];
}

/** Visitas agendadas (online — a agenda não fica no celular). */
export async function listarAgendaAgendada(): Promise<AgendaItemApi[]> {
  const resposta = await apiGet<Paginado<AgendaItemApi>>('/agenda?page=1&limit=50&status=agendada');
  return resposta.items ?? [];
}

/** Tarefas de plano de ação do usuário (online). */
export async function listarTarefasPlanoAcao(): Promise<TarefaPlanoAcaoApi[]> {
  const resposta = await apiGet<Paginado<TarefaPlanoAcaoApi>>('/planos-acao?page=1&limit=50');
  return resposta.items ?? [];
}

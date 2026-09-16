import { apiGet } from './client';

export interface PlanoLimites {
  nome: string;
  limiteUsuarios: number;
  limiteAuditorias: number;
  limiteClientes: number;
  limiteCreditos: number;
}

export interface UsoLimites {
  usuarios: number;
  auditorias: number;
  clientes: number;
  creditos: number;
}

export interface LimitesGestor {
  plano: PlanoLimites;
  uso: UsoLimites;
}

export interface SaldoCreditos {
  limite: number;
  usado: number;
  disponivel: number;
}

export interface UsoCredito {
  id: string;
  provedor: string;
  modelo: string;
  metodoChamado: string;
  tokensTotal: number | string;
  creditosConsumidos: number | string;
  criadoEm: string;
  usuario?: {
    id: string;
    nome: string;
    email: string;
  } | null;
}

export interface HistoricoCreditos {
  saldo: SaldoCreditos;
  historico: {
    items: UsoCredito[];
    total: number;
  };
}

/**
 * Consulta o plano atual e o uso vs. limites do gestor autenticado.
 * Online-only. Disponível para perfis GESTOR e MASTER.
 */
export async function consultarLimites(): Promise<LimitesGestor> {
  return apiGet<LimitesGestor>('/gestores/me/limites');
}

/**
 * Consulta o saldo de créditos de IA e o histórico de uso (paginado) do gestor autenticado.
 * Online-only. Disponível para perfis GESTOR e MASTER.
 */
export async function consultarCreditos(
  page = 1,
  limit = 20,
): Promise<HistoricoCreditos> {
  return apiGet<HistoricoCreditos>(
    `/gestores/me/creditos?page=${page}&limit=${limit}`,
  );
}

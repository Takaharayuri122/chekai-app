import { nomeCurtoLegislacao } from './nome-legislacao';

type LegislacaoNome = Parameters<typeof nomeCurtoLegislacao>[0];

interface ItemComLegislacoes {
  legislacoes?: LegislacaoNome[] | null;
  referenciaLegal?: string | null;
  templateItem?: {
    legislacoes?: LegislacaoNome[] | null;
    legislacaoReferencia?: string | null;
  } | null;
}

/**
 * Nome(s) da(s) norma(s) de um item de auditoria, na ordem de prioridade:
 * vínculos do próprio item, vínculos da pergunta do template, texto de referência.
 * Os nomes curtos são unidos por "; " (mesma regra da API). Sem nenhuma fonte, devolve null.
 */
export function nomesLegislacoesDoItem(item: ItemComLegislacoes): string | null {
  const nomes = (lista?: LegislacaoNome[] | null) =>
    lista && lista.length > 0 ? lista.map(nomeCurtoLegislacao).join('; ') : null;

  return (
    nomes(item.legislacoes) ??
    nomes(item.templateItem?.legislacoes) ??
    (item.referenciaLegal?.trim() || null) ??
    (item.templateItem?.legislacaoReferencia?.trim() || null) ??
    null
  );
}

import { Legislacao } from '../entities/legislacao.entity';

/**
 * Reduz as legislações carregadas numa relação ao resumo devolvido pela API
 * (sem informações, ementa ou trechos).
 */
export function resumirLegislacoes<T extends { legislacoes?: Legislacao[] }>(itens?: T[] | null): void {
  for (const item of itens ?? []) {
    if (item?.legislacoes) {
      item.legislacoes = item.legislacoes.map(resumirLegislacao);
    }
  }
}

export function resumirLegislacao(l: Legislacao): Legislacao {
  const { id, tipo, numero, ano, titulo, situacao } = l;
  return { id, tipo, numero, ano, titulo, situacao } as Legislacao;
}

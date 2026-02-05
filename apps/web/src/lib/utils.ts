/**
 * Calcula pontuações em sequência decrescente a partir da primeira opção.
 * Ex: pontuacaoPrimeira=1, quantidade=4 → [1, 0, -1, -2]
 */
export function calcularPontuacoesEmSequencia(
  pontuacaoPrimeira: number,
  quantidade: number,
): number[] {
  return Array.from({ length: quantidade }, (_, i) => pontuacaoPrimeira - i);
}

/**
 * Retorna a pontuação máxima possível para um item (por opções ou pela base sequencial).
 */
export function getPontuacaoMaximaItem(
  templateItem: {
    opcoesRespostaConfig?: Array<{ valor?: string; pontuacao?: number }>;
    opcoesResposta?: string[];
    usarRespostasPersonalizadas?: boolean;
    peso?: number;
  } | null | undefined,
): number {
  if (!templateItem) return 0;
  const configs = templateItem.opcoesRespostaConfig || [];
  const todasComPontuacao =
    configs.length > 0 &&
    configs.every((c) => c.pontuacao != null && c.pontuacao !== undefined);
  if (todasComPontuacao) {
    return Math.max(...configs.map((c) => Number(c.pontuacao)));
  }
  const opcoesOrdenadas = templateItem.usarRespostasPersonalizadas && templateItem.opcoesResposta?.length
    ? templateItem.opcoesResposta
    : ['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'];
  const configPrimeira = configs.find((c) => c.valor === opcoesOrdenadas[0]);
  const base = configPrimeira?.pontuacao != null ? configPrimeira.pontuacao : 1;
  return base;
}

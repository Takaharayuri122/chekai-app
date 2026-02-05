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

type TemplateItemPontuacao = {
  opcoesRespostaConfig?: Array<{ valor?: string; pontuacao?: number | null }>;
  opcoesResposta?: string[];
  usarRespostasPersonalizadas?: boolean;
  peso?: number;
} | null | undefined;

/**
 * Calcula a pontuação de uma opção: usa valor explícito da config quando existir,
 * senão usa o algoritmo sequencial (base da primeira opção menos o índice).
 */
export function calcularPontuacaoOpcao(
  templateItem: TemplateItemPontuacao,
  valorResposta: string,
): number {
  if (!templateItem) return 0;
  const configs = templateItem.opcoesRespostaConfig || [];
  const configOpcao = configs.find((c) => c.valor === valorResposta);
  if (configOpcao?.pontuacao != null && typeof configOpcao.pontuacao === 'number') {
    return configOpcao.pontuacao;
  }
  if (configOpcao && configOpcao.pontuacao === null) return 0;
  const opcoesOrdenadas = templateItem.usarRespostasPersonalizadas && templateItem.opcoesResposta?.length
    ? templateItem.opcoesResposta
    : ['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'];
  const indice = opcoesOrdenadas.indexOf(valorResposta);
  const configPrimeira = configs.find((c) => c.valor === opcoesOrdenadas[0]);
  const base = configPrimeira?.pontuacao != null && typeof configPrimeira.pontuacao === 'number'
    ? configPrimeira.pontuacao
    : 1;
  return indice >= 0 ? base - indice : 0;
}

/**
 * Retorna a pontuação máxima possível para um item: máximo entre as pontuações
 * de cada opção, usando a mesma regra de cálculo (explícita ou sequencial).
 */
export function getPontuacaoMaximaItem(templateItem: TemplateItemPontuacao): number {
  if (!templateItem) return 0;
  const opcoesOrdenadas = templateItem.usarRespostasPersonalizadas && templateItem.opcoesResposta?.length
    ? templateItem.opcoesResposta
    : ['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'];
  if (opcoesOrdenadas.length === 0) return 0;
  const pontuacoes = opcoesOrdenadas.map((valor) =>
    calcularPontuacaoOpcao(templateItem, valor),
  );
  return Math.max(...pontuacoes);
}

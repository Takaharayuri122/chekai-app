const OPCOES_SEM_PONTUACAO = ['nao_aplicavel', 'nao_avaliado'];

/**
 * Verifica se uma opção de resposta não participa do cálculo de pontuação.
 */
export function isOpcaoSemPontuacao(valor: string): boolean {
  return OPCOES_SEM_PONTUACAO.includes(valor.toLowerCase());
}

/**
 * Calcula pontuações em sequência decrescente, pulando opções sem pontuação (N/A, Não Avaliado).
 * Retorna um array com a pontuação para cada opção na ordem original.
 * Opções sem pontuação recebem `null`.
 */
export function calcularPontuacoesEmSequencia(
  pontuacaoPrimeira: number,
  opcoes: string[],
): (number | null)[] {
  let decremento = 0;
  return opcoes.map((opcao) => {
    if (isOpcaoSemPontuacao(opcao)) return null;
    const pontuacao = pontuacaoPrimeira - decremento;
    decremento++;
    return pontuacao;
  });
}

type TemplateItemPontuacao = {
  opcoesRespostaConfig?: Array<{ valor?: string; pontuacao?: number | null }>;
  opcoesResposta?: string[];
  usarRespostasPersonalizadas?: boolean;
  peso?: number;
} | null | undefined;

/**
 * Calcula a pontuação de uma opção: retorna null para opções sem pontuação,
 * usa valor explícito da config quando existir, senão usa o algoritmo sequencial
 * (base da primeira opção pontuável menos o índice relativo).
 */
export function calcularPontuacaoOpcao(
  templateItem: TemplateItemPontuacao,
  valorResposta: string,
): number {
  if (!templateItem) return 0;
  if (isOpcaoSemPontuacao(valorResposta)) return 0;
  const configs = templateItem.opcoesRespostaConfig || [];
  const configOpcao = configs.find((c) => c.valor === valorResposta);
  if (configOpcao?.pontuacao != null && typeof configOpcao.pontuacao === 'number') {
    return configOpcao.pontuacao;
  }
  if (configOpcao && configOpcao.pontuacao === null) return 0;
  const opcoesOrdenadas = templateItem.usarRespostasPersonalizadas && templateItem.opcoesResposta?.length
    ? templateItem.opcoesResposta
    : ['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'];
  const opcoesPontuaveis = opcoesOrdenadas.filter((op) => !isOpcaoSemPontuacao(op));
  const indice = opcoesPontuaveis.indexOf(valorResposta);
  const configPrimeira = configs.find((c) => c.valor === opcoesPontuaveis[0]);
  const base = configPrimeira?.pontuacao != null && typeof configPrimeira.pontuacao === 'number'
    ? configPrimeira.pontuacao
    : 1;
  return indice >= 0 ? base - indice : 0;
}

/**
 * Retorna a pontuação máxima possível para um item: máximo entre as pontuações
 * de cada opção pontuável, usando a mesma regra de cálculo.
 */
export function getPontuacaoMaximaItem(templateItem: TemplateItemPontuacao): number {
  if (!templateItem) return 0;
  const opcoesOrdenadas = templateItem.usarRespostasPersonalizadas && templateItem.opcoesResposta?.length
    ? templateItem.opcoesResposta
    : ['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'];
  const opcoesPontuaveis = opcoesOrdenadas.filter((op) => !isOpcaoSemPontuacao(op));
  if (opcoesPontuaveis.length === 0) return 0;
  const pontuacoes = opcoesPontuaveis.map((valor) =>
    calcularPontuacaoOpcao(templateItem, valor),
  );
  return Math.max(...pontuacoes);
}

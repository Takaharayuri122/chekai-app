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

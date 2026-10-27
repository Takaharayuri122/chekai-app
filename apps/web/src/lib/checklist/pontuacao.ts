import { TipoRespostaCustomizada, type TemplateItem } from '../api';

export type ItemComOpcoes = Pick<
  TemplateItem,
  'tipoRespostaCustomizada' | 'usarRespostasPersonalizadas' | 'opcoesResposta' | 'opcoesRespostaConfig'
>;

export const OPCOES_PADRAO = ['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'];

export function isOpcaoSemPontuacao(valor: string): boolean {
  return ['nao_aplicavel', 'nao_avaliado'].includes(valor.toLowerCase());
}

/**
 * Calcula a pontuação de uma opção de resposta: usa valor explícito da config quando existir,
 * senão usa o algoritmo sequencial (base da primeira opção menos o índice).
 */
export function calcularPontuacaoOpcao(item: ItemComOpcoes | null | undefined, valor: string): number {
  if (!item) return 0;
  if (item.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO) return 0;
  if (isOpcaoSemPontuacao(valor)) return 0;
  const configs = item.opcoesRespostaConfig || [];
  const configOpcao = configs.find((c) => c.valor === valor);
  if (configOpcao?.pontuacao != null && typeof configOpcao.pontuacao === 'number') {
    return configOpcao.pontuacao;
  }
  if (configOpcao && configOpcao.pontuacao === null) return 0;
  const opcoesOrdenadas = item.usarRespostasPersonalizadas && item.opcoesResposta?.length
    ? item.opcoesResposta
    : OPCOES_PADRAO;
  const opcoesPontuaveis = opcoesOrdenadas.filter((op) => !isOpcaoSemPontuacao(op));
  const indice = opcoesPontuaveis.indexOf(valor);
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
export function getPontuacaoMaximaItem(item: ItemComOpcoes | null | undefined): number {
  if (!item) return 0;
  if (item.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO) return 0;
  const opcoesOrdenadas = item.usarRespostasPersonalizadas && item.opcoesResposta?.length
    ? item.opcoesResposta
    : OPCOES_PADRAO;
  const opcoesPontuaveis = opcoesOrdenadas.filter((op) => !isOpcaoSemPontuacao(op));
  if (opcoesPontuaveis.length === 0) return 0;
  return Math.max(...opcoesPontuaveis.map((valor) => calcularPontuacaoOpcao(item, valor)));
}

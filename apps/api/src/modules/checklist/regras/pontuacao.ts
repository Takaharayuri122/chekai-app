import { TemplateItem, TipoRespostaCustomizada } from '../entities/template-item.entity';

export type ItemComOpcoes = Pick<
  TemplateItem,
  'tipoRespostaCustomizada' | 'usarRespostasPersonalizadas' | 'opcoesResposta' | 'opcoesRespostaConfig'
>;

const OPCOES_PADRAO = ['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'];

function normalizarRotulo(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Verdadeiro para `nao_aplicavel` e rótulos como "N/A", "Não se aplica", "Não aplicável". */
export function ehRotuloNaoAplicavel(valor: string): boolean {
  return ['na', 'n a', 'nao se aplica', 'nao aplicavel'].includes(normalizarRotulo(valor));
}

/** Não aplicável (padrão ou rótulo personalizado) e não avaliado ficam fora da nota. */
export function isOpcaoSemPontuacao(valor: string): boolean {
  return ['nao_aplicavel', 'nao_avaliado'].includes(valor.toLowerCase()) || ehRotuloNaoAplicavel(valor);
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

/**
 * Nota da auditoria: soma dos pontos obtidos sobre a soma das pontuações máximas,
 * só com as respostas que pontuam (não aplicável e não avaliado ficam fora).
 */
export function calcularNotaDaAuditoria(
  itens: readonly { resposta?: string | null; pontuacao?: number | string | null; templateItem?: ItemComOpcoes | null }[],
): { obtida: number; maxima: number; percentual: number } {
  const pontuaveis = itens.filter((item) => !isOpcaoSemPontuacao(item.resposta || ''));
  const obtida = pontuaveis.reduce((acc, item) => acc + Number(item.pontuacao || 0), 0);
  const maxima = pontuaveis.reduce((acc, item) => acc + getPontuacaoMaximaItem(item.templateItem), 0);
  return { obtida, maxima, percentual: maxima > 0 ? (obtida / maxima) * 100 : 0 };
}

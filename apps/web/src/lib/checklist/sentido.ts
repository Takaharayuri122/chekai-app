import { TipoRespostaCustomizada } from '../api';
import { calcularPontuacaoOpcao, isOpcaoSemPontuacao, OPCOES_PADRAO, type ItemComOpcoes } from './pontuacao';

export type SentidoResposta = 'positiva' | 'negativa' | 'neutra';

const TIPOS_SEM_SENTIDO = [
  TipoRespostaCustomizada.TEXTO,
  TipoRespostaCustomizada.NUMERO,
  TipoRespostaCustomizada.DATA,
];

function normalizarRotulo(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Verdadeiro para `nao_aplicavel` e rótulos como "N/A", "Não se aplica", "Não aplicável". */
export function ehRotuloNaoAplicavel(valor: string): boolean {
  return ['na', 'n a', 'nao se aplica', 'nao aplicavel'].includes(normalizarRotulo(valor));
}

function neutraPorPadraoOuRotulo(valor: string): boolean {
  return valor === 'nao_aplicavel' || ehRotuloNaoAplicavel(valor);
}

/**
 * Sentido de uma resposta: o gravado na config prevalece; senão é deduzido pelo
 * valor padrão, pelo rótulo ou pela posição da pontuação entre as opções do item.
 * Retorna null quando a pergunta não tem sentido (texto/número/data) ou não foi respondida.
 */
export function sentidoDaOpcao(
  item: ItemComOpcoes | null | undefined,
  valor: string | null | undefined,
): SentidoResposta | null {
  if (!item || !valor || valor === 'nao_avaliado') return null;
  if (item.tipoRespostaCustomizada && TIPOS_SEM_SENTIDO.includes(item.tipoRespostaCustomizada)) return null;

  const configGravada = (item.opcoesRespostaConfig || []).find((c) => c.valor === valor);
  if (configGravada?.sentido) return configGravada.sentido;

  if (valor === 'conforme') return 'positiva';
  if (valor === 'nao_conforme') return 'negativa';
  if (neutraPorPadraoOuRotulo(valor)) return 'neutra';

  const personalizadas =
    (item.usarRespostasPersonalizadas || item.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT) &&
    item.opcoesResposta?.length;
  const opcoes = (personalizadas ? item.opcoesResposta! : OPCOES_PADRAO).filter(
    (op) => op !== 'nao_avaliado' && !neutraPorPadraoOuRotulo(op),
  );
  if (!opcoes.includes(valor) || isOpcaoSemPontuacao(valor)) return 'neutra';

  const pontuacoes = opcoes.map((op) => calcularPontuacaoOpcao(item, op));
  const maior = Math.max(...pontuacoes);
  const menor = Math.min(...pontuacoes);
  if (maior === menor) return 'neutra';
  const propria = calcularPontuacaoOpcao(item, valor);
  if (propria === maior) return 'positiva';
  if (propria === menor) return 'negativa';
  return 'neutra';
}

export function ehNaoConformidade(item: ItemComOpcoes | null | undefined, valor: string | null | undefined): boolean {
  return sentidoDaOpcao(item, valor) === 'negativa';
}

/** Classes da resposta selecionada; sem sentido (null) usa o estilo neutro da tela de execução. */
export function classeDoSentido(sentido: SentidoResposta | null): string {
  if (sentido === 'positiva') return 'border-success bg-success/12 text-[hsl(160_84%_28%)]';
  if (sentido === 'negativa') return 'border-destructive bg-destructive/12 text-[hsl(0_72%_45%)]';
  return 'border-warning bg-warning/15 text-[hsl(32_95%_34%)]';
}

import { TipoRespostaCustomizada } from '../api';
import { calcularPontuacaoOpcao, ehRotuloNaoAplicavel, isOpcaoSemPontuacao, OPCOES_PADRAO, type ItemComOpcoes } from './pontuacao';

export { ehRotuloNaoAplicavel };

export type SentidoResposta = 'positiva' | 'negativa' | 'neutra';

const TIPOS_SEM_SENTIDO = [
  TipoRespostaCustomizada.TEXTO,
  TipoRespostaCustomizada.NUMERO,
  TipoRespostaCustomizada.DATA,
  TipoRespostaCustomizada.ASSINATURA,
];

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

/** Classes de um botão de resposta: `neutra` mapeia para warning; sem sentido (null) é o botão não selecionado. */
export function classeDoSentido(sentido: SentidoResposta | null): string {
  if (sentido === 'positiva') return 'border-success bg-success/12 text-[hsl(160_84%_28%)]';
  if (sentido === 'negativa') return 'border-destructive bg-destructive/12 text-[hsl(0_72%_45%)]';
  if (sentido === 'neutra') return 'border-warning bg-warning/15 text-[hsl(32_95%_34%)]';
  return 'border-border bg-card hover:bg-muted';
}

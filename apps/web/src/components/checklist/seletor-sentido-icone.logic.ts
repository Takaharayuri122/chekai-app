import type { OpcaoLote, TipoRespostaLote } from '@/lib/api';
import type { ItemComOpcoes } from '@/lib/checklist/pontuacao';
import { ICONES_RESPOSTA, ICONE_PADRAO_POR_SENTIDO } from '@/lib/checklist/icones';
import { sentidoDaOpcao, type SentidoResposta } from '@/lib/checklist/sentido';

export interface SentidoIcone {
  sentido: SentidoResposta | null;
  icone: string | null;
}

export const SENTIDOS: readonly { valor: SentidoResposta; rotulo: string; dica: string }[] = [
  { valor: 'positiva', rotulo: 'Positiva', dica: 'Resposta boa: aparece em verde no relatório' },
  { valor: 'neutra', rotulo: 'Neutra', dica: 'Resposta que não conta a favor nem contra: aparece em amarelo' },
  { valor: 'negativa', rotulo: 'Negativa', dica: 'Resposta ruim: aparece em vermelho e conta como não conformidade' },
];

/** Sentido que a resposta teria sem nenhuma escolha do gestor (ignora o sentido gravado). */
export function sentidoDeduzidoDaOpcao(item: Partial<ItemComOpcoes>, valor: string): SentidoResposta {
  const semSentido: ItemComOpcoes = {
    ...item,
    usarRespostasPersonalizadas: item.usarRespostasPersonalizadas ?? false,
    opcoesRespostaConfig: (item.opcoesRespostaConfig || []).map(({ sentido: _descartado, ...resto }) => resto),
  };
  return sentidoDaOpcao(semSentido, valor) ?? 'neutra';
}

/** Sentido marcado na tela: o gravado, ou o deduzido enquanto o gestor não escolheu. */
export function sentidoMarcado(sentido: SentidoResposta | null | undefined, deduzido: SentidoResposta): SentidoResposta {
  return sentido ?? deduzido;
}

/** Escolha de um sentido: grava o sentido e mantém o ícone atual. */
export function escolherSentido(atual: SentidoIcone, sentido: SentidoResposta): SentidoIcone {
  return { sentido, icone: atual.icone };
}

/** Escolha de um ícone (null = sem ícone): mantém o sentido atual, gravado ou não. */
export function escolherIcone(atual: SentidoIcone, icone: string | null): SentidoIcone {
  return { sentido: atual.sentido, icone };
}

/** Caractere a mostrar: aceita o código do catálogo ou o próprio caractere gravado. */
export function emojiDoIcone(icone: string | null | undefined): string | null {
  if (!icone) return null;
  return ICONES_RESPOSTA.find((i) => i.codigo === icone)?.emoji ?? icone;
}

/** Ícone exibido no botão: o gravado ou o padrão do sentido marcado. */
export function iconeExibido(icone: string | null | undefined, sentido: SentidoResposta): string {
  return emojiDoIcone(icone) ?? ICONE_PADRAO_POR_SENTIDO[sentido];
}

/** Converte a escolha em campos de uma config de opção (null vira ausente). */
export function camposDaConfig(v: SentidoIcone): { sentido?: SentidoResposta; icone?: string } {
  return { sentido: v.sentido ?? undefined, icone: v.icone ?? undefined };
}

/** Sentido deduzido de uma resposta na configuração em lote (a partir das opções em edição). */
export function sentidoDeduzidoNoLote(opcoes: OpcaoLote[], tipo: TipoRespostaLote, valor: string): SentidoResposta {
  return sentidoDeduzidoDaOpcao(
    {
      usarRespostasPersonalizadas: tipo === 'personalizada',
      opcoesResposta: tipo === 'personalizada' ? opcoes.map((o) => o.valor) : undefined,
      opcoesRespostaConfig: opcoes.map((o) => ({
        valor: o.valor,
        pontuacao: o.pontuacao,
        fotoObrigatoria: o.fotoObrigatoria,
        observacaoObrigatoria: o.observacaoObrigatoria,
      })),
    },
    valor,
  );
}

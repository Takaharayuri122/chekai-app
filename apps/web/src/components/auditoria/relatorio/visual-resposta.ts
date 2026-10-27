import type { AuditoriaItem } from '@/lib/api';
import { emojiDoIcone } from '@/components/checklist/seletor-sentido-icone.logic';
import { ICONE_PADRAO_POR_SENTIDO } from '@/lib/checklist/icones';
import { ehRotuloNaoAplicavel, sentidoDaOpcao } from '@/lib/checklist/sentido';
import { ehImagemDeAssinatura } from '@/lib/checklist/pontuacao';
import { TipoRespostaCustomizada } from '@/lib/api';

/** Tom visual da resposta: segue o sentido; N/A mantém o cinza e sem sentido fica sem destaque. */
export type TomResposta = 'success' | 'destructive' | 'warning' | 'muted' | 'nenhum';

/**
 * Ícone e tom do item no relatório (mesma regra do PDF): o sentido define a cor e o
 * ícone configurado na opção substitui o padrão do sentido; sem sentido mostra "?".
 */
export function visualDaResposta(item: Pick<AuditoriaItem, 'templateItem' | 'resposta'>): { tom: TomResposta; glifo: string } {
  if (imagemDaAssinatura(item)) return { tom: 'muted', glifo: '✎' };
  const sentido = sentidoDaOpcao(item.templateItem, item.resposta);
  // Texto, número e data respondidos não têm sentido: ficam neutros, como no PDF
  if (!sentido) return respondida(item) ? { tom: 'muted', glifo: '—' } : { tom: 'nenhum', glifo: '?' };
  const configurado = (item.templateItem?.opcoesRespostaConfig || []).find((c) => c.valor === item.resposta)?.icone;
  const glifo = emojiDoIcone(configurado) ?? ICONE_PADRAO_POR_SENTIDO[sentido];
  if (sentido === 'positiva') return { tom: 'success', glifo };
  if (sentido === 'negativa') return { tom: 'destructive', glifo };
  const naoAplicavel = item.resposta === 'nao_aplicavel' || ehRotuloNaoAplicavel(item.resposta);
  return { tom: naoAplicavel ? 'muted' : 'warning', glifo };
}

function respondida(item: Pick<AuditoriaItem, 'resposta'>): boolean {
  return !!item.resposta && item.resposta !== 'nao_avaliado';
}

/** Imagem da assinatura quando a pergunta é de assinatura e a resposta é um PNG válido. */
export function imagemDaAssinatura(item: Pick<AuditoriaItem, 'templateItem' | 'resposta'>): string | null {
  return item.templateItem?.tipoRespostaCustomizada === TipoRespostaCustomizada.ASSINATURA &&
    ehImagemDeAssinatura(item.resposta)
    ? item.resposta
    : null;
}

/** Fundo e borda do cartão do item por tom. */
export const CLASSE_ITEM_POR_TOM: Record<TomResposta, string> = {
  success: 'bg-success/5 border-success/20',
  destructive: 'bg-destructive/5 border-destructive/20',
  warning: 'bg-warning/10 border-warning/30',
  muted: 'bg-muted border-border',
  nenhum: 'bg-muted border-border',
};

/** Cor do ícone do item por tom. */
export const CLASSE_GLIFO_POR_TOM: Record<TomResposta, string> = {
  success: 'text-success',
  destructive: 'text-destructive',
  warning: 'text-warning',
  muted: 'text-muted-foreground',
  nenhum: 'text-muted-foreground',
};

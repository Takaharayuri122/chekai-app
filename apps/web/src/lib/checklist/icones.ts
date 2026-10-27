import type { SentidoResposta } from './sentido';

export const ICONES_RESPOSTA: readonly { codigo: string; emoji: string; rotulo: string }[] = [
  { codigo: 'check', emoji: '✓', rotulo: 'Conforme' },
  { codigo: 'x', emoji: '✗', rotulo: 'Não conforme' },
  { codigo: 'polegar-cima', emoji: '👍', rotulo: 'Positivo' },
  { codigo: 'polegar-baixo', emoji: '👎', rotulo: 'Negativo' },
  { codigo: 'rosto-feliz', emoji: '🙂', rotulo: 'Satisfeito' },
  { codigo: 'rosto-neutro', emoji: '😐', rotulo: 'Neutro' },
  { codigo: 'rosto-triste', emoji: '🙁', rotulo: 'Insatisfeito' },
  { codigo: 'alerta', emoji: '⚠️', rotulo: 'Alerta' },
  { codigo: 'estrela', emoji: '⭐', rotulo: 'Destaque' },
  { codigo: 'circulo-verde', emoji: '🟢', rotulo: 'Verde' },
  { codigo: 'circulo-amarelo', emoji: '🟡', rotulo: 'Amarelo' },
  { codigo: 'circulo-vermelho', emoji: '🔴', rotulo: 'Vermelho' },
];

/** Ícone usado quando a opção não define um. */
export const ICONE_PADRAO_POR_SENTIDO: Record<SentidoResposta, string> = {
  positiva: '✓',
  negativa: '✗',
  neutra: '—',
};

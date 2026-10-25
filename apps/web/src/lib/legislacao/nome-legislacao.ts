import { TipoLegislacao } from '@/lib/api';

/**
 * Sigla usada no nome curto de cada tipo de legislação.
 */
export const SIGLAS_TIPO: Record<TipoLegislacao, string> = {
  [TipoLegislacao.RDC]: 'RDC',
  [TipoLegislacao.PORTARIA]: 'Portaria',
  [TipoLegislacao.INSTRUCAO_NORMATIVA]: 'IN',
  [TipoLegislacao.LEI]: 'Lei',
  [TipoLegislacao.DECRETO]: 'Decreto',
  [TipoLegislacao.OUTRO]: '',
};

/**
 * Nome curto para exibição, ex.: "RDC 216/2004". Sem tipo útil ou número, usa o título.
 */
export function nomeCurtoLegislacao(l: {
  tipo: TipoLegislacao;
  numero?: string | null;
  ano?: number | null;
  titulo: string;
}): string {
  const sigla = SIGLAS_TIPO[l.tipo];
  const numero = l.numero?.trim();
  if (!sigla || !numero) {
    return l.titulo;
  }
  return l.ano ? `${sigla} ${numero}/${l.ano}` : `${sigla} ${numero}`;
}

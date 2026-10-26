import { FaixaClassificacao } from '../../checklist/regras';

/** Trecho colorido da barra de 0 a 100: começa em `inicio` e ocupa `largura` pontos. */
export interface SegmentoBarra {
  nome: string;
  cor: string;
  inicio: number;
  largura: number;
}

/**
 * Segmentos da barra na escala de 0 a 100 (mesma regra do cartão no web):
 * cada faixa ocupa de `de` até `ate`; o que fica fora das faixas aparece vazio.
 * Como as notas têm 2 casas, a folga de 0,01 entre faixas vizinhas não é vão.
 */
export function segmentosDaBarra(faixas: readonly FaixaClassificacao[]): SegmentoBarra[] {
  const ordenadas = [...faixas].sort((a, b) => a.de - b.de);
  return ordenadas.map((f, i) => {
    const proxima = ordenadas[i + 1];
    const encostaNaProxima = proxima && Math.round((proxima.de - f.ate) * 100) <= 1;
    const fim = encostaNaProxima ? proxima.de : f.ate;
    const inicio = Math.min(100, Math.max(0, f.de));
    return { nome: f.nome, cor: f.cor, inicio, largura: Math.max(0, Math.min(100, fim) - inicio) };
  });
}

/** Posição do marcador da nota na barra (0 a 100). */
export function posicaoNaBarra(nota: number): number {
  if (typeof nota !== 'number' || Number.isNaN(nota)) return 0;
  return Math.min(100, Math.max(0, nota));
}

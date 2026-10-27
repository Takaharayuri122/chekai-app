import { FAIXAS_PADRAO, validarFaixas, type FaixaClassificacao } from '@/lib/checklist/faixas';

/** Faixa em edição: os limites ficam como texto para o gestor poder digitar "59,9". */
export interface RascunhoFaixa {
  nome: string;
  cor: string;
  emoji: string | null;
  de: string;
  ate: string;
}

export const NOME_MAX = 20;

/** Cores sugeridas, da pior para a melhor classificação. */
export const PALETA_FAIXAS = ['#DC2626', '#EA580C', '#CA8A04', '#65A30D', '#16A34A', '#0EA5E9', '#6366F1', '#6B7280'];

export interface AvaliacaoRascunho {
  valido: boolean;
  erros: string[];
  /** Avisos que não bloqueiam: valores de nota que ficariam sem classificação. */
  lacunas: string[];
  /** Faixas prontas para enviar; null enquanto o rascunho for inválido. */
  faixas: FaixaClassificacao[] | null;
}

/** Converte "59,99" ou "59.99" em número; NaN quando não for um número. */
export function lerDecimal(texto: string): number {
  const t = texto.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return NaN;
  return Number(t);
}

export function formatarDecimal(n: number): string {
  return String(n).replace('.', ',');
}

export function rascunhoDeFaixas(faixas: readonly FaixaClassificacao[] | null | undefined): RascunhoFaixa[] {
  const origem = faixas && faixas.length > 0 ? faixas : FAIXAS_PADRAO;
  return origem.map((f) => ({
    nome: f.nome,
    cor: f.cor,
    emoji: f.emoji,
    de: formatarDecimal(f.de),
    ate: formatarDecimal(f.ate),
  }));
}

function paraFaixas(r: readonly RascunhoFaixa[]): FaixaClassificacao[] {
  return r.map((f) => ({ nome: f.nome, cor: f.cor, emoji: f.emoji, de: lerDecimal(f.de), ate: lerDecimal(f.ate) }));
}

function lacunasEntre(faixas: readonly FaixaClassificacao[]): string[] {
  const ordenadas = [...faixas].sort((a, b) => a.de - b.de);
  const avisos: string[] = [];
  for (let i = 0; i < ordenadas.length - 1; i++) {
    const atual = ordenadas[i];
    const proxima = ordenadas[i + 1];
    // Notas têm 2 casas: só há lacuna quando sobra ao menos 0,01 entre as faixas.
    if (Math.round((proxima.de - atual.ate) * 100) > 1) {
      avisos.push(
        `Notas entre ${formatarDecimal(atual.ate)} e ${formatarDecimal(proxima.de)} ficam sem classificação.`,
      );
    }
  }
  return avisos;
}

export function avaliarRascunho(rascunho: readonly RascunhoFaixa[]): AvaliacaoRascunho {
  const faixas = paraFaixas(rascunho);
  const erros = validarFaixas(faixas);
  if (erros.length > 0) return { valido: false, erros, lacunas: [], faixas: null };
  return { valido: true, erros: [], lacunas: lacunasEntre(faixas), faixas };
}

/** Nova faixa começa logo depois do maior fim existente; sem espaço, os limites vêm em branco. */
export function adicionarFaixa(rascunho: readonly RascunhoFaixa[]): RascunhoFaixa[] {
  const fins = rascunho.map((f) => lerDecimal(f.ate)).filter((n) => !Number.isNaN(n));
  const inicio = fins.length > 0 ? Math.round((Math.max(...fins) + 0.01) * 100) / 100 : 0;
  const cabe = inicio < 100;
  return [
    ...rascunho,
    {
      nome: '',
      cor: PALETA_FAIXAS[rascunho.length % PALETA_FAIXAS.length],
      emoji: null,
      de: cabe ? formatarDecimal(inicio) : '',
      ate: cabe ? '100' : '',
    },
  ];
}

export function removerFaixa(rascunho: readonly RascunhoFaixa[], indice: number): RascunhoFaixa[] {
  return rascunho.filter((_, i) => i !== indice);
}

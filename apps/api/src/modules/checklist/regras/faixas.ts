export interface FaixaClassificacao {
  nome: string;
  cor: string;
  emoji: string | null;
  de: number;
  ate: number;
}

export const FAIXAS_PADRAO: readonly Readonly<FaixaClassificacao>[] = Object.freeze([
  { nome: 'Crítico', cor: '#DC2626', emoji: '🔴', de: 0, ate: 59.99 },
  { nome: 'Atenção Necessária', cor: '#EA580C', emoji: '🟠', de: 60, ate: 69.99 },
  { nome: 'Regular', cor: '#CA8A04', emoji: '🟡', de: 70, ate: 79.99 },
  { nome: 'Bom', cor: '#65A30D', emoji: '🟢', de: 80, ate: 89.99 },
  { nome: 'Com Excelência', cor: '#16A34A', emoji: '⭐', de: 90, ate: 100 },
].map((f) => Object.freeze(f)));

const COR_HEX = /^#[0-9A-Fa-f]{6}$/;

export function validarFaixas(faixas: readonly FaixaClassificacao[]): string[] {
  if (!Array.isArray(faixas) || faixas.length === 0) {
    return ['Informe ao menos uma faixa de classificação.'];
  }
  const erros: string[] = [];
  faixas.forEach((f, i) => {
    const n = i + 1;
    const nome = typeof f.nome === 'string' ? f.nome.trim() : '';
    if (!nome) erros.push(`Faixa ${n}: informe o nome.`);
    else if (nome.length > 20) erros.push(`Faixa ${n}: o nome deve ter no máximo 20 caracteres.`);
    if (typeof f.cor !== 'string' || !COR_HEX.test(f.cor)) {
      erros.push(`Faixa ${n}: a cor deve estar no formato #RRGGBB.`);
    }
    const numeros = typeof f.de === 'number' && typeof f.ate === 'number' && isFinite(f.de) && isFinite(f.ate);
    if (!numeros) {
      erros.push(`Faixa ${n}: informe os valores de início e fim.`);
      return;
    }
    if (f.de < 0 || f.ate > 100 || f.de > 100 || f.ate < 0) {
      erros.push(`Faixa ${n}: os valores devem estar entre 0 e 100.`);
    }
    if (f.de >= f.ate) erros.push(`Faixa ${n}: o início deve ser menor que o fim.`);
  });
  for (let i = 0; i < faixas.length; i++) {
    for (let j = i + 1; j < faixas.length; j++) {
      const a = faixas[i];
      const b = faixas[j];
      if (a.de <= b.ate && b.de <= a.ate) {
        erros.push(`As faixas ${i + 1} e ${j + 1} se sobrepõem.`);
      }
    }
  }
  return erros;
}

export function classificar(
  nota: number,
  faixas?: readonly FaixaClassificacao[] | null,
): { nome: string; cor: string | null; emoji: string | null; faixa: FaixaClassificacao | null } {
  const lista: readonly FaixaClassificacao[] = faixas && faixas.length > 0 ? faixas : FAIXAS_PADRAO;
  if (typeof nota !== 'number' || Number.isNaN(nota)) {
    return { nome: 'Sem classificação', cor: null, emoji: null, faixa: null };
  }
  const n = Math.round(nota * 100) / 100;
  const faixa = lista.find((f) => f.de <= n && n <= f.ate);
  if (faixa) return { nome: faixa.nome, cor: faixa.cor, emoji: faixa.emoji, faixa };
  const menor = Math.min(...lista.map((f) => f.de));
  const nome = n < menor ? 'Abaixo do mínimo' : 'Sem classificação';
  return { nome, cor: null, emoji: null, faixa: null };
}

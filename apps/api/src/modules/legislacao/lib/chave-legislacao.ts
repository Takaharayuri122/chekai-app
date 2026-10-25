import { TipoLegislacao } from '../entities/legislacao.entity';

function normalizarNumero(numero: string | null | undefined): string | null {
  const digitos = (numero ?? '').replace(/\D/g, '').replace(/^0+/, '');
  return digitos || null;
}

/**
 * Chave canônica de uma legislação, ex.: "rdc:216:2004". Nula se faltar tipo útil, número ou ano.
 */
export function chaveDaLegislacao(l: {
  tipo: TipoLegislacao;
  numero?: string | null;
  ano?: number | null;
}): string | null {
  if (!l.tipo || l.tipo === TipoLegislacao.OUTRO) return null;
  const numero = normalizarNumero(l.numero);
  if (!numero || !l.ano) return null;
  return `${l.tipo}:${numero}:${l.ano}`;
}

const TIPOS_NO_TEXTO: { tipo: TipoLegislacao; padrao: RegExp }[] = [
  {
    tipo: TipoLegislacao.RDC,
    padrao: /^(?:Resolu[çc][ãa]o(?:\s+da\s+Diretoria\s+Colegiada)?\s*[-–—]?\s*)?RDC$/i,
  },
  { tipo: TipoLegislacao.INSTRUCAO_NORMATIVA, padrao: /^(?:Instru[çc][ãa]o\s+Normativa|IN)$/i },
  { tipo: TipoLegislacao.PORTARIA, padrao: /^Portaria$/i },
  { tipo: TipoLegislacao.LEI, padrao: /^Lei$/i },
  { tipo: TipoLegislacao.DECRETO, padrao: /^Decreto$/i },
];

const MESES = 'janeiro|fevereiro|mar[çc]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';
const ESFERAS = /^(?:Federal|Estadual|Municipal|Complementar)$/i;
const PALAVRAS_COMUNS = /^(?:DE|DO|DA|DOS|DAS|EM|NO|NA|E|OU)$/;

// tipo, palavras intermediárias (validadas no código), número, e "/AAAA" ou ", de DD de mês de AAAA".
// O lookbehind evita casar "Lei" dentro de "Decreto-Lei".
const REGEX_REFERENCIA = new RegExp(
  '(?<![-–—\\p{L}\\d])((?:Resolu[çc][ãa]o(?:\\s+da\\s+Diretoria\\s+Colegiada)?\\s*[-–—]?\\s*)?RDC|Instru[çc][ãa]o\\s+Normativa|IN|Portaria|Lei|Decreto)' +
    '((?:\\s+[\\p{L}][\\p{L}/-]*[º°]?){0,3}?)' +
    '\\s*[-–—]?\\s*(?:[Nn][º°o]?\\.?\\s*)?' +
    '(\\d+(?:\\.\\d{3})*)' +
    `(?:\\s*/\\s*(\\d{4})(?!\\d)|\\s*,?\\s+de\\s+\\d{1,2}\\s*[º°o]?\\s+de\\s+(?:${MESES})\\s+de\\s+(\\d{4})(?!\\d))`,
  'giu',
);

/** As palavras entre tipo e número só podem ser esfera ("Federal") ou sigla de órgão em maiúsculas. */
function palavrasValidas(intermediarias: string): boolean {
  const palavras = intermediarias.trim().split(/\s+/).filter(Boolean);
  while (palavras.length && /^n[º°o]?\.?$/i.test(palavras[palavras.length - 1])) palavras.pop();
  return palavras.every(
    (p) => ESFERAS.test(p) || (/^[A-ZÀ-Ý][A-ZÀ-Ý/-]{1,9}$/.test(p) && !PALAVRAS_COMUNS.test(p)),
  );
}

/**
 * Extrai do texto livre as chaves canônicas das legislações citadas (únicas, na ordem).
 */
export function chavesNoTexto(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const chaves: string[] = [];
  for (const m of texto.matchAll(REGEX_REFERENCIA)) {
    const tipoTexto = m[1].trim();
    if (/^IN$/i.test(tipoTexto) && tipoTexto !== 'IN') continue;
    if (!palavrasValidas(m[2])) continue;
    const tipo = TIPOS_NO_TEXTO.find((t) => t.padrao.test(tipoTexto))?.tipo;
    if (!tipo) continue;
    const chave = chaveDaLegislacao({ tipo, numero: m[3], ano: Number(m[4] ?? m[5]) });
    if (chave && !chaves.includes(chave)) chaves.push(chave);
  }
  return chaves;
}

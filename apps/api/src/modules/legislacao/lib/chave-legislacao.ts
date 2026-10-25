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

// tipo, siglas de órgão opcionais (ignoradas), número, e "/AAAA" ou ", de DD de mês de AAAA"
const REGEX_REFERENCIA = new RegExp(
  '\\b((?:Resolu[çc][ãa]o(?:\\s+da\\s+Diretoria\\s+Colegiada)?\\s*[-–—]?\\s*)?RDC|Instru[çc][ãa]o\\s+Normativa|IN|Portaria|Lei|Decreto)' +
    '(?:\\s+[A-Z]{2,6}(?![a-z]))*' +
    '\\s*[-–—]?\\s*(?:[Nn][º°o]?\\.?\\s*)?' +
    '(\\d+(?:\\.\\d{3})*)' +
    `(?:\\s*/\\s*(\\d{4})(?!\\d)|\\s*,?\\s+de\\s+\\d{1,2}\\s*[º°o]?\\s+de\\s+(?:${MESES})\\s+de\\s+(\\d{4})(?!\\d))`,
  'gi',
);

/**
 * Extrai do texto livre as chaves canônicas das legislações citadas (únicas, na ordem).
 */
export function chavesNoTexto(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const chaves: string[] = [];
  for (const m of texto.matchAll(REGEX_REFERENCIA)) {
    const tipo = TIPOS_NO_TEXTO.find((t) => t.padrao.test(m[1].trim()))?.tipo;
    if (!tipo) continue;
    const chave = chaveDaLegislacao({ tipo, numero: m[2], ano: Number(m[3] ?? m[4]) });
    if (chave && !chaves.includes(chave)) chaves.push(chave);
  }
  return chaves;
}

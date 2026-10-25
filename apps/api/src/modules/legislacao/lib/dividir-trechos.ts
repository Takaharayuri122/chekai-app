const ALVO = 1500;
const LIMITE = 2000;

// Artigo no início do texto/linha ou depois de fim de frase; item numerado só no início de linha.
const REGEX_MARCADOR =
  /(?<=^|[.;:!?]\s+)(Art\.?\s*(\d+)\s*([º°o])?(?![a-zà-ú]))|^[ \t]*(\d+(?:\.\d+)+)(?=\s)/gm;

interface Unidade {
  rotulo: string | null;
  texto: string;
}

interface Atomo {
  texto: string;
  sep: string;
}

function dividirPorMarcadores(texto: string): Unidade[] {
  const marcadores: { indice: number; rotulo: string }[] = [];
  for (const m of texto.matchAll(REGEX_MARCADOR)) {
    const rotulo = m[1]
      ? `Art. ${m[2]}${m[3] ? 'º' : ''}`
      : `Item ${m[4]}`;
    // m[0] do item pode incluir o recuo; o corte vale a partir do número
    const indice = m[1] ? m.index! : m.index! + m[0].indexOf(m[4]);
    marcadores.push({ indice, rotulo });
  }
  if (marcadores.length === 0) return [{ rotulo: null, texto }];
  const unidades: Unidade[] = [];
  if (marcadores[0].indice > 0) {
    unidades.push({ rotulo: null, texto: texto.slice(0, marcadores[0].indice) });
  }
  marcadores.forEach((m, i) => {
    const fim = i + 1 < marcadores.length ? marcadores[i + 1].indice : texto.length;
    unidades.push({ rotulo: m.rotulo, texto: texto.slice(m.indice, fim) });
  });
  return unidades;
}

/**
 * Quebra um texto grande em átomos de até LIMITE caracteres: parágrafo, frase e, por fim, palavra.
 */
function atomizar(texto: string): Atomo[] {
  const atomos: Atomo[] = [];
  for (const paragrafo of texto.split(/\n+/)) {
    if (!paragrafo.trim()) continue;
    if (paragrafo.length <= LIMITE) {
      atomos.push({ texto: paragrafo.trim(), sep: '\n' });
      continue;
    }
    for (const frase of paragrafo.match(/[^.!?;]+[.!?;]*\s*/g) ?? [paragrafo]) {
      if (!frase.trim()) continue;
      if (frase.length <= LIMITE) {
        atomos.push({ texto: frase.trim(), sep: ' ' });
        continue;
      }
      for (const palavra of frase.split(/\s+/)) {
        if (palavra) atomos.push({ texto: palavra, sep: ' ' });
      }
    }
  }
  return atomos;
}

function empacotar(texto: string): string[] {
  const pedacos: string[] = [];
  let atual = '';
  for (const atomo of atomizar(texto)) {
    if (!atual) {
      atual = atomo.texto;
    } else if (atual.length + atomo.sep.length + atomo.texto.length > ALVO) {
      pedacos.push(atual);
      atual = atomo.texto;
    } else {
      atual += atomo.sep + atomo.texto;
    }
  }
  if (atual) pedacos.push(atual);
  return pedacos;
}

/**
 * Divide o texto em trechos de ~1500 caracteres (máx. 2000), por artigo/item e sem cortar palavras.
 * O rótulo é o primeiro marcador (artigo ou item) do trecho.
 */
export function dividirEmTrechos(texto: string): { conteudo: string; artigo: string | null }[] {
  const trechos: { conteudo: string; artigo: string | null }[] = [];
  let atual: { conteudo: string; artigo: string | null } | null = null;

  const fechar = () => {
    if (atual && atual.conteudo.trim()) trechos.push(atual);
    atual = null;
  };

  for (const unidade of dividirPorMarcadores(texto)) {
    const conteudo = unidade.texto.trim();
    if (!conteudo) continue;

    if (conteudo.length > ALVO) {
      fechar();
      for (const pedaco of empacotar(conteudo)) {
        trechos.push({ conteudo: pedaco, artigo: unidade.rotulo });
      }
      continue;
    }
    if (atual && atual.conteudo.length + 1 + conteudo.length > ALVO) fechar();
    if (!atual) {
      atual = { conteudo, artigo: unidade.rotulo };
    } else {
      atual.conteudo += '\n' + conteudo;
      atual.artigo = atual.artigo ?? unidade.rotulo;
    }
  }
  fechar();
  return trechos;
}

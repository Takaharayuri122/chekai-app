import type {
  ConfiguracaoPerguntaImportada,
  ConfirmarImportacaoRequest,
  ImportarChecklistRequest,
  PerguntaImportada,
  RevisaoGrupoResultado,
  SugestaoPergunta,
} from '../api';

export interface EstadoRevisao {
  perguntas: PerguntaImportada[];
  sugestoes: Record<string, SugestaoPergunta>;
  nomesGrupos: Record<string, string>;
  desfeitas: Set<string>;
  conferidas: Set<string>;
  edicoes: Record<string, string>;
}

export type AbaRevisao = 'todas' | 'correcao' | 'conferir';

/** Divide as perguntas em lotes de no máximo `max`, sem misturar grupos (ordem de primeira aparição). */
export function dividirEmLotes(
  perguntas: PerguntaImportada[],
  max = 40,
): { grupo: string; perguntas: PerguntaImportada[] }[] {
  const porGrupo = new Map<string, PerguntaImportada[]>();
  for (const p of perguntas) {
    const lista = porGrupo.get(p.grupo) ?? [];
    lista.push(p);
    porGrupo.set(p.grupo, lista);
  }
  const lotes: { grupo: string; perguntas: PerguntaImportada[] }[] = [];
  for (const [grupo, lista] of porGrupo) {
    for (let i = 0; i < lista.length; i += max) {
      lotes.push({ grupo, perguntas: lista.slice(i, i + max) });
    }
  }
  return lotes;
}

export function versaoFinal(
  e: EstadoRevisao,
  chave: string,
): { pergunta: string; configuracao: ConfiguracaoPerguntaImportada } {
  const original = e.perguntas.find((p) => p.chave === chave);
  if (!original) throw new Error(`Pergunta não encontrada: ${chave}`);
  const sugestao = e.sugestoes[chave];
  const usarSugestao = !!sugestao && !e.desfeitas.has(chave);
  return {
    pergunta: e.edicoes[chave] ?? (usarSugestao ? sugestao.perguntaSugerida : original.pergunta),
    configuracao: usarSugestao ? sugestao.configuracaoSugerida : original.configuracao,
  };
}

function ativa(e: EstadoRevisao, chave: string): SugestaoPergunta | undefined {
  return e.desfeitas.has(chave) ? undefined : e.sugestoes[chave];
}

function precisaConferir(e: EstadoRevisao, p: PerguntaImportada): boolean {
  if (e.conferidas.has(p.chave) || e.desfeitas.has(p.chave)) return false;
  return !!e.sugestoes[p.chave]?.conferir || !!p.motivoConferir;
}

export function contadores(e: EstadoRevisao): { corrigidas: number; sugeridas: number; paraConferir: number } {
  let corrigidas = 0;
  let sugeridas = 0;
  let paraConferir = 0;
  for (const p of e.perguntas) {
    const s = ativa(e, p.chave);
    if (s && s.alteracoes.includes('pergunta')) corrigidas++;
    if (s && s.alteracoes.length > 0) sugeridas++;
    if (precisaConferir(e, p)) paraConferir++;
  }
  return { corrigidas, sugeridas, paraConferir };
}

export function filtrar(e: EstadoRevisao, aba: AbaRevisao): PerguntaImportada[] {
  if (aba === 'correcao') {
    return e.perguntas.filter((p) => ativa(e, p.chave)?.alteracoes.includes('pergunta'));
  }
  if (aba === 'conferir') return e.perguntas.filter((p) => precisaConferir(e, p));
  return e.perguntas;
}

/** Aceita todas as sugestões: refaz as desfeitas e marca tudo como conferido. */
export function aceitarTodas(e: EstadoRevisao): EstadoRevisao {
  const conferidas = new Set(e.conferidas);
  for (const p of e.perguntas) {
    if (e.sugestoes[p.chave]?.conferir || p.motivoConferir) conferidas.add(p.chave);
  }
  return { ...e, desfeitas: new Set(), conferidas };
}

/** Diferença por palavras (LCS): devolve os tokens do texto sugerido marcando os que mudaram. */
export function diferencaPalavras(original: string, sugerido: string): { texto: string; alterado: boolean }[] {
  const a = original.split(/(\s+)/).filter((t) => t !== '');
  const b = sugerido.split(/(\s+)/).filter((t) => t !== '');
  const tabela: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      tabela[i][j] = a[i] === b[j] ? tabela[i + 1][j + 1] + 1 : Math.max(tabela[i + 1][j], tabela[i][j + 1]);
    }
  }
  const resultado: { texto: string; alterado: boolean }[] = [];
  let i = 0;
  let j = 0;
  while (j < b.length) {
    if (i < a.length && a[i] === b[j]) {
      resultado.push({ texto: b[j], alterado: false });
      i++;
      j++;
    } else if (i < a.length && tabela[i + 1][j] >= tabela[i][j + 1]) {
      i++;
    } else {
      resultado.push({ texto: b[j], alterado: true });
      j++;
    }
  }
  return resultado;
}

export function montarConfirmacao(e: EstadoRevisao, dados: ImportarChecklistRequest): ConfirmarImportacaoRequest {
  const grupos = new Map<string, ConfirmarImportacaoRequest['grupos'][number]>();
  for (const p of e.perguntas) {
    let g = grupos.get(p.grupo);
    if (!g) {
      g = { nome: e.nomesGrupos[p.grupo] ?? p.grupo, perguntas: [] };
      grupos.set(p.grupo, g);
    }
    const final = versaoFinal(e, p.chave);
    g.perguntas.push({ secao: p.secao, pergunta: final.pergunta, configuracao: final.configuracao });
  }
  return { dados, grupos: [...grupos.values()] };
}

export interface ProgressoRevisao {
  grupoAtual: number;
  totalGrupos: number;
}

export interface ResultadoRevisaoLotes {
  sugestoes: Record<string, SugestaoPergunta>;
  nomesGrupos: Record<string, string>;
  semCreditos: boolean;
  falhas: number;
}

/**
 * Revisa lote a lote, estritamente em sequência. `sem_creditos` interrompe as chamadas seguintes;
 * `falha` (ou erro de rede) segue para o próximo lote.
 */
export async function revisarEmLotes(
  perguntas: PerguntaImportada[],
  revisar: (grupo: string, perguntas: PerguntaImportada[]) => Promise<RevisaoGrupoResultado>,
  aoProgredir?: (p: ProgressoRevisao) => void,
): Promise<ResultadoRevisaoLotes> {
  const lotes = dividirEmLotes(perguntas);
  const grupos = [...new Set(lotes.map((l) => l.grupo))];
  const resultado: ResultadoRevisaoLotes = { sugestoes: {}, nomesGrupos: {}, semCreditos: false, falhas: 0 };

  for (const lote of lotes) {
    aoProgredir?.({ grupoAtual: grupos.indexOf(lote.grupo) + 1, totalGrupos: grupos.length });
    let r: RevisaoGrupoResultado;
    try {
      r = await revisar(lote.grupo, lote.perguntas);
    } catch {
      resultado.falhas++;
      continue;
    }
    if (r.status === 'sem_creditos') {
      resultado.semCreditos = true;
      break;
    }
    if (r.status === 'falha') {
      resultado.falhas++;
      continue;
    }
    if (r.grupoNomeSugerido && !(lote.grupo in resultado.nomesGrupos)) {
      resultado.nomesGrupos[lote.grupo] = r.grupoNomeSugerido;
    }
    for (const s of r.sugestoes) resultado.sugestoes[s.chave] = s;
  }
  return resultado;
}

import { TipoRespostaCustomizada, type AuditoriaItem } from '@/lib/api';

export type StatusItem = 'pendente' | 'conforme' | 'nao_conforme' | 'neutro' | 'respondido';

export interface SecaoExecucao {
  id: string;
  nome: string;
  itens: AuditoriaItem[];
  respondidos: number;
}

const OPCOES_PADRAO = ['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'];

/** Itens antigos sem os campos novos aceitam foto; resposta em texto nunca aceita foto. */
export function aceitaFoto(item: AuditoriaItem): boolean {
  const t = item.templateItem;
  return t?.permiteFoto !== false && t?.tipoRespostaCustomizada !== TipoRespostaCustomizada.TEXTO;
}

export function aceitaObservacao(item: AuditoriaItem): boolean {
  return item.templateItem?.permiteObservacao !== false;
}

/** Imagem irrelevante só exige observação quando a pergunta aceita observação (senão seria um beco sem saída). */
export function bloqueiaPorImagemIrrelevante(item: AuditoriaItem, temImagemIrrelevante: boolean, observacao: string | undefined): boolean {
  return temImagemIrrelevante && aceitaObservacao(item) && (!observacao || observacao.trim() === '');
}

export type SecaoRegistro = 'fotos' | 'observacao';

export interface ExigenciasResposta {
  fotoObrigatoria: boolean;
  observacaoObrigatoria: boolean;
}

/** Sem configs vale a regra antiga (observação obrigatória); nunca exige o que a pergunta não aceita. */
export function exigenciasDaResposta(item: AuditoriaItem, resposta = item.resposta ?? ''): ExigenciasResposta {
  if (!resposta || resposta === 'nao_avaliado') return { fotoObrigatoria: false, observacaoObrigatoria: false };
  const configs = item.templateItem?.opcoesRespostaConfig;
  const base = !configs || configs.length === 0
    ? { fotoObrigatoria: false, observacaoObrigatoria: true }
    : configs.find((c) => c.valor === resposta) ?? { fotoObrigatoria: false, observacaoObrigatoria: false };
  return {
    fotoObrigatoria: aceitaFoto(item) && Boolean(base.fotoObrigatoria),
    observacaoObrigatoria: aceitaObservacao(item) && Boolean(base.observacaoObrigatoria),
  };
}

export interface EstadoRegistro {
  fotos: number;
  observacao: string;
  temImagemIrrelevante: boolean;
}

/**
 * O que impede salvar a janela aberta (null = pode salvar). Cada janela cobra só o que é dela;
 * a foto irrelevante é a exceção e sempre leva para a observação.
 */
export function pendenciaDoRegistro(
  item: AuditoriaItem,
  secao: SecaoRegistro,
  estado: EstadoRegistro,
): { secao: SecaoRegistro; mensagem: string } | null {
  const temObservacao = estado.observacao.trim() !== '';
  const respondido = Boolean(item.resposta && item.resposta !== 'nao_avaliado');
  const exige = exigenciasDaResposta(item);
  if (secao === 'fotos') {
    if (!respondido && estado.fotos === 0) return { secao, mensagem: 'Adicione pelo menos uma foto ou selecione uma resposta' };
    if (exige.fotoObrigatoria && estado.fotos === 0) return { secao, mensagem: 'Esta resposta requer pelo menos uma foto' };
  } else {
    if (!respondido && !temObservacao) return { secao, mensagem: 'Escreva a observação ou selecione uma resposta' };
    if (exige.observacaoObrigatoria && !temObservacao) return { secao, mensagem: 'Esta resposta requer uma observação' };
  }
  if (bloqueiaPorImagemIrrelevante(item, estado.temImagemIrrelevante, estado.observacao)) {
    return {
      secao: 'observacao',
      mensagem: 'Por favor, remova as imagens inadequadas ou adicione uma observação explicando por que a imagem é relevante.',
    };
  }
  return null;
}

export function estaRespondido(item: AuditoriaItem): boolean {
  const r = item.resposta;
  return Boolean(r && r.trim() !== '' && r !== 'nao_avaliado');
}

/** Mesma regra usada hoje na tela: config explícita ou base da primeira opção menos a posição. */
export function getPontuacaoParaOpcao(item: AuditoriaItem, opcao: string): number | null | undefined {
  const t = item.templateItem;
  const configs = t?.opcoesRespostaConfig ?? [];
  const opcoes = t?.usarRespostasPersonalizadas && t?.opcoesResposta?.length ? t.opcoesResposta : OPCOES_PADRAO;
  const config = configs.find((c) => c.valor === opcao);
  if (typeof config?.pontuacao === 'number') return config.pontuacao;
  if (config?.pontuacao === null) return null;
  const idx = opcoes.indexOf(opcao);
  if (idx < 0) return undefined;
  const primeira = configs.find((c) => c.valor === opcoes[0]);
  const base = typeof primeira?.pontuacao === 'number' ? primeira.pontuacao : 1;
  return base - idx;
}

export function statusItem(item: AuditoriaItem): StatusItem {
  if (!estaRespondido(item)) return 'pendente';
  const t = item.templateItem;
  if (t?.tipoRespostaCustomizada) return 'respondido';
  if (t?.usarRespostasPersonalizadas && t.opcoesResposta?.length) {
    const p = getPontuacaoParaOpcao(item, item.resposta);
    if (typeof p !== 'number' || p === 0) return 'neutro';
    return p > 0 ? 'conforme' : 'nao_conforme';
  }
  if (item.resposta === 'conforme') return 'conforme';
  if (item.resposta === 'nao_conforme') return 'nao_conforme';
  return 'neutro';
}

function porOrdem(a: AuditoriaItem, b: AuditoriaItem): number {
  return (a.templateItem?.ordem ?? 0) - (b.templateItem?.ordem ?? 0);
}

export function agruparPorSecao(itens: AuditoriaItem[]): SecaoExecucao[] {
  const mapa = new Map<string, { secao: SecaoExecucao; ordemGrupo: number; primeiraOrdem: number }>();
  for (const it of [...itens].sort(porOrdem)) {
    const grupo = it.templateItem?.grupo;
    const id = grupo?.id ?? (it.templateItem?.secao ? `secao:${it.templateItem.secao}` : 'sem-secao');
    const nome = grupo?.nome ?? it.templateItem?.secao ?? 'Perguntas';
    const ordemGrupo = grupo ? grupo.ordem : Number.MAX_SAFE_INTEGER;
    if (!mapa.has(id)) {
      mapa.set(id, { secao: { id, nome, itens: [], respondidos: 0 }, ordemGrupo, primeiraOrdem: it.templateItem?.ordem ?? 0 });
    }
    const entrada = mapa.get(id)!;
    entrada.secao.itens.push(it);
    if (estaRespondido(it)) entrada.secao.respondidos += 1;
  }
  return Array.from(mapa.values())
    .sort((a, b) => a.ordemGrupo - b.ordemGrupo || a.primeiraOrdem - b.primeiraOrdem)
    .map((e) => e.secao);
}

export function progresso(itens: AuditoriaItem[]): { respondidos: number; total: number; percentual: number } {
  const respondidos = itens.filter(estaRespondido).length;
  const total = itens.length;
  return { respondidos, total, percentual: total ? Math.round((respondidos / total) * 100) : 0 };
}

export function pendenciasObrigatorias(itens: AuditoriaItem[]): AuditoriaItem[] {
  return itens.filter((i) => i.templateItem?.obrigatorio && !estaRespondido(i));
}

export function naoConformidades(itens: AuditoriaItem[]): AuditoriaItem[] {
  return itens.filter((i) => statusItem(i) === 'nao_conforme');
}

export function vizinhos(
  sequencia: AuditoriaItem[],
  id: string,
): { anterior: AuditoriaItem | null; proximo: AuditoriaItem | null; posicao: number } {
  const idx = sequencia.findIndex((i) => i.id === id);
  if (idx < 0) return { anterior: null, proximo: null, posicao: 0 };
  return { anterior: sequencia[idx - 1] ?? null, proximo: sequencia[idx + 1] ?? null, posicao: idx + 1 };
}

/** Só auditoria em andamento aceita finalização (cancelada e finalizada não). */
export function podeFinalizar(status: string): boolean {
  return status === 'em_andamento';
}

/**
 * Texto/número salvam no blur; se o painel trocar de item ou fechar antes do blur, o valor digitado
 * fica só no estado local. Indica se há valor local ainda não salvo para o item.
 */
export function customizadoPendente(item: AuditoriaItem, valorLocal: string | undefined): boolean {
  const tipo = item.templateItem?.tipoRespostaCustomizada;
  if (tipo !== 'texto' && tipo !== 'numero') return false;
  if (valorLocal === undefined) return false;
  return valorLocal !== (item.resposta || '');
}

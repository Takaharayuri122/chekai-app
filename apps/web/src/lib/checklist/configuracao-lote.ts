import {
  CriticidadeItem,
  RESPOSTAS_PADRAO,
  TipoRespostaCustomizada,
  type AlteracoesLote,
  type ConfigurarLoteRequest,
  type OpcaoLote,
  type RespostaEmUso,
  type TemplateItem,
  type TipoRespostaLote,
} from '../api';

export type SecaoLote =
  | 'tipoResposta'
  | 'opcoes'
  | 'permiteFoto'
  | 'permiteObservacao'
  | 'obrigatorio'
  | 'criticidade';

export interface EstadoLote {
  ligadas: Record<SecaoLote, boolean>;
  tipoResposta: TipoRespostaLote;
  opcoes: OpcaoLote[];
  permiteFoto: boolean;
  permiteObservacao: boolean;
  obrigatorio: boolean;
  criticidade: CriticidadeItem;
}

const SECOES: SecaoLote[] = [
  'tipoResposta',
  'opcoes',
  'permiteFoto',
  'permiteObservacao',
  'obrigatorio',
  'criticidade',
];

/** Pontuação inicial de cada resposta padrão: conforme 1, não conforme 0; as demais não pontuam. */
function pontuacaoInicial(valorPadrao: string): number | null {
  if (valorPadrao === 'conforme') return 1;
  if (valorPadrao === 'nao_conforme') return 0;
  return null;
}

const SEM_PONTUACAO = ['nao_aplicavel', 'nao_avaliado'];

export function estadoInicialLote(): EstadoLote {
  return {
    ligadas: {
      tipoResposta: false,
      opcoes: false,
      permiteFoto: false,
      permiteObservacao: false,
      obrigatorio: false,
      criticidade: false,
    },
    tipoResposta: 'padrao',
    opcoes: opcoesParaTipo('padrao'),
    permiteFoto: true,
    permiteObservacao: true,
    obrigatorio: true,
    criticidade: CriticidadeItem.MEDIA,
  };
}

export function secoesTravadas(e: EstadoLote): Partial<Record<SecaoLote, string>> {
  const travadas: Partial<Record<SecaoLote, string>> = {};
  if (!e.ligadas.tipoResposta) {
    travadas.opcoes = 'Ligue "Tipo de resposta" para definir as opções';
    return travadas;
  }
  if (e.tipoResposta === 'texto') {
    travadas.opcoes = 'Não se aplica a respostas em texto';
    travadas.permiteFoto = 'Desativado: respostas em texto não recebem fotos';
  } else if (e.tipoResposta === 'numero' || e.tipoResposta === 'data') {
    travadas.opcoes = 'Não se aplica a respostas em número ou data';
  }
  return travadas;
}

export function montarAlteracoes(e: EstadoLote): AlteracoesLote {
  const travadas = secoesTravadas(e);
  const ativa = (s: SecaoLote) => e.ligadas[s] && !travadas[s];
  const alteracoes: AlteracoesLote = {};
  if (ativa('tipoResposta')) alteracoes.tipoResposta = e.tipoResposta;
  if (ativa('opcoes')) alteracoes.opcoes = e.opcoes;
  if (ativa('permiteFoto')) alteracoes.permiteFoto = e.permiteFoto;
  if (ativa('permiteObservacao')) alteracoes.permiteObservacao = e.permiteObservacao;
  if (ativa('obrigatorio')) alteracoes.obrigatorio = e.obrigatorio;
  if (ativa('criticidade')) alteracoes.criticidade = e.criticidade;
  return alteracoes;
}

export function temAlteracao(e: EstadoLote): boolean {
  return Object.keys(montarAlteracoes(e)).length > 0;
}

export function resumoRespostasGrupo(itens: TemplateItem[]): {
  padrao: number;
  personalizadas: number;
  texto: number;
  outros: number;
} {
  const r = { padrao: 0, personalizadas: 0, texto: 0, outros: 0 };
  for (const item of itens) {
    if (item.ativo === false) continue;
    const tipo = item.tipoRespostaCustomizada;
    if (tipo === TipoRespostaCustomizada.TEXTO) r.texto++;
    else if (tipo === TipoRespostaCustomizada.NUMERO || tipo === TipoRespostaCustomizada.DATA) r.outros++;
    else if (item.usarRespostasPersonalizadas) r.personalizadas++;
    else r.padrao++;
  }
  return r;
}

export type EscopoLote =
  | { tipo: 'selecao'; itemIds: string[] }
  | { tipo: 'grupo'; grupoId: string; nome: string; total: number }
  | { tipo: 'checklist'; total: number };

/** Monta o corpo da requisição de lote; seleção sempre envia ids, grupo envia o grupo, checklist envia só as alterações. */
export function montarRequisicaoLote(
  escopo: EscopoLote,
  estado: EstadoLote,
  simular: boolean,
): ConfigurarLoteRequest {
  const req: ConfigurarLoteRequest = { alteracoes: montarAlteracoes(estado), simular };
  if (escopo.tipo === 'selecao') req.itemIds = escopo.itemIds;
  else if (escopo.tipo === 'grupo') req.grupoId = escopo.grupoId;
  return req;
}

/** Opções iniciais ao trocar o tipo de resposta: padrão volta ao conjunto fixo, personalizada parte de nomes editáveis. */
export function opcoesParaTipo(tipo: TipoRespostaLote): OpcaoLote[] {
  return RESPOSTAS_PADRAO.map((r) => ({
    valor: tipo === 'personalizada' ? r.label : r.valor,
    pontuacao: pontuacaoInicial(r.valor),
    fotoObrigatoria: false,
    observacaoObrigatoria: false,
  }));
}

/**
 * Lê o campo "Pontos". Em branco a opção fica sem pontuação explícita (segue a pontuação padrão);
 * só "não aplicável" e "não avaliado" do padrão ficam explicitamente sem pontuar (null).
 */
export function lerPontos(texto: string, valor: string, tipo: TipoRespostaLote): number | null | undefined {
  if (texto.trim() === '') return tipo === 'padrao' && SEM_PONTUACAO.includes(valor) ? null : undefined;
  const n = parseInt(texto, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Troca o tipo de resposta; opções personalizadas ligam a seção de opções (a resposta exige opções).
 * Em personalizada, parte das opções que as perguntas já têm em comum (quando houver).
 */
export function trocarTipoLote(e: EstadoLote, tipo: TipoRespostaLote, comuns?: OpcaoLote[] | null): EstadoLote {
  const opcoes =
    tipo === 'personalizada' && comuns
      ? comuns.map((o) => ({ ...o }))
      : tipo === 'padrao' || tipo === 'personalizada'
        ? opcoesParaTipo(tipo)
        : e.opcoes;
  const ligadas = tipo === 'personalizada' ? { ...e.ligadas, opcoes: true } : e.ligadas;
  return { ...e, tipoResposta: tipo, opcoes, ligadas };
}

function auditorias(n: number): string {
  return n === 1 ? '1 auditoria' : `${n} auditorias`;
}

/** Motivo pelo qual a configuração ainda não pode ser enviada (null quando está pronta). */
export function motivoRequisicaoInvalida(e: EstadoLote, emUso: RespostaEmUso[] = []): string | null {
  const alteracoes = montarAlteracoes(e);
  if (alteracoes.tipoResposta === 'personalizada' && !alteracoes.opcoes) {
    return 'Opções personalizadas precisam da seção "Respostas" ligada.';
  }
  if (alteracoes.opcoes) {
    if (alteracoes.tipoResposta === 'personalizada') {
      const problema = problemasOpcoes(alteracoes.opcoes);
      if (problema) return problema;
      const [usada] = respostasRemovidasEmUso(alteracoes.opcoes, emUso);
      if (usada) return `A resposta “${usada.valor}” já foi usada em ${auditorias(usada.auditorias)} e não pode ser removida.`;
    } else if (!opcoesValidas(alteracoes.opcoes)) {
      return 'Dê um nome diferente a cada opção para continuar.';
    }
    const foraDoIntervalo = alteracoes.opcoes.some(
      (o) => o.pontuacao != null && (!Number.isInteger(o.pontuacao) || o.pontuacao < -10 || o.pontuacao > 10),
    );
    if (foraDoIntervalo) return 'Use pontos de -10 a 10.';
  }
  return null;
}

/** Ids selecionados que ainda existem entre as perguntas ativas (a seleção pode ficar velha após remover). */
export function selecionadosAtivos(itens: TemplateItem[], selecionados: Set<string>): string[] {
  return itens.filter((i) => i.ativo !== false && selecionados.has(i.id)).map((i) => i.id);
}

/** As opções só são válidas se houver ao menos uma e todas tiverem nome, sem repetição. */
export function opcoesValidas(opcoes: OpcaoLote[]): boolean {
  const nomes = opcoes.map((o) => o.valor.trim().toLowerCase());
  return nomes.length > 0 && nomes.every(Boolean) && new Set(nomes).size === nomes.length;
}

/** Peso ao trocar o tipo de resposta: texto não pontua (0); ao sair de texto, peso 0 volta a 1. */
export function pesoAoTrocarTipo(
  anterior: TipoRespostaCustomizada | undefined,
  novo: TipoRespostaCustomizada | undefined,
  peso: number | undefined,
): number | undefined {
  if (novo === TipoRespostaCustomizada.TEXTO) return 0;
  if (anterior === TipoRespostaCustomizada.TEXTO && peso === 0) return 1;
  return peso;
}

/** O formulário de grupo tem alteração real em relação ao grupo em edição (ou a um grupo novo vazio)? */
export function formGrupoAlterado(
  form: { nome: string; descricao?: string },
  grupo: { nome: string; descricao?: string | null } | null,
): boolean {
  return form.nome !== (grupo?.nome ?? '') || (form.descricao ?? '') !== (grupo?.descricao ?? '');
}

/** A pergunta usa opções personalizadas (inclui o tipo "select" legado). */
function ehPersonalizada(item: TemplateItem): boolean {
  return (
    (item.usarRespostasPersonalizadas && !item.tipoRespostaCustomizada) ||
    item.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT
  );
}

/**
 * Opções que todas as perguntas já têm (mesmas respostas, na mesma ordem), com `valorOriginal`
 * para que renomear atualize as respostas já dadas. Null quando não há um conjunto comum.
 */
export function opcoesComuns(itens: TemplateItem[]): OpcaoLote[] | null {
  const ativos = itens.filter((i) => i.ativo !== false);
  if (ativos.length === 0 || !ativos.every(ehPersonalizada)) return null;
  const valores = ativos[0].opcoesResposta ?? [];
  if (valores.length === 0) return null;
  const chave = JSON.stringify(valores);
  if (!ativos.every((i) => JSON.stringify(i.opcoesResposta ?? []) === chave)) return null;
  const config = ativos[0].opcoesRespostaConfig ?? [];
  return valores.map((valor) => {
    const c = config.find((x) => x.valor === valor);
    const opcao: OpcaoLote = {
      valor,
      valorOriginal: valor,
      fotoObrigatoria: c?.fotoObrigatoria ?? false,
      observacaoObrigatoria: c?.observacaoObrigatoria ?? false,
    };
    if (c && c.pontuacao !== undefined) opcao.pontuacao = c.pontuacao;
    return opcao;
  });
}

/** Move um elemento da lista (serve também para a lista de chaves paralela às opções). */
export function moverOpcao<T>(lista: T[], de: number, para: number): T[] {
  if (de < 0 || de >= lista.length || para < 0 || para >= lista.length || de === para) return lista.slice();
  const nova = lista.slice();
  const [movida] = nova.splice(de, 1);
  nova.splice(para, 0, movida);
  return nova;
}

export function removerOpcao<T>(lista: T[], indice: number): T[] {
  return lista.filter((_, i) => i !== indice);
}

export function adicionarOpcao(lista: OpcaoLote[]): OpcaoLote[] {
  return [...lista, { valor: '', fotoObrigatoria: false, observacaoObrigatoria: false }];
}

/** Renomeia mantendo o `valorOriginal` (é ele que liga a opção às respostas já dadas). */
export function renomearOpcao(lista: OpcaoLote[], indice: number, valor: string): OpcaoLote[] {
  return lista.map((o, i) => (i === indice ? { ...o, valor } : o));
}

/** Mesmo limite da resposta gravada na auditoria (varchar 100 na API). */
export const TAMANHO_MAXIMO_OPCAO = 100;

/** Problema das respostas personalizadas (mínimo 2, sem texto vazio, longo ou repetido); null quando estão ok. */
export function problemasOpcoes(lista: OpcaoLote[]): string | null {
  if (lista.length < 2) return 'Use ao menos 2 respostas.';
  const nomes = lista.map((o) => o.valor.trim().toLowerCase());
  if (nomes.some((n) => !n)) return 'Dê um texto a cada resposta.';
  if (lista.some((o) => o.valor.length > TAMANHO_MAXIMO_OPCAO)) return 'Use até 100 caracteres em cada resposta.';
  if (new Set(nomes).size !== nomes.length) return 'Dê um texto diferente a cada resposta.';
  return null;
}

/** Respostas já usadas em auditorias que deixariam de existir com esta lista. */
export function respostasRemovidasEmUso(lista: OpcaoLote[], emUso: RespostaEmUso[]): RespostaEmUso[] {
  const mantidas = new Set(lista.map((o) => o.valorOriginal ?? o.valor));
  return emUso.filter((u) => !mantidas.has(u.valor));
}

/** Alguma resposta já usada em auditorias teve o texto alterado? */
export function renomeiaRespostaUsada(lista: OpcaoLote[], emUso: RespostaEmUso[]): boolean {
  const usadas = new Set(emUso.map((u) => u.valor));
  return lista.some(
    (o) => o.valorOriginal !== undefined && usadas.has(o.valorOriginal) && o.valor.trim() !== o.valorOriginal,
  );
}

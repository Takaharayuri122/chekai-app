import {
  CriticidadeItem,
  RESPOSTAS_PADRAO,
  TipoRespostaCustomizada,
  type AlteracoesLote,
  type ConfigurarLoteRequest,
  type OpcaoLote,
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

/** Troca o tipo de resposta; opções personalizadas ligam a seção de opções (a resposta exige opções). */
export function trocarTipoLote(e: EstadoLote, tipo: TipoRespostaLote): EstadoLote {
  const opcoes = tipo === 'padrao' || tipo === 'personalizada' ? opcoesParaTipo(tipo) : e.opcoes;
  const ligadas = tipo === 'personalizada' ? { ...e.ligadas, opcoes: true } : e.ligadas;
  return { ...e, tipoResposta: tipo, opcoes, ligadas };
}

/** Motivo pelo qual a configuração ainda não pode ser enviada (null quando está pronta). */
export function motivoRequisicaoInvalida(e: EstadoLote): string | null {
  const alteracoes = montarAlteracoes(e);
  if (alteracoes.tipoResposta === 'personalizada' && !alteracoes.opcoes) {
    return 'Opções personalizadas precisam da seção "Opções, pontuação e exigências" ligada.';
  }
  if (alteracoes.opcoes) {
    if (!opcoesValidas(alteracoes.opcoes)) return 'Dê um nome diferente a cada opção para continuar.';
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

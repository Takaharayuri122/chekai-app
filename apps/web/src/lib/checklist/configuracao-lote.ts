import {
  CriticidadeItem,
  RESPOSTAS_PADRAO,
  TipoRespostaCustomizada,
  type AlteracoesLote,
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
    opcoes: RESPOSTAS_PADRAO.map((r) => ({
      valor: r.valor,
      pontuacao: null,
      fotoObrigatoria: false,
      observacaoObrigatoria: false,
    })),
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

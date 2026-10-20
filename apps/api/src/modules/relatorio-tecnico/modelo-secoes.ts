/**
 * Seções configuráveis do relatório técnico (RN-REL-009).
 * Identificação e Assinaturas são fixas e não fazem parte do modelo.
 * Mantenha este arquivo idêntico às cópias do web e do mobile.
 */
export type SecaoConfiguravel =
  | 'descricaoOcorrencia'
  | 'evidenciasFotograficas'
  | 'avaliacaoTecnica'
  | 'acoesExecutadas'
  | 'recomendacoesConsultora'
  | 'planoAcaoSugerido'
  | 'apoioAnalitico';

export interface ModeloSecao {
  secao: SecaoConfiguravel;
  ativa: boolean;
  titulo: string;
}

export const TITULO_MAXIMO = 60;

export const SECOES_CONFIGURAVEIS: ReadonlyArray<{ secao: SecaoConfiguravel; tituloPadrao: string }> = [
  { secao: 'descricaoOcorrencia', tituloPadrao: 'Descrição da Ocorrência' },
  { secao: 'evidenciasFotograficas', tituloPadrao: 'Evidências Fotográficas' },
  { secao: 'avaliacaoTecnica', tituloPadrao: 'Avaliação Técnica' },
  { secao: 'acoesExecutadas', tituloPadrao: 'Ações Executadas na Visita' },
  { secao: 'recomendacoesConsultora', tituloPadrao: 'Recomendações da Consultora' },
  { secao: 'planoAcaoSugerido', tituloPadrao: 'Plano de Ação Sugerido' },
  { secao: 'apoioAnalitico', tituloPadrao: 'Apoio Analítico ChekAi' },
];

/** Seções de texto: ao menos uma precisa ficar ativa. */
export const SECOES_CONTEUDO: ReadonlyArray<SecaoConfiguravel> = [
  'descricaoOcorrencia',
  'avaliacaoTecnica',
  'acoesExecutadas',
  'recomendacoesConsultora',
  'planoAcaoSugerido',
];

export function modeloPadrao(): ModeloSecao[] {
  return SECOES_CONFIGURAVEIS.map(({ secao, tituloPadrao }) => ({
    secao,
    ativa: true,
    titulo: tituloPadrao,
  }));
}

export function mesclarComPadrao(salvas: ModeloSecao[] | null | undefined): ModeloSecao[] {
  const porSecao = new Map((salvas ?? []).map((s) => [s.secao, s]));
  return SECOES_CONFIGURAVEIS.map(({ secao, tituloPadrao }) => {
    const salva = porSecao.get(secao);
    if (!salva) return { secao, ativa: true, titulo: tituloPadrao };
    const titulo = typeof salva.titulo === 'string' ? salva.titulo.trim() : '';
    return { secao, ativa: salva.ativa !== false, titulo: titulo || tituloPadrao };
  });
}

export function validarModelo(secoes: unknown): string | null {
  if (!Array.isArray(secoes)) {
    return 'O modelo do relatório deve ser uma lista de seções.';
  }
  const conhecidas = new Set(SECOES_CONFIGURAVEIS.map((s) => s.secao));
  const vistas = new Set<string>();
  for (const item of secoes as Array<Partial<ModeloSecao>>) {
    if (!item || typeof item !== 'object' || typeof item.secao !== 'string') {
      return 'Seção inválida no modelo do relatório.';
    }
    if (!conhecidas.has(item.secao as SecaoConfiguravel)) {
      return `Seção desconhecida no modelo do relatório: ${item.secao}.`;
    }
    if (vistas.has(item.secao)) {
      return `Seção duplicada no modelo do relatório: ${item.secao}.`;
    }
    vistas.add(item.secao);
    if (typeof item.ativa !== 'boolean') {
      return 'Informe se cada seção está incluída ou não.';
    }
    const titulo = typeof item.titulo === 'string' ? item.titulo.trim() : '';
    if (item.titulo !== undefined && typeof item.titulo !== 'string') {
      return 'O título da seção deve ser um texto.';
    }
    if (titulo.length > TITULO_MAXIMO) {
      return `O título da seção deve ter no máximo ${TITULO_MAXIMO} caracteres.`;
    }
    if (/[<>]/.test(titulo)) {
      return 'O título da seção não pode conter os caracteres < ou >.';
    }
  }
  const mesclado = mesclarComPadrao(secoes as ModeloSecao[]);
  if (!mesclado.some((s) => s.ativa && SECOES_CONTEUDO.includes(s.secao))) {
    return 'Mantenha ao menos uma seção de texto incluída no relatório.';
  }
  return null;
}

export function secaoAtiva(modelo: ModeloSecao[], secao: SecaoConfiguravel): boolean {
  return mesclarComPadrao(modelo).find((s) => s.secao === secao)?.ativa ?? true;
}

export function tituloSecao(modelo: ModeloSecao[], secao: SecaoConfiguravel): string {
  return mesclarComPadrao(modelo).find((s) => s.secao === secao)!.titulo;
}

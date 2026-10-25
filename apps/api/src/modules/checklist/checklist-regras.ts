import { TemplateItem, TipoRespostaCustomizada } from './entities/template-item.entity';

export type ItemConfiguravel = Pick<
  TemplateItem,
  | 'tipoRespostaCustomizada'
  | 'usarRespostasPersonalizadas'
  | 'peso'
  | 'permiteFoto'
  | 'permiteObservacao'
  | 'opcoesResposta'
  | 'opcoesRespostaConfig'
>;

export const RESPOSTAS_PADRAO_VALORES = [
  'conforme',
  'nao_conforme',
  'nao_aplicavel',
  'nao_avaliado',
] as const;

/**
 * Normaliza opcoesRespostaConfig para garantir sincronia com opcoesResposta.
 * Garante que cada opção tenha uma configuração correspondente.
 */
export function normalizarOpcoesConfig(item: Partial<ItemConfiguravel>): void {
  const usaRespostasPersonalizadas =
    item.usarRespostasPersonalizadas ||
    item.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT;
  const configExistente = item.opcoesRespostaConfig || [];
  const valores: readonly string[] =
    usaRespostasPersonalizadas && item.opcoesResposta
      ? item.opcoesResposta
      : RESPOSTAS_PADRAO_VALORES;

  item.opcoesRespostaConfig = valores.map(
    (valor) =>
      configExistente.find((c) => c.valor === valor) || {
        valor,
        fotoObrigatoria: false,
        observacaoObrigatoria: false,
      },
  );
}

/**
 * Normaliza as opções e aplica as regras forçadas RN-CHK-014 e RN-CHK-015.
 */
export function aplicarRegrasForcadas(item: Partial<ItemConfiguravel>): void {
  const texto = item.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO;
  if (texto) {
    item.peso = 0;
    item.permiteFoto = false;
    item.opcoesResposta = null as unknown as string[];
  }

  normalizarOpcoesConfig(item);

  item.opcoesRespostaConfig = (item.opcoesRespostaConfig || []).map((c) => {
    const config = { ...c };
    if (texto) config.pontuacao = null;
    if (item.permiteFoto === false) config.fotoObrigatoria = false;
    if (item.permiteObservacao === false) config.observacaoObrigatoria = false;
    return config;
  });
}

export type TipoRespostaLote = 'padrao' | 'personalizada' | 'texto' | 'numero' | 'data';

export interface OpcaoLote {
  valor: string;
  pontuacao?: number | null;
  fotoObrigatoria: boolean;
  observacaoObrigatoria: boolean;
}

/**
 * Aplica um tipo de resposta ao item (usado pela configuração em lote).
 * Não aplica as regras forçadas: chamar `aplicarRegrasForcadas` em seguida.
 */
export function aplicarTipoResposta(
  item: Partial<ItemConfiguravel>,
  tipo: TipoRespostaLote,
  opcoes?: OpcaoLote[],
): void {
  if (tipo === 'padrao') {
    item.usarRespostasPersonalizadas = false;
    item.tipoRespostaCustomizada = null as unknown as TipoRespostaCustomizada;
    item.opcoesResposta = null as unknown as string[];
    if (opcoes) {
      item.opcoesRespostaConfig = opcoes.filter((o) =>
        (RESPOSTAS_PADRAO_VALORES as readonly string[]).includes(o.valor),
      );
    }
    return;
  }
  item.usarRespostasPersonalizadas = true;
  if (tipo === 'personalizada') {
    item.tipoRespostaCustomizada = null as unknown as TipoRespostaCustomizada;
    item.opcoesResposta = (opcoes || []).map((o) => o.valor);
    item.opcoesRespostaConfig = opcoes || [];
    return;
  }
  item.tipoRespostaCustomizada = tipo as TipoRespostaCustomizada;
  item.opcoesResposta = null as unknown as string[];
}

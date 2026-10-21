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

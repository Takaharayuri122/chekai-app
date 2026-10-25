import { aplicarRegrasForcadas, aplicarTipoResposta, RESPOSTAS_PADRAO_VALORES, TipoRespostaLote } from './checklist-regras';
import {
  ChecklistCsvRow,
  ConfiguracaoPerguntaImportada,
  PerguntaImportada,
} from './dto/importar-checklist.dto';
import { TAMANHO_MAXIMO_OPCAO } from './dto/configurar-lote.dto';
import { CategoriaItem, CriticidadeItem, TemplateItem } from './entities/template-item.entity';

type OpcaoImportada = ConfiguracaoPerguntaImportada['opcoes'][number];

/**
 * Infere a categoria baseada no nome do grupo.
 */
export function inferirCategoria(grupo: string): CategoriaItem {
  if (!grupo) return CategoriaItem.OUTRO;

  const grupoLower = grupo.toLowerCase();

  if (grupoLower.includes('estrutura')) return CategoriaItem.ESTRUTURA;
  if (grupoLower.includes('higiene') || grupoLower.includes('higienização')) return CategoriaItem.HIGIENE;
  if (grupoLower.includes('manipula') || grupoLower.includes('colaborador') || grupoLower.includes('funcionário')) return CategoriaItem.MANIPULADORES;
  if (grupoLower.includes('documento') || grupoLower.includes('responsáve')) return CategoriaItem.DOCUMENTACAO;
  if (grupoLower.includes('estoque') || grupoLower.includes('armazen')) return CategoriaItem.ARMAZENAMENTO;
  if (grupoLower.includes('prepara') || grupoLower.includes('produção')) return CategoriaItem.PREPARACAO;
  if (grupoLower.includes('praga') || grupoLower.includes('controle')) return CategoriaItem.CONTROLE_PRAGAS;
  if (grupoLower.includes('equipamento')) return CategoriaItem.EQUIPAMENTOS;

  return CategoriaItem.OUTRO;
}

/**
 * Mapeia o texto da coluna "tipo de resposta" da planilha para um tipo do sistema.
 */
export function mapearTipoResposta(
  bruto: string | undefined,
  temOpcoes: boolean,
): { tipo: TipoRespostaLote; reconhecido: boolean } {
  const valor = (bruto ?? '').trim().toLowerCase();
  if (valor.includes('texto')) return { tipo: 'texto', reconhecido: true };
  if (/n[úu]mer/.test(valor)) return { tipo: 'numero', reconhecido: true };
  if (valor.includes('data')) return { tipo: 'data', reconhecido: true };
  return { tipo: temOpcoes ? 'personalizada' : 'padrao', reconhecido: valor === '' };
}

/**
 * Aplica RN-CHK-014/015 à configuração (função pura).
 */
export function normalizarConfiguracao(
  c: ConfiguracaoPerguntaImportada,
): ConfiguracaoPerguntaImportada {
  const texto = c.tipoResposta === 'texto';
  const permiteFoto = texto ? false : c.permiteFoto;
  return {
    ...c,
    permiteFoto,
    peso: texto ? 0 : c.peso,
    opcoes: texto
      ? []
      : c.opcoes.map((o) => ({
          ...o,
          fotoObrigatoria: permiteFoto ? o.fotoObrigatoria : false,
          observacaoObrigatoria: c.permiteObservacao ? o.observacaoObrigatoria : false,
        })),
  };
}

export const PONTUACAO_MIN = -10;
export const PONTUACAO_MAX = 10;
export const PESO_MAX = 100;
const MOTIVO_PONTUACAO_AJUSTADA = 'Pontuação da planilha fora do intervalo de -10 a 10 foi ajustada.';
const MOTIVO_OPCAO_ENCURTADA = 'Uma resposta da planilha passou de 100 caracteres e foi encurtada.';

/** Peso inteiro de 0 a PESO_MAX; valor ausente, inválido ou negativo vira 1. */
export function normalizarPeso(bruto: number | undefined): number {
  if (typeof bruto !== 'number' || !Number.isFinite(bruto) || bruto < 0) return 1;
  return Math.min(PESO_MAX, Math.round(bruto));
}

/** Pontos da planilha: não numérico → ausente (pontuação padrão); fora do intervalo → ajustado. */
function normalizarPontos(bruto: number | undefined): { pontuacao?: number; ajustada: boolean } {
  if (typeof bruto !== 'number' || !Number.isFinite(bruto)) return { ajustada: false };
  const pontuacao = Math.min(PONTUACAO_MAX, Math.max(PONTUACAO_MIN, bruto));
  return { pontuacao, ajustada: pontuacao !== bruto };
}

/** Opção sem pontuação explícita: só "não aplicável" e "não avaliado" ficam sem pontuar (null). */
function opcao(
  valor: string,
  pontuacao: number | undefined,
  fotoObrigatoria: boolean,
  observacaoObrigatoria: boolean,
): OpcaoImportada {
  const o: OpcaoImportada = { valor, fotoObrigatoria, observacaoObrigatoria };
  if (pontuacao !== undefined) o.pontuacao = pontuacao;
  else if (valor === 'nao_aplicavel' || valor === 'nao_avaliado') o.pontuacao = null;
  return o;
}

/**
 * Converte uma linha da planilha em pergunta importada com configuração.
 */
export function mapearLinhaImportada(row: ChecklistCsvRow, indice: number): PerguntaImportada {
  const opcoesPlanilha = row.opcoesResposta ?? [];
  const temOpcoes = opcoesPlanilha.length > 0;
  const { tipo, reconhecido } = mapearTipoResposta(row.tipoResposta, temOpcoes);

  const nenhumaInconformidade = !opcoesPlanilha.some((o) => o.inconformidade);
  const exige = (flag: boolean | undefined, inconformidade: boolean | undefined) =>
    !!flag && (!!inconformidade || nenhumaInconformidade);

  let opcoes: OpcaoImportada[];
  let pontuacaoAjustada = false;
  let opcaoEncurtada = false;
  if (tipo === 'personalizada') {
    opcoes = opcoesPlanilha.map((o) => {
      const { pontuacao, ajustada } = normalizarPontos(o.pontos);
      pontuacaoAjustada ||= ajustada;
      // A resposta escolhida é gravada na auditoria com até 100 caracteres
      const texto = (o.texto ?? '').trim();
      opcaoEncurtada ||= texto.length > TAMANHO_MAXIMO_OPCAO;
      return opcao(
        texto.slice(0, TAMANHO_MAXIMO_OPCAO),
        pontuacao,
        exige(row.fotosObrigatorias, o.inconformidade),
        exige(row.justificativaObrigatoria, o.inconformidade),
      );
    });
  } else if (tipo === 'padrao') {
    opcoes = RESPOSTAS_PADRAO_VALORES.map((valor) =>
      opcao(
        valor,
        undefined,
        valor === 'nao_conforme' && !!row.fotosObrigatorias,
        valor === 'nao_conforme' && !!row.justificativaObrigatoria,
      ),
    );
  } else {
    opcoes = [];
  }

  const configuracao = normalizarConfiguracao({
    categoria: inferirCategoria(row.grupo),
    criticidade: CriticidadeItem.MEDIA,
    tipoResposta: tipo,
    peso: normalizarPeso(row.pontuacaoMaxima),
    obrigatorio: row.respostaObrigatoria ?? true,
    permiteFoto: row.permiteFotos ?? true,
    permiteObservacao: row.permiteComentario ?? true,
    opcoes,
  });

  const pergunta: PerguntaImportada = {
    chave: `l${indice}`,
    grupo: row.grupo,
    secao: row.secao || undefined,
    pergunta: row.pergunta,
    configuracao,
  };
  const motivos: string[] = [];
  if (!reconhecido) motivos.push(`Tipo de resposta da planilha não reconhecido: "${row.tipoResposta}"`);
  if (pontuacaoAjustada) motivos.push(MOTIVO_PONTUACAO_AJUSTADA);
  if (opcaoEncurtada) motivos.push(MOTIVO_OPCAO_ENCURTADA);
  if (motivos.length) pergunta.motivoConferir = motivos.join(' ');
  return pergunta;
}

/**
 * Converte a configuração importada em campos de TemplateItem (com regras forçadas).
 */
export function configuracaoParaItem(c: ConfiguracaoPerguntaImportada): Partial<TemplateItem> {
  const item: Partial<TemplateItem> = {
    categoria: c.categoria,
    criticidade: c.criticidade,
    peso: c.peso,
    obrigatorio: c.obrigatorio,
    permiteFoto: c.permiteFoto,
    permiteObservacao: c.permiteObservacao,
  };
  aplicarTipoResposta(item, c.tipoResposta, c.opcoes);
  aplicarRegrasForcadas(item);
  return item;
}

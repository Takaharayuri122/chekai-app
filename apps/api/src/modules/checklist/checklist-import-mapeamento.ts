import { aplicarRegrasForcadas, aplicarTipoResposta, RESPOSTAS_PADRAO_VALORES, TipoRespostaLote } from './checklist-regras';
import {
  ChecklistCsvRow,
  ConfiguracaoPerguntaImportada,
  PerguntaImportada,
} from './dto/importar-checklist.dto';
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
  if (tipo === 'personalizada') {
    opcoes = opcoesPlanilha.map((o) => ({
      valor: o.texto,
      pontuacao: o.pontos ?? null,
      fotoObrigatoria: exige(row.fotosObrigatorias, o.inconformidade),
      observacaoObrigatoria: exige(row.justificativaObrigatoria, o.inconformidade),
    }));
  } else if (tipo === 'padrao') {
    opcoes = RESPOSTAS_PADRAO_VALORES.map((valor) => ({
      valor,
      pontuacao: null,
      fotoObrigatoria: valor === 'nao_conforme' && !!row.fotosObrigatorias,
      observacaoObrigatoria: valor === 'nao_conforme' && !!row.justificativaObrigatoria,
    }));
  } else {
    opcoes = [];
  }

  const configuracao = normalizarConfiguracao({
    categoria: inferirCategoria(row.grupo),
    criticidade: CriticidadeItem.MEDIA,
    tipoResposta: tipo,
    peso: row.pontuacaoMaxima ?? 1,
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
  if (!reconhecido) {
    pergunta.motivoConferir = `Tipo de resposta da planilha não reconhecido: "${row.tipoResposta}"`;
  }
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

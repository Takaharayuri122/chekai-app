import { TipoRespostaCustomizada, type AuditoriaItem, type ResultadoAuditoria } from '@/lib/api';
import { getPontuacaoMaximaItem, isOpcaoSemPontuacao } from '@/lib/checklist/pontuacao';
import { ehNaoConformidade, ehRotuloNaoAplicavel, sentidoDaOpcao } from '@/lib/checklist/sentido';
import { formatarPercentual } from './cartao-resultado.modelo';

export interface GrupoMetricas {
  grupoId: string;
  nome: string;
  pontuacaoPossivel: number;
  pontuacaoObtida: number;
  naoConformidades: number;
  naoAplicaveis: number;
  naoRespondidas: number;
  /** null quando o grupo não tem pontos possíveis */
  aproveitamento: number | null;
  itens: AuditoriaItem[];
}

export interface MetricasGerais {
  aproveitamento: number;
  pontosPossiveis: number;
  pontosRealizados: number;
  naoAplicaveis: number;
  naoConformidades: number;
  naoRespondidas: number;
}

const arredondar = (n: number) => Math.round(n * 100) / 100;

function ehNaoAplicavel(item: AuditoriaItem): boolean {
  if (!item.resposta) return false;
  return (
    sentidoDaOpcao(item.templateItem, item.resposta) === 'neutra' &&
    (item.resposta === 'nao_aplicavel' || ehRotuloNaoAplicavel(item.resposta))
  );
}

/** Mesma regra do resultado na API: N/A, não avaliado e texto não somam pontos possíveis. */
function metricasDoGrupo(grupoId: string, itens: AuditoriaItem[]): GrupoMetricas {
  const pontuaveis = itens.filter(
    (i) =>
      !isOpcaoSemPontuacao(i.resposta || '') &&
      i.templateItem?.tipoRespostaCustomizada !== TipoRespostaCustomizada.TEXTO,
  );
  const pontuacaoPossivel = pontuaveis.reduce((acc, i) => acc + getPontuacaoMaximaItem(i.templateItem), 0);
  const pontuacaoObtida = pontuaveis.reduce((acc, i) => acc + Number(i.pontuacao || 0), 0);
  return {
    grupoId,
    nome: itens[0]?.templateItem?.grupo?.nome || 'Sem Grupo',
    pontuacaoPossivel,
    pontuacaoObtida,
    naoConformidades: itens.filter((i) => ehNaoConformidade(i.templateItem, i.resposta)).length,
    naoAplicaveis: itens.filter(ehNaoAplicavel).length,
    naoRespondidas: itens.filter((i) => !i.resposta || i.resposta === 'nao_avaliado').length,
    aproveitamento: pontuacaoPossivel > 0 ? arredondar((pontuacaoObtida / pontuacaoPossivel) * 100) : null,
    itens,
  };
}

/**
 * Métricas do relatório. Com o resultado da API, os números por grupo, a linha geral
 * e os gráficos usam o mesmo cálculo do cartão e do PDF; o cálculo local é só reserva
 * enquanto o resultado não chega (ou se falhar).
 */
export function metricasDoRelatorio(
  auditoria: { itens: AuditoriaItem[]; pontuacaoTotal: number | string },
  resultado: ResultadoAuditoria | null,
): { grupos: GrupoMetricas[]; gerais: MetricasGerais } {
  const porGrupo = new Map<string, AuditoriaItem[]>();
  for (const item of auditoria.itens ?? []) {
    const chave = item.templateItem?.grupoId || 'sem-grupo';
    if (!porGrupo.has(chave)) porGrupo.set(chave, []);
    porGrupo.get(chave)!.push(item);
  }
  const locais = Array.from(porGrupo.entries())
    .map(([grupoId, itens]) => metricasDoGrupo(grupoId, itens))
    .sort((a, b) => (a.itens[0]?.templateItem?.grupo?.ordem || 0) - (b.itens[0]?.templateItem?.grupo?.ordem || 0));

  const daApi = new Map((resultado?.grupos ?? []).map((g) => [g.grupoId, g]));
  const grupos = locais.map((g): GrupoMetricas => {
    const r = daApi.get(g.grupoId);
    if (!r) return g;
    return {
      ...g,
      nome: r.nome,
      pontuacaoPossivel: r.pontosPossiveis,
      pontuacaoObtida: r.pontosRealizados,
      naoConformidades: r.naoConformidades,
      naoAplicaveis: r.naoAplicaveis,
      naoRespondidas: r.naoRespondidas,
      aproveitamento: r.aproveitamento,
    };
  });

  const soma = (campo: 'pontuacaoPossivel' | 'pontuacaoObtida' | 'naoAplicaveis' | 'naoConformidades' | 'naoRespondidas') =>
    grupos.reduce((acc, g) => acc + g[campo], 0);
  const pontuacaoTotal = Number(auditoria.pontuacaoTotal);
  const gerais: MetricasGerais = {
    aproveitamento: resultado?.aproveitamento ?? (Number.isFinite(pontuacaoTotal) ? pontuacaoTotal : 0),
    pontosPossiveis: resultado?.contadores.pontosPossiveis ?? soma('pontuacaoPossivel'),
    pontosRealizados: resultado?.contadores.pontosRealizados ?? soma('pontuacaoObtida'),
    naoConformidades: resultado?.contadores.naoConformidades ?? soma('naoConformidades'),
    naoAplicaveis: soma('naoAplicaveis'),
    naoRespondidas: soma('naoRespondidas'),
  };
  return { grupos, gerais };
}

/** Aproveitamento de um grupo para tabela e cartões: "—" quando não há pontos possíveis. */
export function formatarAproveitamentoGrupo(aproveitamento: number | null): string {
  return aproveitamento === null ? '—' : formatarPercentual(aproveitamento);
}

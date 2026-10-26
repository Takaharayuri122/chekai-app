import { describe, it, expect } from 'vitest';
import { TipoRespostaCustomizada, type AuditoriaItem, type ResultadoAuditoria, type TemplateItem } from '@/lib/api';
import { formatarAproveitamentoGrupo, metricasDoRelatorio } from './metricas-relatorio';

const tpl = (grupoId: string, ordem: number, extra: Partial<TemplateItem> = {}) =>
  ({ grupoId, grupo: { id: grupoId, nome: `Grupo ${grupoId}`, ordem }, usarRespostasPersonalizadas: false, ...extra }) as TemplateItem;

const item = (id: string, resposta: string, pontuacao: number, templateItem: TemplateItem) =>
  ({ id, resposta, pontuacao, templateItem, fotos: [] }) as unknown as AuditoriaItem;

const itens = [
  item('1', 'conforme', 1, tpl('b', 2)),
  item('2', 'nao_conforme', 0, tpl('b', 2)),
  item('3', 'nao_aplicavel', 0, tpl('b', 2)),
  item('4', 'conforme', 1, tpl('a', 1)),
  item('5', 'texto livre', 0, tpl('a', 1, { tipoRespostaCustomizada: TipoRespostaCustomizada.TEXTO })),
  item('6', 'nao_avaliado', 0, tpl('a', 1)),
];

describe('metricasDoRelatorio sem resultado (cálculo local de reserva)', () => {
  const { grupos, gerais } = metricasDoRelatorio({ itens, pontuacaoTotal: '66.67' }, null);

  it('ordena os grupos pela ordem do checklist', () => {
    expect(grupos.map((g) => g.grupoId)).toEqual(['a', 'b']);
  });

  it('N/A, não avaliado e texto não somam pontos possíveis', () => {
    expect(grupos[1]).toMatchObject({ pontuacaoPossivel: 2, pontuacaoObtida: 1, naoConformidades: 1, naoAplicaveis: 1, aproveitamento: 50 });
    expect(grupos[0]).toMatchObject({ pontuacaoPossivel: 1, pontuacaoObtida: 1, naoRespondidas: 1, aproveitamento: 100 });
  });

  it('linha geral soma os grupos e usa a pontuação gravada na auditoria', () => {
    expect(gerais).toEqual({
      aproveitamento: 66.67,
      pontosPossiveis: 3,
      pontosRealizados: 2,
      naoConformidades: 1,
      naoAplicaveis: 1,
      naoRespondidas: 1,
    });
  });
});

describe('metricasDoRelatorio com resultado da API', () => {
  const resultado: ResultadoAuditoria = {
    aproveitamento: 80,
    classificacao: { nome: 'Bom', cor: '#65A30D', emoji: '🟢' },
    faixas: [],
    tendencia: null,
    anteriores: [],
    contadores: { pontosPossiveis: 10, pontosRealizados: 8, naoConformidades: 3, fotos: 0, planosAcao: 0 },
    grupos: [
      { grupoId: 'b', nome: 'Grupo B', aproveitamento: 75, pontosPossiveis: 4, pontosRealizados: 3, naoAplicaveis: 2, naoConformidades: 1, naoRespondidas: 0 },
      { grupoId: 'a', nome: 'Grupo A', aproveitamento: null, pontosPossiveis: 0, pontosRealizados: 0, naoAplicaveis: 0, naoConformidades: 2, naoRespondidas: 4 },
    ],
  };
  const { grupos, gerais } = metricasDoRelatorio({ itens, pontuacaoTotal: 10 }, resultado);

  it('os números de cada grupo vêm do resultado, casados por grupoId', () => {
    expect(grupos[1]).toMatchObject({ grupoId: 'b', pontuacaoPossivel: 4, pontuacaoObtida: 3, naoAplicaveis: 2, aproveitamento: 75 });
    expect(grupos[0]).toMatchObject({ grupoId: 'a', aproveitamento: null, naoRespondidas: 4 });
  });

  it('mantém os itens do grupo para a listagem', () => {
    expect(grupos[1].itens.map((i) => i.id)).toEqual(['1', '2', '3']);
  });

  it('linha geral usa aproveitamento e contadores do resultado', () => {
    expect(gerais).toEqual({
      aproveitamento: 80,
      pontosPossiveis: 10,
      pontosRealizados: 8,
      naoConformidades: 3,
      naoAplicaveis: 2,
      naoRespondidas: 4,
    });
  });
});

describe('formatarAproveitamentoGrupo', () => {
  it('mostra "—" quando o grupo não tem pontos possíveis', () => {
    expect(formatarAproveitamentoGrupo(null)).toBe('—');
    expect(formatarAproveitamentoGrupo(75)).toBe('75,00%');
  });
});

import { RelatorioHtmlService } from './relatorio-html.service';
import { ResultadoAuditoria } from './resultado-auditoria.service';
import { TipoLegislacao } from '../../legislacao/entities/legislacao.entity';
import { FAIXAS_PADRAO } from '../../checklist/regras';

const resultadoBase = (extra: Partial<ResultadoAuditoria> = {}): ResultadoAuditoria => ({
  aproveitamento: 50,
  classificacao: { nome: 'Crítico', cor: '#DC2626', emoji: '🔴' },
  faixas: FAIXAS_PADRAO.map((f) => ({ ...f })),
  tendencia: null,
  anteriores: [],
  contadores: { pontosPossiveis: 4, pontosRealizados: 2, naoConformidades: 1, fotos: 3, planosAcao: 2 },
  grupos: [
    {
      grupoId: 'g1',
      nome: 'Grupo',
      aproveitamento: 50,
      pontosPossiveis: 4,
      pontosRealizados: 2,
      naoAplicaveis: 1,
      naoConformidades: 1,
      naoRespondidas: 0,
    },
  ],
  ...extra,
});

function auditoriaCom(resposta: string, legislacoes: unknown[] = [], templateItem: Record<string, unknown> = {}) {
  return {
    id: 'abcdef12-0000-0000-0000-000000000000',
    pontuacaoTotal: 50,
    dataInicio: new Date('2026-10-20T12:00:00Z'),
    dataFim: new Date('2026-10-20T13:30:00Z'),
    latitudeInicio: -23.5505,
    longitudeInicio: -46.6333,
    template: { nome: 'Checklist de cozinha' },
    unidade: { nome: 'Unidade', responsavel: 'Maria Responsável', cliente: { nomeFantasia: 'Cliente' } },
    consultor: { nome: 'Auditor' },
    itens: [
      {
        id: 'i1',
        resposta,
        legislacoes,
        fotos: [],
        templateItem: {
          pergunta: 'Pergunta?',
          grupoId: 'g1',
          grupo: { id: 'g1', nome: 'Grupo', ordem: 1 },
          ...templateItem,
        },
      },
    ],
  } as any;
}

const rdc = { tipo: TipoLegislacao.RDC, numero: '216', ano: 2004, titulo: 'Boas práticas' };

describe('RelatorioHtmlService - legislação do item', () => {
  const service = new RelatorioHtmlService();

  it('mostra a norma no item não conforme', () => {
    const html = service.gerarHtml(auditoriaCom('nao_conforme', [rdc]), resultadoBase());
    expect(html).toMatch(/Legislação: <\/span>\s*<span class="item-detail-value">RDC 216\/2004/);
  });

  it('escapa o nome da norma', () => {
    const html = service.gerarHtml(
      auditoriaCom('nao_conforme', [{ ...rdc, tipo: TipoLegislacao.OUTRO, titulo: '<b>X</b>' }]),
      resultadoBase(),
    );
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(html).not.toContain('<b>X</b>');
  });

  it('não mostra a legislação em item conforme', () => {
    const html = service.gerarHtml(auditoriaCom('conforme', [rdc]), resultadoBase());
    expect(html).not.toContain('Legislação:');
  });
});

describe('RelatorioHtmlService - conteúdo da avaliação', () => {
  const service = new RelatorioHtmlService();

  it('mostra dados da avaliação, código e link do mapa', () => {
    const html = service.gerarHtml(auditoriaCom('conforme'), resultadoBase());
    expect(html).toContain('Checklist de cozinha');
    expect(html).toContain('ABCDEF12');
    expect(html).toContain('Duração: 1 h 30 min');
    expect(html).toContain('https://www.google.com/maps?q=-23.5505,-46.6333');
  });

  it('sem coordenadas não há link de mapa', () => {
    const auditoria = { ...auditoriaCom('conforme'), latitudeInicio: null, longitudeInicio: null };
    expect(service.gerarHtml(auditoria, resultadoBase())).not.toContain('google.com/maps');
  });

  it('cartão com percentual, faixa, tendência, anteriores e contadores', () => {
    const html = service.gerarHtml(
      auditoriaCom('conforme'),
      resultadoBase({
        aproveitamento: 82.5,
        classificacao: { nome: 'Bom', cor: '#65A30D', emoji: '🟢' },
        tendencia: 'subiu',
        anteriores: [{ id: 'x', dataFim: '2026-09-10T12:00:00Z', aproveitamento: 70 }],
      }),
    );
    expect(html).toContain('82,50%');
    expect(html).toContain('▲');
    expect(html).toContain('Bom');
    expect(html).toContain('10/09/26');
    expect(html).toContain('70,00%');
    expect(html.match(/class="faixa-segmento"/g)).toHaveLength(5);
    expect(html).toContain('class="faixa-marcador"');
  });

  it('tabela por grupo com NA/NR, linha Geral e legenda', () => {
    const html = service.gerarHtml(auditoriaCom('conforme'), resultadoBase());
    expect(html).toContain('NA: Não aplicáveis');
    expect(html).toContain('NR: Não respondidas');
    expect(html).toContain('<td>Geral</td>');
  });

  it('página final com resumo e assinaturas do auditor e do responsável', () => {
    const html = service.gerarHtml(auditoriaCom('conforme'), resultadoBase());
    expect(html).toContain('RESUMO DA AVALIAÇÃO');
    expect(html).toContain('____________________, ____ de ______________ de ________');
    expect(html).toMatch(/class="assinatura">Auditor</);
    expect(html).toMatch(/class="assinatura">Maria Responsável</);
  });
});

describe('RelatorioHtmlService - ícone da resposta', () => {
  const service = new RelatorioHtmlService();
  const sim_nao = { usarRespostasPersonalizadas: true, opcoesResposta: ['Sim', 'Não'], opcoesRespostaConfig: [] };

  it('"Não" de Sim/Não renderiza o ícone de negativa', () => {
    const html = service.gerarHtml(auditoriaCom('Não', [], sim_nao), resultadoBase());
    expect(html).toContain('<div class="item-icon nao-conforme">✗</div>');
  });

  it('"Sim" de Sim/Não renderiza o ícone de positiva', () => {
    const html = service.gerarHtml(auditoriaCom('Sim', [], sim_nao), resultadoBase());
    expect(html).toContain('<div class="item-icon conforme">✓</div>');
  });

  it('usa o ícone configurado na opção', () => {
    const html = service.gerarHtml(
      auditoriaCom('Não', [], {
        ...sim_nao,
        opcoesRespostaConfig: [{ valor: 'Não', fotoObrigatoria: false, observacaoObrigatoria: false, icone: '👎' }],
      }),
      resultadoBase(),
    );
    expect(html).toContain('<div class="item-icon nao-conforme">👎</div>');
  });

  it('resolve o código do ícone do catálogo', () => {
    const html = service.gerarHtml(
      auditoriaCom('Sim', [], {
        ...sim_nao,
        opcoesRespostaConfig: [
          { valor: 'Sim', fotoObrigatoria: false, observacaoObrigatoria: false, icone: 'polegar-cima' },
        ],
      }),
      resultadoBase(),
    );
    expect(html).toContain('<div class="item-icon conforme">👍</div>');
  });

  it('neutra usa traço e não respondida usa "?"', () => {
    expect(service.gerarHtml(auditoriaCom('nao_aplicavel'), resultadoBase())).toContain(
      '<div class="item-icon nao-aplicavel">—</div>',
    );
    expect(service.gerarHtml(auditoriaCom('nao_avaliado'), resultadoBase())).toContain(
      '<div class="item-icon nao-respondida">?</div>',
    );
  });
});

describe('RelatorioHtmlService - grupos casados pela chave', () => {
  it('usa as métricas do grupo certo mesmo com ordem diferente da lista de métricas', () => {
    const item = (id: string, grupoId: string, nome: string, ordem: number) => ({
      id, resposta: 'conforme', legislacoes: [], fotos: [],
      templateItem: { pergunta: id, grupoId, grupo: { id: grupoId, nome, ordem } },
    });
    const auditoria = {
      ...auditoriaCom('conforme'),
      itens: [item('p1', 'gA', 'Alfa', 2), item('p2', 'gB', 'Beta', 1)],
    };
    const metrica = (grupoId: string, nome: string, aproveitamento: number) => ({
      grupoId, nome, aproveitamento, pontosPossiveis: 1, pontosRealizados: 1,
      naoAplicaveis: 0, naoConformidades: 0, naoRespondidas: 0,
    });
    const html = new RelatorioHtmlService().gerarHtml(
      auditoria,
      resultadoBase({ grupos: [metrica('gA', 'Alfa', 11), metrica('gB', 'Beta', 22)] }),
    );
    const secaoBeta = html.slice(html.indexOf('<h3 class="grupo-title">Beta'));
    expect(secaoBeta).toContain('22,00%');
    expect(secaoBeta.slice(0, secaoBeta.indexOf('Alfa'))).not.toContain('11,00%');
  });
});

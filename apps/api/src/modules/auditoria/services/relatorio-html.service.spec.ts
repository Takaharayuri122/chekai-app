import { RelatorioHtmlService } from './relatorio-html.service';
import { TipoLegislacao } from '../../legislacao/entities/legislacao.entity';

function auditoriaCom(resposta: string, legislacoes: unknown[]) {
  return {
    id: 'a1',
    pontuacaoTotal: 50,
    unidade: { nome: 'Unidade', cliente: { nome: 'Cliente' } },
    consultor: { nome: 'Auditor' },
    itens: [
      {
        id: 'i1',
        resposta,
        pontuacaoMaxima: 1,
        pontuacaoObtida: 0,
        legislacoes,
        fotos: [],
        templateItem: {
          pergunta: 'Pergunta?',
          grupo: { id: 'g1', nome: 'Grupo', ordem: 1 },
        },
      },
    ],
  } as any;
}

const rdc = { tipo: TipoLegislacao.RDC, numero: '216', ano: 2004, titulo: 'Boas práticas' };

describe('RelatorioHtmlService - legislação do item', () => {
  const service = new RelatorioHtmlService();

  it('mostra a norma no item não conforme', () => {
    const html = service.gerarHtml(auditoriaCom('nao_conforme', [rdc]));
    expect(html).toMatch(/Legislação: <\/span>\s*<span class="item-detail-value">RDC 216\/2004/);
  });

  it('escapa o nome da norma', () => {
    const html = service.gerarHtml(
      auditoriaCom('nao_conforme', [{ ...rdc, tipo: TipoLegislacao.OUTRO, titulo: '<b>X</b>' }]),
    );
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;');
    expect(html).not.toContain('<b>X</b>');
  });

  it('não mostra a legislação em item conforme', () => {
    const html = service.gerarHtml(auditoriaCom('conforme', [rdc]));
    expect(html).not.toContain('Legislação:');
  });
});

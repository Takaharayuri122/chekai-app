import { RelatorioTecnico } from '../entities/relatorio-tecnico.entity';
import { ModeloSecao, mesclarComPadrao, modeloPadrao } from '../modelo-secoes';
import { RelatorioTecnicoHtmlService } from './relatorio-tecnico-html.service';

const relatorio = {
  id: 'r1',
  cliente: { nomeFantasia: 'Padaria Central' },
  unidade: { nome: 'Matriz' },
  criadoEm: new Date('2026-10-20T12:00:00Z'),
  identificacao: 'Cozinha',
  descricaoOcorrenciaHtml: '<p>DESC-OCORRENCIA</p>',
  avaliacaoTecnicaHtml: '<p>CONTEUDO-AVALIACAO</p>',
  acoesExecutadas: ['Limpeza'],
  recomendacoesConsultoraHtml: '<p>REC</p>',
  planoAcaoSugeridoHtml: '<p>PLANO</p>',
  apoioAnaliticoChekAi: '',
  assinaturaNomeConsultora: 'Ana',
  responsavel: 'João',
  fotos: [],
} as unknown as RelatorioTecnico;

function titulosH2(html: string): string[] {
  return [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]);
}

describe('RelatorioTecnicoHtmlService com modelo', () => {
  const service = new RelatorioTecnicoHtmlService();

  it('com o modelo padrão mantém as 9 seções na ordem atual', () => {
    expect(titulosH2(service.gerarHtml(relatorio, undefined, modeloPadrao()))).toEqual([
      'Identificação',
      'Descrição da Ocorrência',
      'Evidências Fotográficas',
      'Avaliação Técnica',
      'Ações Executadas na Visita',
      'Recomendações da Consultora',
      'Plano de Ação Sugerido',
      'Apoio Analítico ChekAi',
      'Assinaturas',
    ]);
  });

  it('sem modelo informado usa o padrão', () => {
    expect(titulosH2(service.gerarHtml(relatorio))).toHaveLength(9);
  });

  it('omite seção desligada e usa título personalizado', () => {
    const modelo = mesclarComPadrao([
      { secao: 'avaliacaoTecnica', ativa: false, titulo: '' },
      { secao: 'recomendacoesConsultora', ativa: true, titulo: 'Retorno do Cliente' },
    ]);
    const html = service.gerarHtml(relatorio, undefined, modelo);
    expect(html).not.toContain('Avaliação Técnica');
    expect(html).not.toContain('CONTEUDO-AVALIACAO');
    expect(titulosH2(html)).toContain('Retorno do Cliente');
  });

  it('escapa HTML no título personalizado', () => {
    const modelo: ModeloSecao[] = modeloPadrao().map((s) =>
      s.secao === 'recomendacoesConsultora' ? { ...s, titulo: '<script>x</script>' } : s,
    );
    const html = service.gerarHtml(relatorio, undefined, modelo);
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>x');
  });
});

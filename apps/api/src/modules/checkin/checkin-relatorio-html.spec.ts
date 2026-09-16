import { AgruparHorasCheckin } from './dto/relatorio-horas-checkin.dto';
import { montarHtmlRelatorioHoras } from './checkin-relatorio-html';
import { RelatorioHorasCheckin } from './checkin.service';

describe('montarHtmlRelatorioHoras', () => {
  it('deve incluir totais e nome do agrupamento no HTML', () => {
    const relatorio: RelatorioHorasCheckin = {
      agruparPor: AgruparHorasCheckin.CLIENTE,
      dataInicio: '2026-09-01',
      dataFim: '2026-09-15',
      totalGeralMinutos: 90,
      itens: [{
        id: 'cliente-1',
        nome: 'Padaria Central',
        quantidade: 2,
        minutosFechados: 60,
        minutosAbertos: 30,
        minutosTotal: 90,
      }],
    };
    const html = montarHtmlRelatorioHoras(relatorio);
    expect(html).toContain('Padaria Central');
    expect(html).toContain('1h 30min');
    expect(html).toContain('agrupado por cliente');
  });
});

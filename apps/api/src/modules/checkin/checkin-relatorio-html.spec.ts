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
        quantidadeOffline: 0,
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

  it('inclui a quantidade de marcações offline', () => {
    const relatorio: RelatorioHorasCheckin = {
      agruparPor: AgruparHorasCheckin.USUARIO,
      dataInicio: '2026-09-01',
      dataFim: '2026-09-15',
      totalGeralMinutos: 60,
      itens: [{
        id: 'u-1',
        nome: 'Ana Auditora',
        quantidade: 5,
        quantidadeOffline: 3,
        minutosFechados: 60,
        minutosAbertos: 0,
        minutosTotal: 60,
      }],
    };
    const html = montarHtmlRelatorioHoras(relatorio);
    expect(html).toContain('<th>Offline</th>');
    expect(html).toContain('<td>3</td>');
  });
});

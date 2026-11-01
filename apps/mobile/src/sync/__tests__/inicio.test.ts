import { dataLocalISO, filtrarAgendaDoDia, filtrarEmAndamento, filtrarTarefasAtrasadas } from '../../utils/inicio';

describe('Início do app (mesmas regras do web)', () => {
  it('dataLocalISO usa a data local no formato AAAA-MM-DD', () => {
    expect(dataLocalISO(new Date(2026, 10, 1, 23, 30))).toBe('2026-11-01');
  });

  it('mostra até 3 auditorias em andamento', () => {
    const itens = ['em_andamento', 'concluida', 'em_andamento', 'em_andamento', 'em_andamento'].map((status, i) => ({ id: String(i), status }));
    expect(filtrarEmAndamento(itens).map((a) => a.id)).toEqual(['0', '2', '3']);
  });

  it('agenda: visitas de hoje e atrasadas, até 5', () => {
    const itens = [
      { id: 'a', dataPrevista: '2026-10-30T12:00:00.000Z' },
      { id: 'b', dataPrevista: '2026-11-01T09:00:00.000Z' },
      { id: 'c', dataPrevista: '2026-11-02T09:00:00.000Z' },
    ];
    expect(filtrarAgendaDoDia(itens, '2026-11-01').map((g) => g.id)).toEqual(['a', 'b']);
  });

  it('tarefas: pendentes ou em andamento com prazo vencido, até 5', () => {
    const itens = [
      { id: 'a', status: 'pendente', prazo: '2026-10-31' },
      { id: 'b', status: 'concluida', prazo: '2026-10-01' },
      { id: 'c', status: 'em_andamento', prazo: '2026-10-15' },
      { id: 'd', status: 'pendente', prazo: '2026-11-01' },
    ];
    expect(filtrarTarefasAtrasadas(itens, '2026-11-01').map((t) => t.id)).toEqual(['a', 'c']);
  });
});

import { describe, expect, it } from 'vitest';
import { intervaloGrade, montarGradeMes } from './calendario';

const ag = (id: string, dataPrevista: string) => ({ id, dataPrevista });

describe('intervaloGrade', () => {
  it('cobre da segunda anterior ao dia 1 até o domingo após o último dia', () => {
    // outubro/2026: dia 1 é quinta, dia 31 é sábado
    expect(intervaloGrade(2026, 9)).toEqual({ de: '2026-09-28', ate: '2026-11-01' });
  });
  it('mês que começa na segunda não inclui dias do mês anterior', () => {
    // junho/2026: dia 1 é segunda
    expect(intervaloGrade(2026, 5).de).toBe('2026-06-01');
  });
});

describe('montarGradeMes', () => {
  it('monta semanas completas de segunda a domingo', () => {
    const semanas = montarGradeMes(2026, 9, [], '2026-10-17');
    expect(semanas).toHaveLength(5);
    expect(semanas.every((s) => s.length === 7)).toBe(true);
    expect(semanas[0][0]).toMatchObject({ iso: '2026-09-28', doMes: false });
    expect(semanas[0][3]).toMatchObject({ iso: '2026-10-01', dia: 1, doMes: true });
  });
  it('marca hoje e agrupa agendamentos por dia', () => {
    const semanas = montarGradeMes(2026, 9, [ag('a', '2026-10-17'), ag('b', '2026-10-17T00:00:00.000Z'), ag('c', '2026-10-20')], '2026-10-17');
    const dias = semanas.flat();
    const dia17 = dias.find((d) => d.iso === '2026-10-17')!;
    expect(dia17.hoje).toBe(true);
    expect(dia17.itens.map((i) => i.id)).toEqual(['a', 'b']);
    expect(dias.find((d) => d.iso === '2026-10-20')!.itens).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import { dataLocalISO, formatarDataBr } from './datas';

describe('dataLocalISO', () => {
  it('usa o dia local, não o UTC', () => {
    const d = new Date(2026, 9, 17, 23, 30);
    expect(dataLocalISO(d)).toBe('2026-10-17');
  });
  it('preenche mês e dia com zero', () => {
    expect(dataLocalISO(new Date(2026, 0, 5, 8))).toBe('2026-01-05');
  });
});

describe('formatarDataBr', () => {
  it('converte yyyy-mm-dd e ignora horário', () => {
    expect(formatarDataBr('2026-10-07')).toBe('07/10/2026');
    expect(formatarDataBr('2026-10-07T03:00:00.000Z')).toBe('07/10/2026');
  });
});

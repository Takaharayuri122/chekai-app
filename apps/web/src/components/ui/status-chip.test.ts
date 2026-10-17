import { describe, expect, it } from 'vitest';
import { getTomStatus, rotuloStatus } from './status-chip';

describe('getTomStatus', () => {
  it('mapeia status de sucesso, alerta, perigo e neutro', () => {
    expect(getTomStatus('conforme')).toBe('sucesso');
    expect(getTomStatus('finalizada')).toBe('sucesso');
    expect(getTomStatus('concluida')).toBe('sucesso');
    expect(getTomStatus('em_andamento')).toBe('alerta');
    expect(getTomStatus('pendente')).toBe('alerta');
    expect(getTomStatus('nao_conforme')).toBe('perigo');
    expect(getTomStatus('atrasada')).toBe('perigo');
    expect(getTomStatus('agendada')).toBe('info');
    expect(getTomStatus('nao_aplicavel')).toBe('neutro');
    expect(getTomStatus('cancelada')).toBe('neutro');
  });
  it('status desconhecido é neutro', () => {
    expect(getTomStatus('qualquer')).toBe('neutro');
  });
});

describe('rotuloStatus', () => {
  it('usa rótulo conhecido ou humaniza o valor', () => {
    expect(rotuloStatus('nao_conforme')).toBe('Não conforme');
    expect(rotuloStatus('outro_valor')).toBe('Outro valor');
  });
});

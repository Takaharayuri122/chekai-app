import { RecorrenciaAgenda } from './entities/agenda-auditoria.entity';
import { proximaDataRecorrencia } from './agenda.service';

describe('proximaDataRecorrencia', () => {
  it('retorna null sem recorrência', () => {
    expect(proximaDataRecorrencia('2026-10-16', RecorrenciaAgenda.NENHUMA)).toBeNull();
  });

  it('soma 7 e 14 dias', () => {
    expect(proximaDataRecorrencia('2026-10-16', RecorrenciaAgenda.SEMANAL)).toBe('2026-10-23');
    expect(proximaDataRecorrencia('2026-10-16', RecorrenciaAgenda.QUINZENAL)).toBe('2026-10-30');
  });

  it('mensal respeita o último dia do mês', () => {
    expect(proximaDataRecorrencia('2026-01-31', RecorrenciaAgenda.MENSAL)).toBe('2026-02-28');
    expect(proximaDataRecorrencia('2026-12-15', RecorrenciaAgenda.MENSAL)).toBe('2027-01-15');
  });
});

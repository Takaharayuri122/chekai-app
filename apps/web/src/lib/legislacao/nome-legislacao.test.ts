import { describe, expect, it } from 'vitest';
import { TipoLegislacao } from '@/lib/api';
import { nomeCurtoLegislacao, SIGLAS_TIPO } from './nome-legislacao';

describe('nomeCurtoLegislacao', () => {
  it('monta sigla, número e ano', () => {
    expect(nomeCurtoLegislacao({ tipo: TipoLegislacao.RDC, numero: '216', ano: 2004, titulo: 'x' })).toBe('RDC 216/2004');
    expect(nomeCurtoLegislacao({ tipo: TipoLegislacao.LEI, numero: '8.078', ano: 1990, titulo: 'x' })).toBe('Lei 8.078/1990');
  });

  it('usa o título quando o tipo é outro ou falta número', () => {
    expect(nomeCurtoLegislacao({ tipo: TipoLegislacao.OUTRO, titulo: 'Código Sanitário' })).toBe('Código Sanitário');
    expect(nomeCurtoLegislacao({ tipo: TipoLegislacao.RDC, titulo: 'Boas Práticas' })).toBe('Boas Práticas');
  });

  it('omite o ano quando ausente', () => {
    expect(nomeCurtoLegislacao({ tipo: TipoLegislacao.PORTARIA, numero: '5', ano: null, titulo: 'x' })).toBe('Portaria 5');
  });

  it('expõe as siglas por tipo', () => {
    expect(SIGLAS_TIPO).toEqual({
      rdc: 'RDC',
      portaria: 'Portaria',
      instrucao_normativa: 'IN',
      lei: 'Lei',
      decreto: 'Decreto',
      outro: '',
    });
  });
});

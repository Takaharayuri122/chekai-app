import { describe, expect, it } from 'vitest';
import { alternarSelecao, filtrarOpcoes } from './selecao';
import type { LegislacaoOpcao } from '@/lib/api';

const opcoes: LegislacaoOpcao[] = [
  { id: '1', nome: 'RDC 216/2004', titulo: 'Regulamento Técnico de Boas Práticas para Serviços de Alimentação', situacao: 'vigente' },
  { id: '2', nome: 'Portaria CVS 5/2013', titulo: 'Regulamento técnico de boas práticas', situacao: 'vigente' },
];

describe('alternarSelecao', () => {
  it('adiciona ao final e remove preservando a ordem', () => {
    expect(alternarSelecao(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(alternarSelecao(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
});

describe('filtrarOpcoes', () => {
  it('acha pelo nome', () => {
    expect(filtrarOpcoes(opcoes, 'rdc 216').map((o) => o.id)).toEqual(['1']);
  });
  it('acha pelo título acentuado sem acento', () => {
    expect(filtrarOpcoes(opcoes, 'boas praticas').map((o) => o.id)).toEqual(['1', '2']);
    expect(filtrarOpcoes(opcoes, 'TÉCNICO').length).toBe(2);
  });
  it('busca vazia devolve tudo', () => {
    expect(filtrarOpcoes(opcoes, '  ')).toHaveLength(2);
  });
});

import { describe, expect, it } from 'vitest';
import type { Auditoria } from '@/lib/api';
import { FILTROS_AUDITORIA_VAZIOS, contarFiltrosAtivos, contemTexto, filtrarAuditorias } from './listagem';

const aud = (p: Partial<{ id: string; status: string; dataInicio: string; unidade: string; cliente: string; template: string; consultor: string }>) =>
  ({
    id: p.id ?? 'a',
    status: p.status ?? 'em_andamento',
    dataInicio: p.dataInicio ?? '2026-10-10T12:00:00Z',
    unidade: { id: `u-${p.unidade ?? 'x'}`, nome: p.unidade ?? 'Loja Centro', cliente: { nomeFantasia: p.cliente ?? 'Padaria São João' } },
    template: { id: `t-${p.template ?? 'x'}`, nome: p.template ?? 'Boas Práticas' },
    consultor: { id: `c-${p.consultor ?? 'x'}`, nome: p.consultor ?? 'Ana' },
    itens: [],
  }) as unknown as Auditoria;

describe('contemTexto', () => {
  it('ignora acentos e maiúsculas', () => {
    expect(contemTexto('Padaria São João', 'sao joao')).toBe(true);
    expect(contemTexto(undefined, 'x')).toBe(false);
    expect(contemTexto('qualquer', '  ')).toBe(true);
  });
});

describe('filtrarAuditorias', () => {
  const lista = [
    aud({ id: '1', status: 'finalizada', cliente: 'Padaria São João', dataInicio: '2026-10-01T12:00:00Z' }),
    aud({ id: '2', status: 'em_andamento', unidade: 'Shopping', dataInicio: '2026-10-15T12:00:00Z', consultor: 'Bia' }),
  ];
  it('sem filtros retorna tudo', () => {
    expect(filtrarAuditorias(lista, FILTROS_AUDITORIA_VAZIOS)).toHaveLength(2);
  });
  it('filtra por status, busca, período e avaliador', () => {
    expect(filtrarAuditorias(lista, { ...FILTROS_AUDITORIA_VAZIOS, status: 'finalizada' }).map((a) => a.id)).toEqual(['1']);
    expect(filtrarAuditorias(lista, { ...FILTROS_AUDITORIA_VAZIOS, busca: 'shopping' }).map((a) => a.id)).toEqual(['2']);
    expect(filtrarAuditorias(lista, { ...FILTROS_AUDITORIA_VAZIOS, de: '2026-10-10' }).map((a) => a.id)).toEqual(['2']);
    expect(filtrarAuditorias(lista, { ...FILTROS_AUDITORIA_VAZIOS, ate: '2026-10-10' }).map((a) => a.id)).toEqual(['1']);
    expect(filtrarAuditorias(lista, { ...FILTROS_AUDITORIA_VAZIOS, avaliadorId: 'c-Bia' }).map((a) => a.id)).toEqual(['2']);
  });
});

describe('contarFiltrosAtivos', () => {
  it('conta filtros exceto busca', () => {
    expect(contarFiltrosAtivos(FILTROS_AUDITORIA_VAZIOS)).toBe(0);
    expect(contarFiltrosAtivos({ ...FILTROS_AUDITORIA_VAZIOS, busca: 'x', status: 'finalizada', de: '2026-01-01' })).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import type { Auditoria } from '@/lib/api';
import {
  avaliacoesPorMes,
  filtrarDashboard,
  mediaAproveitamento,
  rankingAvaliadores,
  rankingUnidades,
  resumoPorChecklist,
} from './agregacoes';

const a = (p: { id: string; status?: string; data: string; nota?: number; unidade?: string; consultor?: string; template?: string }) =>
  ({
    id: p.id,
    status: p.status ?? 'finalizada',
    dataInicio: p.data,
    pontuacaoTotal: p.nota ?? 0,
    unidade: { id: p.unidade ?? 'u1', nome: `Unidade ${p.unidade ?? 'u1'}` },
    consultor: { id: p.consultor ?? 'c1', nome: `Pessoa ${p.consultor ?? 'c1'}` },
    template: { id: p.template ?? 't1', nome: `Checklist ${p.template ?? 't1'}` },
    itens: [],
  }) as unknown as Auditoria;

const lista = [
  a({ id: '1', data: '2026-09-10T12:00:00', nota: 80, unidade: 'u1', consultor: 'c1' }),
  a({ id: '2', data: '2026-10-02T12:00:00', nota: 60, unidade: 'u1', consultor: 'c2' }),
  a({ id: '3', data: '2026-10-05T12:00:00', nota: 90, unidade: 'u2', consultor: 'c1', template: 't2' }),
  a({ id: '4', data: '2026-10-06T12:00:00', status: 'em_andamento', unidade: 'u3', consultor: 'c1' }),
];

describe('filtrarDashboard', () => {
  it('filtra período, checklist e unidade', () => {
    const base = { inicio: '2026-10-01', fim: '2026-10-31', templateId: '', unidadeId: '' };
    expect(filtrarDashboard(lista, base).map((x) => x.id)).toEqual(['2', '3', '4']);
    expect(filtrarDashboard(lista, { ...base, templateId: 't2' }).map((x) => x.id)).toEqual(['3']);
    expect(filtrarDashboard(lista, { ...base, unidadeId: 'u1' }).map((x) => x.id)).toEqual(['2']);
  });
});

describe('mediaAproveitamento', () => {
  it('média só das finalizadas; null sem finalizadas', () => {
    expect(mediaAproveitamento(lista)).toBeCloseTo(76.67, 1);
    expect(mediaAproveitamento([lista[3]])).toBeNull();
  });
});

describe('avaliacoesPorMes', () => {
  it('agrupa por mês em ordem cronológica', () => {
    expect(avaliacoesPorMes(lista).map((m) => [m.mes, m.total])).toEqual([['09/26', 1], ['10/26', 3]]);
  });
});

describe('rankingAvaliadores', () => {
  it('ordena por quantidade', () => {
    expect(rankingAvaliadores(lista).map((r) => [r.nome, r.total])).toEqual([['Pessoa c1', 3], ['Pessoa c2', 1]]);
  });
});

describe('rankingUnidades', () => {
  it('usa só finalizadas, última nota cronológica e média', () => {
    const r = rankingUnidades(lista);
    expect(r.map((u) => u.id)).toEqual(['u2', 'u1']);
    expect(r[1]).toMatchObject({ ultima: 60, media: 70, total: 2 });
  });
  it('vazio sem finalizadas', () => {
    expect(rankingUnidades([lista[3]])).toEqual([]);
  });
});

describe('resumoPorChecklist', () => {
  it('conta total, finalizadas e média', () => {
    expect(resumoPorChecklist(lista)).toEqual([
      { id: 't1', nome: 'Checklist t1', total: 3, finalizadas: 2, media: 70 },
      { id: 't2', nome: 'Checklist t2', total: 1, finalizadas: 1, media: 90 },
    ]);
  });
});

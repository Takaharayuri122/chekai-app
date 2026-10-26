import { describe, it, expect } from 'vitest';
import { FAIXAS_PADRAO } from '@/lib/checklist/faixas';
import {
  adicionarFaixa,
  avaliarRascunho,
  lerDecimal,
  rascunhoDeFaixas,
  removerFaixa,
  type RascunhoFaixa,
} from './editor-faixas-classificacao.logic';

describe('lerDecimal', () => {
  it('aceita vírgula e ponto', () => {
    expect(lerDecimal('59,99')).toBe(59.99);
    expect(lerDecimal(' 60.5 ')).toBe(60.5);
    expect(lerDecimal('70')).toBe(70);
  });
  it('devolve NaN para texto inválido ou vazio', () => {
    expect(lerDecimal('')).toBeNaN();
    expect(lerDecimal('abc')).toBeNaN();
    expect(lerDecimal('1,2,3')).toBeNaN();
  });
});

describe('rascunhoDeFaixas', () => {
  it('usa o padrão quando nulo, com números como texto', () => {
    const r = rascunhoDeFaixas(null);
    expect(r).toHaveLength(FAIXAS_PADRAO.length);
    expect(r[0]).toMatchObject({ nome: 'Crítico', de: '0', ate: '59,99' });
  });
});

describe('avaliarRascunho', () => {
  it('padrão sem edição é válido e não tem lacunas', () => {
    const a = avaliarRascunho(rascunhoDeFaixas(null));
    expect(a.valido).toBe(true);
    expect(a.erros).toEqual([]);
    expect(a.lacunas).toEqual([]);
    expect(a.faixas).toHaveLength(5);
  });

  it('acusa sobreposição e fica inválido', () => {
    const r = rascunhoDeFaixas(null);
    const a = avaliarRascunho([...r, { nome: 'Extra', cor: '#112233', emoji: null, de: '50', ate: '65' }]);
    expect(a.valido).toBe(false);
    expect(a.erros.join()).toMatch(/sobrepõem/);
    expect(a.faixas).toBeNull();
  });

  it('número ilegível é inválido', () => {
    const r: RascunhoFaixa[] = [{ nome: 'A', cor: '#112233', emoji: null, de: 'x', ate: '10' }];
    const a = avaliarRascunho(r);
    expect(a.valido).toBe(false);
    expect(a.erros.length).toBeGreaterThan(0);
  });

  it('detecta lacuna sem bloquear', () => {
    const r: RascunhoFaixa[] = [
      { nome: 'A', cor: '#112233', emoji: null, de: '0', ate: '49,99' },
      { nome: 'B', cor: '#445566', emoji: null, de: '60', ate: '100' },
    ];
    const a = avaliarRascunho(r);
    expect(a.valido).toBe(true);
    expect(a.lacunas).toHaveLength(1);
    expect(a.lacunas[0]).toMatch(/49,99.*60/);
  });

  it('ordena por início ao detectar lacunas', () => {
    const r: RascunhoFaixa[] = [
      { nome: 'B', cor: '#445566', emoji: null, de: '60', ate: '100' },
      { nome: 'A', cor: '#112233', emoji: null, de: '0', ate: '59,99' },
    ];
    expect(avaliarRascunho(r).lacunas).toEqual([]);
  });
});

describe('adicionarFaixa / removerFaixa', () => {
  it('nova faixa vem logo após o maior fim e é válida quando há espaço', () => {
    const r: RascunhoFaixa[] = [{ nome: 'A', cor: '#112233', emoji: null, de: '0', ate: '49,99' }];
    const novo = adicionarFaixa(r);
    expect(novo).toHaveLength(2);
    expect(avaliarRascunho(novo).valido).toBe(false); // nome vazio até o gestor preencher
    expect(novo[1].de).toBe('50');
    expect(novo[1].ate).toBe('100');
  });

  it('remove pelo índice', () => {
    const r = rascunhoDeFaixas(null);
    expect(removerFaixa(r, 0)).toHaveLength(r.length - 1);
    expect(removerFaixa(r, 0)[0].nome).toBe('Atenção Necessária');
  });
});

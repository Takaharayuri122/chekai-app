import { describe, it, expect } from 'vitest';
import { classificar, FAIXAS_PADRAO, validarFaixas, type FaixaClassificacao } from './faixas';

const faixa = (extra: Partial<FaixaClassificacao> = {}): FaixaClassificacao => ({
  nome: 'Bom',
  cor: '#00FF00',
  emoji: null,
  de: 0,
  ate: 100,
  ...extra,
});

describe('classificar', () => {
  it('usa as faixas padrão', () => {
    expect(classificar(95).nome).toBe('Com Excelência');
    expect(classificar(59.99).nome).toBe('Crítico');
    expect(classificar(60).nome).toBe('Atenção Necessária');
    expect(classificar(100).nome).toBe('Com Excelência');
    expect(classificar(0).nome).toBe('Crítico');
  });

  it('usa as padrão quando a lista é nula ou vazia', () => {
    expect(classificar(75, null).nome).toBe('Regular');
    expect(classificar(75, []).nome).toBe('Regular');
  });

  it('arredonda a nota para 2 casas antes de classificar', () => {
    expect(classificar(59.995).nome).toBe('Atenção Necessária');
    expect(classificar(89.999).nome).toBe('Com Excelência');
    expect(classificar(59.994).nome).toBe('Crítico');
  });

  it('abaixo do mínimo', () => {
    expect(classificar(-5)).toMatchObject({ nome: 'Abaixo do mínimo', faixa: null });
  });

  it('sem classificação em lacuna', () => {
    const faixas = [faixa({ de: 0, ate: 49.99 }), faixa({ nome: 'Alto', de: 60, ate: 100 })];
    expect(classificar(55, faixas)).toMatchObject({ nome: 'Sem classificação', faixa: null });
  });
});

describe('validarFaixas', () => {
  it('aceita as faixas padrão', () => {
    expect(validarFaixas(FAIXAS_PADRAO)).toEqual([]);
  });

  it('acusa lista vazia', () => {
    expect(validarFaixas([])).toHaveLength(1);
  });

  it('acusa nome vazio ou longo', () => {
    expect(validarFaixas([faixa({ nome: ' ' })]).join()).toMatch(/nome/);
    expect(validarFaixas([faixa({ nome: 'x'.repeat(21) })]).join()).toMatch(/20 caracteres/);
  });

  it('acusa cor inválida', () => {
    expect(validarFaixas([faixa({ cor: 'verde' })]).join()).toMatch(/#RRGGBB/);
    expect(validarFaixas([faixa({ cor: '#FFF' })]).join()).toMatch(/#RRGGBB/);
  });

  it('acusa início maior ou igual ao fim', () => {
    expect(validarFaixas([faixa({ de: 50, ate: 50 })]).join()).toMatch(/menor que o fim/);
  });

  it('acusa valores fora de 0 a 100', () => {
    expect(validarFaixas([faixa({ de: -1, ate: 50 })]).join()).toMatch(/entre 0 e 100/);
    expect(validarFaixas([faixa({ de: 0, ate: 101 })]).join()).toMatch(/entre 0 e 100/);
  });

  it('acusa sobreposição, inclusive no limite', () => {
    const erros = validarFaixas([faixa({ nome: 'A', de: 0, ate: 50 }), faixa({ nome: 'B', de: 50, ate: 100 })]);
    expect(erros.join()).toMatch(/sobrepõem/);
  });
});

describe('FAIXAS_PADRAO', () => {
  it('é somente leitura', () => {
    expect(Object.isFrozen(FAIXAS_PADRAO)).toBe(true);
    expect(Object.isFrozen(FAIXAS_PADRAO[0])).toBe(true);
  });
});

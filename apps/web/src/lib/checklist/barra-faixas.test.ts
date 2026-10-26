import { describe, it, expect } from 'vitest';
import { FAIXAS_PADRAO, type FaixaClassificacao } from './faixas';
import { posicaoNaBarra, segmentosDaBarra } from './barra-faixas';

const faixa = (nome: string, de: number, ate: number): FaixaClassificacao => ({ nome, cor: '#000000', emoji: null, de, ate });

describe('segmentosDaBarra', () => {
  it('as faixas padrão cobrem a barra de 0 a 100 sem vãos', () => {
    const s = segmentosDaBarra(FAIXAS_PADRAO);
    expect(s).toHaveLength(5);
    expect(s[0]).toMatchObject({ nome: 'Crítico', inicio: 0, largura: 60 });
    expect(s[1]).toMatchObject({ inicio: 60, largura: 10 });
    expect(s[4]).toMatchObject({ nome: 'Com Excelência', inicio: 90, largura: 10 });
  });

  it('largura proporcional ao intervalo da faixa', () => {
    const s = segmentosDaBarra([faixa('A', 0, 30), faixa('B', 30.01, 100)]);
    expect(s[0].largura).toBeCloseTo(30.01);
    expect(s[1]).toMatchObject({ inicio: 30.01 });
    expect(s[1].largura).toBeCloseTo(69.99);
  });

  it('mantém o deslocamento quando a primeira faixa não começa em 0', () => {
    const s = segmentosDaBarra([faixa('A', 50, 79.99), faixa('B', 80, 100)]);
    expect(s[0]).toMatchObject({ inicio: 50, largura: 30 });
    expect(s[1]).toMatchObject({ inicio: 80, largura: 20 });
  });

  it('deixa vão entre faixas que não se encostam', () => {
    const s = segmentosDaBarra([faixa('A', 0, 40), faixa('B', 60, 100)]);
    expect(s[0]).toMatchObject({ inicio: 0, largura: 40 });
    expect(s[1]).toMatchObject({ inicio: 60, largura: 40 });
  });

  it('não estende a última faixa até 100', () => {
    const s = segmentosDaBarra([faixa('A', 0, 80)]);
    expect(s[0]).toMatchObject({ inicio: 0, largura: 80 });
  });

  it('ordena faixas fora de ordem', () => {
    const s = segmentosDaBarra([faixa('B', 50, 100), faixa('A', 0, 49.99)]);
    expect(s.map((x) => x.nome)).toEqual(['A', 'B']);
    expect(s[0].largura).toBe(50);
  });
});

describe('posicaoNaBarra', () => {
  it('acompanha a nota na escala de 0 a 100', () => {
    expect(posicaoNaBarra(90.36)).toBeCloseTo(90.36);
    expect(posicaoNaBarra(55)).toBe(55);
  });

  it('fica entre 0 e 100', () => {
    expect(posicaoNaBarra(130)).toBe(100);
    expect(posicaoNaBarra(-5)).toBe(0);
    expect(posicaoNaBarra(Number.NaN)).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';
import { LARGURA_MAXIMA_EXPORTACAO, pontoMedio, pontoNoQuadro, tamanhoDaExportacao } from './campo-assinatura.logic';

describe('tamanhoDaExportacao', () => {
  it('reduz quadros largos à largura máxima mantendo a proporção', () => {
    expect(tamanhoDaExportacao(1200, 180)).toEqual({ largura: LARGURA_MAXIMA_EXPORTACAO, altura: 90 });
  });

  it('não amplia quadros estreitos (celular)', () => {
    expect(tamanhoDaExportacao(343, 180)).toEqual({ largura: 343, altura: 180 });
  });

  it('quadro sem tamanho exporta vazio', () => {
    expect(tamanhoDaExportacao(0, 180)).toEqual({ largura: 0, altura: 0 });
  });
});

describe('pontos do traço', () => {
  it('converte o toque para coordenadas do quadro', () => {
    expect(pontoNoQuadro({ clientX: 120, clientY: 80 }, { left: 20, top: 30 })).toEqual({ x: 100, y: 50 });
  });

  it('ponto médio suaviza a curva', () => {
    expect(pontoMedio({ x: 0, y: 0 }, { x: 10, y: 4 })).toEqual({ x: 5, y: 2 });
  });
});

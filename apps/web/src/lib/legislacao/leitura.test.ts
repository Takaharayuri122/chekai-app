import { describe, expect, it } from 'vitest';
import { deveAtualizar, rotuloSituacao, rotuloStatusLeitura } from './leitura';

describe('rotuloStatusLeitura', () => {
  it('traduz cada estado da leitura', () => {
    expect(rotuloStatusLeitura('pendente')).toBe('Aguardando');
    expect(rotuloStatusLeitura('lendo')).toBe('Lendo…');
    expect(rotuloStatusLeitura('concluida')).toBe('Pronta');
    expect(rotuloStatusLeitura('falhou')).toBe('Falhou');
  });
});

describe('rotuloSituacao', () => {
  it('traduz a situação da legislação', () => {
    expect(rotuloSituacao('vigente')).toBe('Vigente');
    expect(rotuloSituacao('vigente_com_alteracoes')).toBe('Vigente com alterações');
    expect(rotuloSituacao('revogada')).toBe('Revogada');
  });

  it('retorna null quando não há situação', () => {
    expect(rotuloSituacao(null)).toBeNull();
  });
});

describe('deveAtualizar', () => {
  it('só atualiza enquanto a leitura não terminou', () => {
    expect(deveAtualizar('pendente')).toBe(true);
    expect(deveAtualizar('lendo')).toBe(true);
    expect(deveAtualizar('concluida')).toBe(false);
    expect(deveAtualizar('falhou')).toBe(false);
  });
});

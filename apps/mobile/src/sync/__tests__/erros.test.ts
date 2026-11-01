import { ehFalhaDefinitiva, ehSessaoExpirada } from '../erros';
import { ApiError } from '../../api/client';

jest.mock('../../api/client', () => {
  class ApiError extends Error {
    constructor(message: string, readonly status: number) {
      super(message);
    }
  }
  return { ApiError };
});

describe('ehFalhaDefinitiva', () => {
  it.each([400, 403, 404, 409, 422])('trata %i como definitiva', (status) => {
    expect(ehFalhaDefinitiva(new ApiError('x', status))).toBe(true);
  });

  it.each([401, 408, 429, 500, 502, 503])('trata %i como temporária', (status) => {
    expect(ehFalhaDefinitiva(new ApiError('x', status))).toBe(false);
  });

  it('trata erro de rede como temporário', () => {
    expect(ehFalhaDefinitiva(new Error('Network request failed'))).toBe(false);
    expect(ehFalhaDefinitiva('qualquer coisa')).toBe(false);
  });
});

describe('ehSessaoExpirada', () => {
  it('só é verdadeiro para ApiError 401', () => {
    expect(ehSessaoExpirada(new ApiError('x', 401))).toBe(true);
    expect(ehSessaoExpirada(new ApiError('x', 403))).toBe(false);
    expect(ehSessaoExpirada(new Error('x'))).toBe(false);
  });
});

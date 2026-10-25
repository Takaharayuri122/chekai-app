import { BadRequestException } from '@nestjs/common';
import { lerLegislacaoIdsMultipart } from './ia.controller';

describe('lerLegislacaoIdsMultipart', () => {
  const a = '3f2b8c1e-9d4a-4b6e-8c1d-2a7f5e9b0c11';
  const b = '7c1e2d3f-4a5b-4c6d-9e8f-0a1b2c3d4e5f';

  it('aceita ausente, campo único, repetido, JSON e vírgulas', () => {
    expect(lerLegislacaoIdsMultipart(undefined)).toBeUndefined();
    expect(lerLegislacaoIdsMultipart(a)).toEqual([a]);
    expect(lerLegislacaoIdsMultipart([a, b])).toEqual([a, b]);
    expect(lerLegislacaoIdsMultipart(JSON.stringify([a, b]))).toEqual([a, b]);
    expect(lerLegislacaoIdsMultipart(`${a}, ${b}`)).toEqual([a, b]);
  });

  it('rejeita uuid inválido e mais de 10', () => {
    expect(() => lerLegislacaoIdsMultipart('nao-uuid')).toThrow(BadRequestException);
    expect(() => lerLegislacaoIdsMultipart(Array(11).fill(a))).toThrow(BadRequestException);
  });
});

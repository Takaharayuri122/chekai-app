import { describe, expect, it } from 'vitest';
import { nomesLegislacoesDoItem } from './legislacoes-do-item';
import { TipoLegislacao } from '@/lib/api';

const rdc = { tipo: TipoLegislacao.RDC, numero: '216', ano: 2004, titulo: 'x' };
const cvs = { tipo: TipoLegislacao.PORTARIA, numero: '5', ano: 2013, titulo: 'y' };

describe('nomesLegislacoesDoItem', () => {
  it('prefere as legislações do próprio item, unidas por "; "', () => {
    expect(nomesLegislacoesDoItem({ legislacoes: [rdc, cvs], templateItem: { legislacoes: [cvs] } })).toBe('RDC 216/2004; Portaria 5/2013');
  });
  it('herda da pergunta quando o item não tem as próprias', () => {
    expect(nomesLegislacoesDoItem({ legislacoes: [], templateItem: { legislacoes: [cvs] } })).toBe('Portaria 5/2013');
  });
  it('usa referenciaLegal e depois legislacaoReferencia', () => {
    expect(nomesLegislacoesDoItem({ referenciaLegal: ' RDC 10/2010 ', templateItem: { legislacaoReferencia: 'Lei 1/2000' } })).toBe('RDC 10/2010');
    expect(nomesLegislacoesDoItem({ referenciaLegal: '', templateItem: { legislacaoReferencia: 'Lei 1/2000' } })).toBe('Lei 1/2000');
  });
  it('sem fonte devolve null', () => {
    expect(nomesLegislacoesDoItem({})).toBeNull();
  });
});

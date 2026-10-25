import { TipoLegislacao } from '../entities/legislacao.entity';
import { nomesLegislacoesDoItem } from './legislacoes-do-item';

const rdc = { tipo: TipoLegislacao.RDC, numero: '216', ano: 2004, titulo: 'Boas práticas' };
const portaria = { tipo: TipoLegislacao.PORTARIA, numero: '5', ano: 2013, titulo: 'Água' };

describe('nomesLegislacoesDoItem', () => {
  it('usa as legislações do próprio item primeiro', () => {
    expect(
      nomesLegislacoesDoItem({
        legislacoes: [rdc, portaria],
        referenciaLegal: 'texto',
        templateItem: { legislacoes: [portaria] },
      }),
    ).toBe('RDC 216/2004; Portaria 5/2013');
  });

  it('herda as do template quando o item não tem', () => {
    expect(
      nomesLegislacoesDoItem({ legislacoes: [], templateItem: { legislacoes: [rdc] } }),
    ).toBe('RDC 216/2004');
  });

  it('cai para referenciaLegal e depois legislacaoReferencia', () => {
    expect(nomesLegislacoesDoItem({ referenciaLegal: ' Lei X ' })).toBe('Lei X');
    expect(
      nomesLegislacoesDoItem({ referenciaLegal: '  ', templateItem: { legislacaoReferencia: 'Ref T' } }),
    ).toBe('Ref T');
  });

  it('devolve null sem nenhuma fonte', () => {
    expect(nomesLegislacoesDoItem({})).toBeNull();
  });
});

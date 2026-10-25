import { TipoLegislacao } from '../entities/legislacao.entity';
import { chaveDaLegislacao, chavesNoTexto } from './chave-legislacao';

describe('chavesNoTexto', () => {
  it.each([
    ['RDC 216/2004', ['rdc:216:2004']],
    ['RDC nº 216, de 15 de setembro de 2004', ['rdc:216:2004']],
    ['Resolução-RDC N° 216/04', []],
    ['Resolução-RDC Nº 216, DE 15 DE SETEMBRO DE 2004', ['rdc:216:2004']],
    ['Resolução da Diretoria Colegiada - RDC 216/2004', ['rdc:216:2004']],
    ['Lei 8.078/1990', ['lei:8078:1990']],
    ['Portaria CVS 5/2013', ['portaria:5:2013']],
    ['IN 60/2019', ['instrucao_normativa:60:2019']],
    [
      'Instrução Normativa nº 60, de 23 de dezembro de 2019',
      ['instrucao_normativa:60:2019'],
    ],
    ['RDC 216/2004; Portaria CVS 5/2013', ['rdc:216:2004', 'portaria:5:2013']],
    ['RDC 216/2004 e novamente RDC 216/2004', ['rdc:216:2004']],
    ['rdc 216', []],
    ['Decreto-Lei nº 986, de 21 de outubro de 1969', []],
    ['Lei Federal nº 8.078, de 11 de setembro de 1990', ['lei:8078:1990']],
    ['Lei Estadual nº 10.083, de 23 de setembro de 1998', ['lei:10083:1998']],
    ['Lei federal 8.078/1990', ['lei:8078:1990']],
    ['Portaria SVS/MS nº 326, de 30 de julho de 1997', ['portaria:326:1997']],
    ['Lei do 5/2010', []],
    ['', []],
  ])('%s', (texto, esperado) => {
    expect(chavesNoTexto(texto)).toEqual(esperado);
  });

  it('aceita nulo e indefinido', () => {
    expect(chavesNoTexto(null)).toEqual([]);
    expect(chavesNoTexto(undefined)).toEqual([]);
  });
});

describe('chaveDaLegislacao', () => {
  it('normaliza o número sem zeros à esquerda', () => {
    expect(chaveDaLegislacao({ tipo: TipoLegislacao.RDC, numero: '0216', ano: 2004 })).toBe(
      'rdc:216:2004',
    );
  });

  it('retorna nulo quando falta tipo útil, número ou ano', () => {
    expect(chaveDaLegislacao({ tipo: TipoLegislacao.OUTRO, numero: '1', ano: 2004 })).toBeNull();
    expect(chaveDaLegislacao({ tipo: TipoLegislacao.RDC, numero: null, ano: 2004 })).toBeNull();
    expect(chaveDaLegislacao({ tipo: TipoLegislacao.RDC, numero: '216', ano: null })).toBeNull();
  });
});

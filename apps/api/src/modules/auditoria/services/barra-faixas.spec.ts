import { FAIXAS_PADRAO, FaixaClassificacao } from '../../checklist/regras';
import { posicaoNaBarra, segmentosDaBarra } from './barra-faixas';

const faixa = (nome: string, de: number, ate: number): FaixaClassificacao => ({ nome, cor: '#000000', emoji: null, de, ate });

describe('segmentosDaBarra', () => {
  it('as faixas padrão cobrem a barra de 0 a 100 sem vãos', () => {
    const s = segmentosDaBarra(FAIXAS_PADRAO);
    expect(s).toHaveLength(5);
    expect(s[0]).toMatchObject({ nome: 'Crítico', inicio: 0, largura: 60 });
    expect(s[4]).toMatchObject({ nome: 'Com Excelência', inicio: 90, largura: 10 });
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
});

describe('posicaoNaBarra', () => {
  it('acompanha a nota e fica entre 0 e 100', () => {
    expect(posicaoNaBarra(82.5)).toBe(82.5);
    expect(posicaoNaBarra(130)).toBe(100);
    expect(posicaoNaBarra(-5)).toBe(0);
  });
});

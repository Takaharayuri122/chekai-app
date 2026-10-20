import { lerModeloCache, salvarModeloCache } from '../../store/modelo-relatorio';
import { mesclarComPadrao } from '../../utils/modelo-secoes';

jest.mock('react-native-mmkv', () => {
  class MMKV {
    private valores = new Map<string, string>();
    set(chave: string, valor: string): void {
      this.valores.set(chave, valor);
    }
    getString(chave: string): string | undefined {
      return this.valores.get(chave);
    }
  }
  return { MMKV };
});

describe('cache do modelo de relatório técnico', () => {
  const modelo = mesclarComPadrao([{ secao: 'avaliacaoTecnica', ativa: false, titulo: '' }]);

  it('devolve o modelo salvo para o mesmo usuário', () => {
    salvarModeloCache('u1', modelo);
    expect(lerModeloCache('u1')).toEqual(modelo);
  });

  it('não vaza o modelo de um usuário para outro', () => {
    salvarModeloCache('u1', modelo);
    expect(lerModeloCache('u2')).toBeNull();
  });
});

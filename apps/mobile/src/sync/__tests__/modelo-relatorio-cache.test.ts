import { lerModeloCache, modeloParaRelatorio, salvarModeloCache } from '../../store/modelo-relatorio';
import { mesclarComPadrao, modeloPadrao } from '../../utils/modelo-secoes';

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

  it('finalizado usa o snapshot; finalizado legado usa o padrão', () => {
    salvarModeloCache('u3', modelo);
    const snapshot = mesclarComPadrao([{ secao: 'planoAcaoSugerido', ativa: false, titulo: '' }]);
    expect(modeloParaRelatorio({ status: 'finalizado', modeloSecoes: snapshot }, 'u3')).toEqual(snapshot);
    expect(modeloParaRelatorio({ status: 'finalizado', modeloSecoes: null }, 'u3')).toEqual(modeloPadrao());
  });

  it('rascunho usa o cache do usuário, ou o padrão sem cache', () => {
    salvarModeloCache('u4', modelo);
    expect(modeloParaRelatorio({ status: 'rascunho', modeloSecoes: null }, 'u4')).toEqual(modelo);
    expect(modeloParaRelatorio({ status: 'rascunho', modeloSecoes: null }, 'u5')).toEqual(modeloPadrao());
    expect(modeloParaRelatorio({ status: 'rascunho', modeloSecoes: null }, undefined)).toEqual(modeloPadrao());
  });
});

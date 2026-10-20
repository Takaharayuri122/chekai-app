import { MMKV } from 'react-native-mmkv';
import { type ModeloSecao, mesclarComPadrao } from '../utils/modelo-secoes';

const storage = new MMKV({ id: 'modelo-relatorio' });

function chave(userId: string): string {
  return `modelo:${userId}`;
}

/** Guarda o modelo de relatório técnico do usuário para uso offline. */
export function salvarModeloCache(userId: string, secoes: ModeloSecao[]): void {
  storage.set(chave(userId), JSON.stringify(secoes));
}

/** Modelo em cache do usuário, ou `null` quando ainda não sincronizado. */
export function lerModeloCache(userId: string): ModeloSecao[] | null {
  const valor = storage.getString(chave(userId));
  if (!valor) {
    return null;
  }
  try {
    return mesclarComPadrao(JSON.parse(valor) as ModeloSecao[]);
  } catch {
    return null;
  }
}

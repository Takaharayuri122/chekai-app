import { MMKV } from 'react-native-mmkv';
import { type ModeloSecao, mesclarComPadrao, modeloPadrao } from '../utils/modelo-secoes';

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

/**
 * Modelo aplicado a um relatório no app (RN-REL-012): finalizado segue o snapshot
 * (legado sem snapshot → padrão); rascunho segue o modelo em cache do usuário.
 */
export function modeloParaRelatorio(
  relatorio: { status: string; modeloSecoes: ModeloSecao[] | null },
  userId: string | undefined,
): ModeloSecao[] {
  if (relatorio.status === 'finalizado') {
    return relatorio.modeloSecoes ? mesclarComPadrao(relatorio.modeloSecoes) : modeloPadrao();
  }
  return (userId ? lerModeloCache(userId) : null) ?? modeloPadrao();
}

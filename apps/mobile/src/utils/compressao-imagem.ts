import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

const MAX_LADO = 1200;
const QUALIDADE_JPEG = 0.8;

interface ResultadoCompressao {
  uri: string;
  tamanhoBytes: number;
}

export async function comprimirImagem(uri: string): Promise<ResultadoCompressao> {
  const resultado = await manipulateAsync(
    uri,
    [{ resize: { width: MAX_LADO } }],
    { compress: QUALIDADE_JPEG, format: SaveFormat.JPEG },
  );

  const destino = `${FileSystem.documentDirectory}fotos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}fotos/`, { intermediates: true });
  await FileSystem.moveAsync({ from: resultado.uri, to: destino });

  const info = await FileSystem.getInfoAsync(destino);
  const tamanhoBytes = info.exists ? (info.size ?? 0) : 0;

  return { uri: destino, tamanhoBytes };
}

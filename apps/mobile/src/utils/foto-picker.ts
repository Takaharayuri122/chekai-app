import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { ActionSheetIOS, Alert, Platform } from 'react-native';
import { comprimirImagem } from './compressao-imagem';
import type { LatLng } from '../db/repositories/foto.repo';

const MAX_FOTOS_POR_ITEM = 5;

interface FotoCapturada {
  uri: string;
  tamanhoBytes: number;
  coords: LatLng | undefined;
}

async function obterLocalizacao(): Promise<LatLng | undefined> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return undefined;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch {
    return undefined;
  }
}

async function processarAssets(
  assets: ImagePicker.ImagePickerAsset[],
  maxRestante: number,
): Promise<FotoCapturada[]> {
  const selecionados = assets.slice(0, maxRestante);
  const coords = await obterLocalizacao();
  const resultados: FotoCapturada[] = [];

  for (const asset of selecionados) {
    const { uri, tamanhoBytes } = await comprimirImagem(asset.uri);
    resultados.push({ uri, tamanhoBytes, coords });
  }

  return resultados;
}

async function abrirCamera(maxRestante: number): Promise<FotoCapturada[]> {
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.8,
    allowsEditing: false,
    mediaTypes: ['images'],
  });
  if (result.canceled || !result.assets.length) return [];
  return processarAssets(result.assets, maxRestante);
}

async function abrirGaleria(maxRestante: number): Promise<FotoCapturada[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    quality: 0.8,
    allowsMultipleSelection: true,
    selectionLimit: maxRestante,
    mediaTypes: ['images'],
  });
  if (result.canceled || !result.assets.length) return [];
  return processarAssets(result.assets, maxRestante);
}

/**
 * Abre ActionSheet para o usuário escolher entre câmera e galeria.
 * Retorna array de fotos capturadas (já comprimidas e salvas localmente).
 */
export function abrirFotoPicker(fotosAtuais: number): Promise<FotoCapturada[]> {
  const maxRestante = MAX_FOTOS_POR_ITEM - fotosAtuais;

  if (maxRestante <= 0) {
    Alert.alert('Limite atingido', `Máximo de ${MAX_FOTOS_POR_ITEM} fotos por item.`);
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const opcoes = ['Tirar foto', 'Escolher da galeria', 'Cancelar'];
    const cancelIndex = 2;

    const handler = (index: number) => {
      if (index === 0) resolve(abrirCamera(maxRestante));
      else if (index === 1) resolve(abrirGaleria(maxRestante));
      else resolve([]);
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: opcoes, cancelButtonIndex: cancelIndex, title: 'Adicionar foto' },
        handler,
      );
    } else {
      Alert.alert('Adicionar foto', undefined, [
        { text: 'Tirar foto', onPress: () => handler(0) },
        { text: 'Escolher da galeria', onPress: () => handler(1) },
        { text: 'Cancelar', style: 'cancel', onPress: () => handler(2) },
      ]);
    }
  });
}

export { MAX_FOTOS_POR_ITEM };
export type { FotoCapturada };

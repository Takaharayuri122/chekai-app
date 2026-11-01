import * as Location from 'expo-location';
import type { LatLng } from '../db/repositories/foto.repo';
import { comTempoLimite } from './tempo-limite';

const IDADE_MAXIMA_MS = 300000;

/**
 * Lê a localização sem nunca travar o fluxo: usa a última posição conhecida
 * (até 5 min) ou tenta uma leitura nova dentro do limite. Qualquer falha ou
 * estouro devolve undefined. Não pede permissão (isso é do onboarding/hook).
 */
export async function obterLocalizacaoRapida(ms = 4000): Promise<LatLng | undefined> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return undefined;
    const ultima = await Location.getLastKnownPositionAsync({ maxAge: IDADE_MAXIMA_MS });
    const loc =
      ultima ??
      (await comTempoLimite(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        ms,
      ));
    return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
  } catch {
    return undefined;
  }
}

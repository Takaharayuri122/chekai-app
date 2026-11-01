import * as Location from 'expo-location';
import type { LatLng } from '../db/repositories/foto.repo';
import { comTempoLimite } from './tempo-limite';

/**
 * Lê a localização sem nunca travar o fluxo: usa a última posição conhecida
 * (até `idadeMaximaMs`) ou tenta uma leitura nova. Todo o corpo (inclusive as
 * chamadas nativas) fica sob o limite único `ms`; qualquer falha ou estouro
 * devolve undefined. Não pede permissão (isso é do onboarding/hook).
 */
export async function obterLocalizacaoRapida(
  ms = 4000,
  idadeMaximaMs = 300000,
): Promise<LatLng | undefined> {
  try {
    return await comTempoLimite(lerLocalizacao(idadeMaximaMs), ms);
  } catch {
    return undefined;
  }
}

async function lerLocalizacao(idadeMaximaMs: number): Promise<LatLng | undefined> {
  const { status } = await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return undefined;
  const ultima = await Location.getLastKnownPositionAsync({ maxAge: idadeMaximaMs });
  const loc = ultima ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
}

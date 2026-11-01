import { useCallback, useState } from 'react';
import * as Location from 'expo-location';
import { obterLocalizacaoRapida } from '../utils/localizacao';

export interface Coordenadas {
  latitude: number;
  longitude: number;
}

interface UseGeolocalizacao {
  coordenadas: Coordenadas | null;
  erro: string | null;
  carregando: boolean;
  capturarLocalizacao: () => Promise<Coordenadas | null>;
  limpar: () => void;
}

/**
 * Captura a localização atual do dispositivo via `expo-location`, solicitando a
 * permissão de primeiro plano quando necessário. Retorna as coordenadas e expõe
 * estados de carregamento/erro para a UI de check-in/checkout (RN-CKI-007).
 */
export function useGeolocalizacao(): UseGeolocalizacao {
  const [coordenadas, setCoordenadas] = useState<Coordenadas | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState<boolean>(false);

  const capturarLocalizacao = useCallback(async (): Promise<Coordenadas | null> => {
    setCarregando(true);
    setErro(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErro('Permissão de localização negada. Ajuste nas configurações do aparelho.');
        return null;
      }
      const novas = await obterLocalizacaoRapida(4000, 60000);
      if (!novas) {
        setErro('Não foi possível capturar a localização. Tente novamente.');
        return null;
      }
      setCoordenadas(novas);
      return novas;
    } catch {
      setErro('Não foi possível capturar a localização. Tente novamente.');
      return null;
    } finally {
      setCarregando(false);
    }
  }, []);

  const limpar = useCallback((): void => {
    setCoordenadas(null);
    setErro(null);
  }, []);

  return { coordenadas, erro, carregando, capturarLocalizacao, limpar };
}

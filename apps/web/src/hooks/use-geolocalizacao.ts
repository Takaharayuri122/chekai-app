import { useState } from 'react';

interface Coordenadas {
  latitude: number;
  longitude: number;
}

interface RetornoGeolocalizacao {
  coordenadas: Coordenadas | null;
  erro: string;
  carregando: boolean;
  capturarLocalizacao: () => Promise<Coordenadas | null>;
  limpar: () => void;
}

export function useGeolocalizacao(): RetornoGeolocalizacao {
  const [coordenadas, setCoordenadas] = useState<Coordenadas | null>(null);
  const [erro, setErro] = useState<string>('');
  const [carregando, setCarregando] = useState<boolean>(false);

  const capturarLocalizacao = async (): Promise<Coordenadas | null> => {
    setErro('');
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setErro('Geolocalização não suportada neste dispositivo.');
      return null;
    }
    setCarregando(true);
    const resultado = await new Promise<Coordenadas | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          resolve(null);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        },
      );
    });
    setCarregando(false);
    if (!resultado) {
      setErro('Não foi possível obter sua localização. Verifique as permissões do navegador.');
      return null;
    }
    setCoordenadas(resultado);
    return resultado;
  };

  const limpar = (): void => {
    setCoordenadas(null);
    setErro('');
    setCarregando(false);
  };

  return {
    coordenadas,
    erro,
    carregando,
    capturarLocalizacao,
    limpar,
  };
}

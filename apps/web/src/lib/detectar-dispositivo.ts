export type TipoDispositivo = 'ios' | 'android' | 'desktop';

interface NavigatorUAData {
  platform?: string;
}

/**
 * Detecta o tipo de dispositivo com base no userAgent (e userAgentData quando disponível).
 * Deve ser executado apenas no cliente (navegador).
 */
export function detectarDispositivo(): TipoDispositivo {
  if (typeof window === 'undefined') {
    return 'desktop';
  }
  const ua = navigator.userAgent;
  const uaData = (navigator as Navigator & { userAgentData?: NavigatorUAData }).userAgentData;
  if (uaData?.platform) {
    const platform = uaData.platform.toLowerCase();
    if (platform === 'ios' || platform.includes('iphone') || platform.includes('ipad')) {
      return 'ios';
    }
    if (platform === 'android') {
      return 'android';
    }
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'ios';
  }
  if (/Android/i.test(ua)) {
    return 'android';
  }
  return 'desktop';
}

'use client';

import { useEffect } from 'react';
import { useOfflineStore } from '@/lib/store-offline';

/**
 * Atualiza o store global de offline quando a conectividade muda
 * e expõe isOnline para o componente.
 */
export function useOnline(): boolean {
  const isOnline = useOfflineStore((s) => s.isOnline);
  const setOnline = useOfflineStore((s) => s.setOnline);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    setOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  return isOnline;
}

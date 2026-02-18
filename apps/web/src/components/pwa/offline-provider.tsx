'use client';

import { useEffect } from 'react';
import { useOnline } from '@/hooks/use-online';
import { registrarListenerOnline, tentarSincronizarAoCarregar } from '@/lib/offline/sync';
import { atualizarContadorPendentes } from '@/lib/offline/queue';
import { esquentarCachePostLogin } from '@/lib/offline/cache-warming';

/**
 * Inicializa estado de conectividade, listener de sync ao voltar online,
 * contador de pendências, tenta sincronizar ao carregar e aquece o cache
 * para uso offline das rotas críticas.
 */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useOnline();

  // Warming inicial: roda na primeira montagem (usuário autenticado + online)
  useEffect(() => {
    registrarListenerOnline();
    atualizarContadorPendentes().then(() => {
      tentarSincronizarAoCarregar();
    });
    // Aquecer cache apenas se online (fire-and-forget: erros são ignorados internamente)
    if (navigator.onLine) {
      esquentarCachePostLogin().catch(() => {});
    }
  }, []);

  // Re-warming quando o dispositivo volta online após estar offline
  useEffect(() => {
    if (isOnline) {
      esquentarCachePostLogin().catch(() => {});
    }
  }, [isOnline]);

  return <>{children}</>;
}

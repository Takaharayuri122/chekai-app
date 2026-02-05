'use client';

import { useEffect } from 'react';
import { useOnline } from '@/hooks/use-online';
import { registrarListenerOnline, tentarSincronizarAoCarregar } from '@/lib/offline/sync';
import { atualizarContadorPendentes } from '@/lib/offline/queue';

/**
 * Inicializa estado de conectividade, listener de sync ao voltar online,
 * contador de pendências e tenta sincronizar ao carregar se houver pendências.
 */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  useOnline();

  useEffect(() => {
    registrarListenerOnline();
    atualizarContadorPendentes().then(() => {
      tentarSincronizarAoCarregar();
    });
  }, []);

  return <>{children}</>;
}

'use client';

import { useOfflineStore } from '@/lib/store-offline';
import { Loader2 } from 'lucide-react';

/**
 * Overlay em tela cheia durante a sincronização.
 * Bloqueia interações para evitar novas ações na fila.
 */
export function SyncOverlay() {
  const isSyncing = useOfflineStore((s) => s.isSyncing);

  if (!isSyncing) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-base-300/95 backdrop-blur-sm"
      aria-live="polite"
      aria-busy="true"
      role="alert"
    >
      <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-base-100 shadow-xl max-w-sm mx-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" aria-hidden />
        <p className="text-center font-medium text-base-content">
          Sincronizando informações com o ChekAI
        </p>
        <p className="text-sm text-base-content/60 text-center">
          Não feche o aplicativo. Isso pode levar alguns instantes.
        </p>
      </div>
    </div>
  );
}

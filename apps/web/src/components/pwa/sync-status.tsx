'use client';

import { useOnline } from '@/hooks/use-online';
import { useOfflineStore } from '@/lib/store-offline';
import { CloudOff, Loader2, Cloud } from 'lucide-react';

/**
 * Indicador de pendências de sync ou estado de sincronização (opcional, para uso no navbar ou layout).
 */
export function SyncStatus() {
  const isOnline = useOnline();
  const pendingSyncCount = useOfflineStore((s) => s.pendingSyncCount);
  const isSyncing = useOfflineStore((s) => s.isSyncing);

  if (!isOnline) {
    return (
      <span className="flex items-center gap-1.5 text-warning" title="Offline - alterações serão sincronizadas depois">
        <CloudOff className="h-4 w-4" />
        <span className="hidden sm:inline">Offline</span>
      </span>
    );
  }

  if (isSyncing) {
    return (
      <span className="flex items-center gap-1.5 text-primary" title="Sincronizando...">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Sincronizando...</span>
      </span>
    );
  }

  if (pendingSyncCount > 0) {
    return (
      <span className="flex items-center gap-1.5 text-base-content/80" title={`${pendingSyncCount} pendência(s) de sync`}>
        <Cloud className="h-4 w-4" />
        <span className="hidden sm:inline">{pendingSyncCount} pendência(s)</span>
      </span>
    );
  }

  return null;
}

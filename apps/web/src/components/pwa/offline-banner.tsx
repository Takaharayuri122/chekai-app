'use client';

import { useOnline } from '@/hooks/use-online';
import { WifiOff } from 'lucide-react';

/**
 * Banner exibido quando o usuário está offline.
 * Fica no fluxo do layout (abaixo da navbar), sem tampar o menu.
 */
export function OfflineBanner() {
  const isOnline = useOnline();

  if (isOnline) return null;

  return (
    <div
      className="bg-warning text-warning-content px-4 py-2.5 flex items-center justify-center gap-2 text-sm font-medium shadow-sm safe-top"
      role="status"
      aria-live="polite"
    >
      <WifiOff className="h-4 w-4 flex-shrink-0" aria-hidden />
      <span className="text-center">
        Você está offline. As alterações serão salvas localmente e sincronizadas quando a conexão voltar.
      </span>
    </div>
  );
}

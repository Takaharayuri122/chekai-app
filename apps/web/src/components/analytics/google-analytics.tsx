'use client';

import { GoogleAnalytics as NextGoogleAnalytics } from '@next/third-parties/google';

interface GoogleAnalyticsProps {
  gaId: string;
}

/**
 * Componente para integração do Google Analytics.
 * Rastreia automaticamente visualizações de página e eventos.
 */
export function GoogleAnalytics({ gaId }: GoogleAnalyticsProps) {
  if (!gaId) {
    return null;
  }

  return <NextGoogleAnalytics gaId={gaId} />;
}


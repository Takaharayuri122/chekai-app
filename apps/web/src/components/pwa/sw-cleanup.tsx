'use client';

import { useEffect } from 'react';

/**
 * Componente para limpar service workers antigos em desenvolvimento.
 * Ajuda a evitar problemas de cache e service workers obsoletos.
 */
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => {
            registration.unregister();
          });
        });
        
        if ('caches' in window) {
          caches.keys().then((cacheNames) => {
            cacheNames.forEach((cacheName) => {
              caches.delete(cacheName);
            });
          });
        }
      }
    }
  }, []);

  return null;
}

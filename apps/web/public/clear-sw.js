// Script para limpar service workers registrados
// Execute no console do navegador: navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()))

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister().then((success) => {
        if (success) {
          console.log('Service Worker desregistrado com sucesso');
        }
      });
    });
  });
  
  // Limpar cache também
  if ('caches' in window) {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => {
        caches.delete(cacheName).then((success) => {
          if (success) {
            console.log(`Cache ${cacheName} removido`);
          }
        });
      });
    });
  }
}

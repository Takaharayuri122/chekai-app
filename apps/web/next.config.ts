import type { NextConfig } from 'next';
import withPWA from 'next-pwa';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
};

const isDev = process.env.NODE_ENV === 'development';

const pwaConfig = withPWA({
  dest: 'public',
  register: !isDev,
  skipWaiting: true,
  disable: isDev,
  sw: 'sw.js',
  // Fallback de ÚLTIMO RECURSO (quando StaleWhileRevalidate falha: sem cache + sem rede)
  // Garante que offline.html é servido pelo SW em vez do erro nativo do Safari/Chrome
  fallbacks: {
    document: '/offline.html',
  },
  runtimeCaching: [
    // Auth: nunca cachear
    {
      urlPattern: /\/api\/auth\/.*/i,
      handler: 'NetworkOnly',
      options: {
        cacheName: 'auth-requests',
      },
    },
    // API calls: NetworkFirst, TTL curto (dados dinâmicos)
    {
      urlPattern: /^https?:\/\/.*\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 60,
        },
      },
    },
    // Documentos HTML (navegação): StaleWhileRevalidate, TTL longo
    // Serve do cache IMEDIATAMENTE (offline funciona), atualiza em background
    {
      // @ts-ignore
      urlPattern: ({ request }: { request: Request }) =>
        request.mode === 'navigate',
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'pages-cache',
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 dias
        },
      },
    },
    // Assets, fontes, imagens: NetworkFirst, TTL 24h
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'offlineCache',
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 86400,
        },
      },
    },
  ],
  buildExcludes: [/middleware-manifest\.json$/],
  publicExcludes: ['!noprecache/**/*'],
  reloadOnOnline: true,
} as Parameters<typeof withPWA>[0]);

export default pwaConfig(nextConfig);

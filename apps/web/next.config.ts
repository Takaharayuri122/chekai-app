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
  // Fallback de ÚLTIMO RECURSO (quando SWR falha: sem cache + sem rede)
  fallbacks: {
    document: '/offline.html',
  },
  // Serve offline.html para rotas /admin/* que nunca foram cacheadas
  // @ts-ignore
  navigateFallback: '/offline.html',
  // @ts-ignore
  navigateFallbackAllowlist: [/^\/admin\//],
  // @ts-ignore
  navigateFallbackDenylist: [/^\/_next\//, /^\/api\//],
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

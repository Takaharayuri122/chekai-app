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
  runtimeCaching: [
    {
      urlPattern: /\/api\/auth\/.*/i,
      handler: 'NetworkOnly',
      options: {
        cacheName: 'auth-requests',
      },
    },
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
  // fallbacks.document: usado só quando não houver resposta em cache para a URL (NetworkFirst já cacheia páginas visitadas)
  fallbacks: {
    document: '/offline.html',
  },
  buildExcludes: [/middleware-manifest\.json$/],
  publicExcludes: ['!noprecache/**/*'],
  reloadOnOnline: true,
});

export default pwaConfig(nextConfig);

declare module 'next-pwa' {
  import { NextConfig } from 'next';
  
  interface PWAConfig {
    dest?: string;
    register?: boolean;
    skipWaiting?: boolean;
    disable?: boolean;
    sw?: string;
    runtimeCaching?: Array<{
      urlPattern: RegExp | string;
      handler: 'NetworkFirst' | 'NetworkOnly' | 'CacheFirst' | 'StaleWhileRevalidate';
      options?: {
        cacheName?: string;
        networkTimeoutSeconds?: number;
        expiration?: {
          maxEntries?: number;
          maxAgeSeconds?: number;
        };
      };
    }>;
    fallbacks?: {
      document?: string;
    };
    buildExcludes?: RegExp[];
    publicExcludes?: string[];
    reloadOnOnline?: boolean;
  }
  
  function withPWA(config: NextConfig): (nextConfig: NextConfig) => NextConfig;
  function withPWA(pwaConfig: PWAConfig): (nextConfig: NextConfig) => NextConfig;
  
  export default withPWA;
}

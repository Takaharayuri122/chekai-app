import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // PWA será configurado posteriormente
  // Habilita standalone para deploy em container
  output: 'standalone',
};

export default nextConfig;


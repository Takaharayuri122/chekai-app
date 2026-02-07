import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { ServiceWorkerCleanup } from '@/components/pwa/sw-cleanup';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ChekAI - Sistema para Consultorias em Segurança de Alimentos',
  description: 'Plataforma para consultorias automatizarem auditorias em segurança de alimentos com IA',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-192x192.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icons/icon-192x192.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ChekAI',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#00B8A9',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html lang="pt-BR" data-theme="light">
      <body className={`${inter.variable} ${montserrat.variable} font-sans antialiased bg-base-200 min-h-screen`}>
        <ServiceWorkerCleanup />
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '0.5rem',
              padding: '1rem',
            },
          }}
        />
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}

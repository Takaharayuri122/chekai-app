import type { Metadata, Viewport } from 'next';
import { Inter, Montserrat } from 'next/font/google';
import { Toaster } from 'react-hot-toast';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
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
  title: 'ChekAI - Consultoria em Segurança de Alimentos',
  description: 'Aplicativo para auditorias e consultorias em segurança de alimentos com IA',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/images/logo-square.png', sizes: '32x32', type: 'image/png' },
      { url: '/images/logo-square.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [
      { url: '/images/logo-square.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/images/logo-square.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ChekAI',
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

'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { TutorialInstalacaoModal } from '@/components/ui/tutorial-instalacao-modal';
import { OfflineBanner } from '@/components/pwa/offline-banner';
import { OfflineProvider } from '@/components/pwa/offline-provider';
import { SyncOverlay } from '@/components/pwa/sync-overlay';
import { Navbar } from './navbar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, _hasHydrated, usuario } = useAuthStore();
  const redirectAttempted = useRef(false);

  useEffect(() => {
    if (!_hasHydrated) {
      return;
    }
    if (!isAuthenticated && !redirectAttempted.current) {
      const isAdminRoute = pathname.startsWith('/admin');
      if (isAdminRoute) {
        redirectAttempted.current = true;
        router.push('/login');
      }
    } else if (isAuthenticated) {
      redirectAttempted.current = false;
    }
  }, [isAuthenticated, _hasHydrated, router, pathname]);


  if (!_hasHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  if (!usuario) {
    return null;
  }

  return (
    <OfflineProvider>
      <div className="min-h-screen bg-base-200">
        <SyncOverlay />
        <Navbar />
        <OfflineBanner />
        <main className="pb-20 md:pb-8">
          {children}
        </main>
        <TutorialInstalacaoModal />
      </div>
    </OfflineProvider>
  );
}


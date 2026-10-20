'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { AppShell } from './app-shell';

const LoadingScreen = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <span className="inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent h-8 w-8 text-primary" />
  </div>
);

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, _hasHydrated, usuario } = useAuthStore();
  const redirectAttempted = useRef(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !_hasHydrated) {
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
  }, [mounted, isAuthenticated, _hasHydrated, router, pathname]);

  if (!mounted || !_hasHydrated) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoadingScreen />;
  }

  if (!usuario) {
    return <LoadingScreen />;
  }

  return <AppShell>{children}</AppShell>;
}


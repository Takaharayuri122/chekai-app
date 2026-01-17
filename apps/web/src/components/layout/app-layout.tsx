'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { Navbar } from './navbar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, _hasHydrated } = useAuthStore();
  const redirectAttempted = useRef(false);

  useEffect(() => {
    if (!_hasHydrated) {
      return;
    }
    if (!isAuthenticated && !redirectAttempted.current) {
      const isLoginPage = pathname === '/login';
      const isCadastroPage = pathname === '/cadastro';
      const isPublicPage = isLoginPage || isCadastroPage;
      if (!isPublicPage) {
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
    const isLoginPage = pathname === '/login';
    const isCadastroPage = pathname === '/cadastro';
    if (isLoginPage || isCadastroPage) {
      return <>{children}</>;
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Navbar />
      <main className="pb-20 md:pb-8">
        {children}
      </main>
    </div>
  );
}


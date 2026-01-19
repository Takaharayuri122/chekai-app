'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore, useTutorialStore, PerfilUsuario } from '@/lib/store';
import { Navbar } from './navbar';
import { TutorialProvider } from '@/components/tutorial/tutorial-provider';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, _hasHydrated, usuario } = useAuthStore();
  const { verificarTutorialCompleto, iniciarTour } = useTutorialStore();
  const redirectAttempted = useRef(false);
  const tutorialVerificado = useRef(false);

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

  useEffect(() => {
    if (!_hasHydrated || !isAuthenticated || !usuario || tutorialVerificado.current) {
      return;
    }

    const perfil = usuario.perfil;
    const tutorialCompleto = verificarTutorialCompleto(perfil);
    const isDashboardPage = pathname === '/dashboard';

    if (!tutorialCompleto && isDashboardPage) {
      tutorialVerificado.current = true;
      const timer = setTimeout(() => {
        iniciarTour(perfil);
      }, 1000);
      return () => clearTimeout(timer);
    }

    tutorialVerificado.current = true;
  }, [_hasHydrated, isAuthenticated, usuario, pathname, verificarTutorialCompleto, iniciarTour]);

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

  if (!usuario) {
    return null;
  }

  return (
    <TutorialProvider perfil={usuario.perfil}>
      <div className="min-h-screen bg-base-200">
        <Navbar />
        <main className="pb-20 md:pb-8">
          {children}
        </main>
      </div>
    </TutorialProvider>
  );
}


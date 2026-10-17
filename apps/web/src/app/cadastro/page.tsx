'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Redireciona /cadastro para a home com o modal da lista de espera aberto.
 */
export default function CadastroPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/?lista-espera=1');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <span className="inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent h-8 w-8 text-primary" />
    </div>
  );
}

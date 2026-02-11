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
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  );
}

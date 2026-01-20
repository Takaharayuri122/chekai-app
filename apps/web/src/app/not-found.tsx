'use client';

import Link from 'next/link';
import { Home } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-6xl font-bold text-primary">404</h1>
        <h2 className="text-2xl font-semibold text-base-content">Página não encontrada</h2>
        <p className="text-base-content/70">
          A página que você está procurando não existe ou foi movida.
        </p>
        <Link
          href="/"
          className="btn btn-primary gap-2 inline-flex"
        >
          <Home className="w-4 h-4" />
          Voltar para o início
        </Link>
      </div>
    </div>
  );
}

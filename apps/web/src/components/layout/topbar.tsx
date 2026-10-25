'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { useAuthStore } from '@/lib/store';
import { MenuConta } from './menu-conta';
import { HREF_NOVA_AUDITORIA, mostrarAtalhoNovaAuditoria } from './navegacao';

export function Topbar({ onAbrirBusca }: { onAbrirBusca: () => void }) {
  const pathname = usePathname();
  const perfil = useAuthStore((s) => s.usuario?.perfil);
  const mostrarNova = perfil ? mostrarAtalhoNovaAuditoria(pathname, perfil) : false;

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur safe-top lg:px-8 print:hidden">
      <Link href="/admin/dashboard" className="md:hidden" aria-label="Início">
        <Image src="/images/logo-large.png" alt="ChekAI" width={104} height={24} className="h-6 w-auto" priority />
      </Link>

      <button
        type="button"
        onClick={onAbrirBusca}
        className="hidden h-9 w-full max-w-sm items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 md:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar telas, unidades ou clientes…</span>
        <kbd className="rounded border border-border bg-card px-1.5 text-[11px] font-medium">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-11 w-11 md:hidden" onClick={onAbrirBusca} aria-label="Buscar">
          <Search className="h-5 w-5" />
        </Button>
        {mostrarNova && (
          <Button asChild className="hidden md:inline-flex">
            <Link href={HREF_NOVA_AUDITORIA}>
              <Plus className="h-4 w-4" />
              Nova auditoria
            </Link>
          </Button>
        )}
        <div className="md:hidden">
          <MenuConta variante="compacto" />
        </div>
      </div>
    </header>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Plus } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { MoreSheet } from './more-sheet';
import { HREF_NOVA_AUDITORIA, getBarraInferior, getItensMais, isRotaAtiva, mostrarAtalhoNovaAuditoria, type ItemNavegacao } from './navegacao';

const classeAba = 'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium';

export function BottomBar() {
  const pathname = usePathname();
  const { usuario } = useAuthStore();
  const [maisAberto, setMaisAberto] = useState(false);
  if (!usuario) return null;

  const [primeiro, segundo, terceiro] = getBarraInferior(usuario.perfil);
  const maisAtivo = getItensMais(usuario.perfil, { podeGerenciarLegislacoes: usuario.podeGerenciarLegislacoes }).some((i) => isRotaAtiva(pathname, i.href));
  const mostrarNova = mostrarAtalhoNovaAuditoria(pathname, usuario.perfil);

  const aba = (item: ItemNavegacao) => {
    const ativo = isRotaAtiva(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={ativo ? 'page' : undefined}
        className={cn(classeAba, ativo ? 'text-primary' : 'text-muted-foreground')}
      >
        <item.icon className="h-6 w-6" />
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
        aria-label="Navegação inferior"
      >
        {aba(primeiro)}
        {aba(segundo)}
        {mostrarNova && (
          <div className="flex flex-1 justify-center">
            <Link
              href={HREF_NOVA_AUDITORIA}
              aria-label="Nova auditoria"
              className="-mt-5 mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95"
            >
              <Plus className="h-7 w-7" />
            </Link>
          </div>
        )}
        {aba(terceiro)}
        <button
          type="button"
          onClick={() => setMaisAberto(true)}
          className={cn(classeAba, maisAtivo ? 'text-primary' : 'text-muted-foreground')}
          aria-haspopup="dialog"
        >
          <LayoutGrid className="h-6 w-6" />
          Mais
        </button>
      </nav>
      <MoreSheet open={maisAberto} onOpenChange={setMaisAberto} />
    </>
  );
}

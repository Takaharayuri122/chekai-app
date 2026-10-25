'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/shadcn/tooltip';
import { MenuConta } from './menu-conta';
import { getGruposNavegacao, getHrefAtivo, type ItemNavegacao } from './navegacao';
import { podeGerenciarLegislacoes } from '@/lib/legislacao/permissao';

function LinkSidebar({ item, ativo, recolhida }: { item: ItemNavegacao; ativo: boolean; recolhida: boolean }) {
  const link = (
    <Link
      href={item.href}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors',
        'text-sidebar-foreground hover:bg-white/5 hover:text-white',
        ativo && 'bg-primary/15 font-semibold text-white',
        recolhida && 'justify-center px-0',
      )}
    >
      {ativo && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" aria-hidden />}
      <item.icon className={cn('h-[18px] w-[18px] shrink-0', ativo && 'text-primary')} />
      {!recolhida && <span className="truncate">{item.label}</span>}
    </Link>
  );
  if (!recolhida) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ recolhida, onAlternar }: { recolhida: boolean; onAlternar: () => void }) {
  const pathname = usePathname();
  const { usuario } = useAuthStore();
  if (!usuario) return null;
  const grupos = getGruposNavegacao(usuario.perfil, { podeGerenciarLegislacoes: podeGerenciarLegislacoes(usuario) });
  const hrefAtivo = getHrefAtivo(pathname, grupos.flatMap((g) => g.itens));

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex print:hidden',
          recolhida ? 'w-16' : 'w-60',
        )}
        aria-label="Menu principal"
      >
        <div className={cn('flex h-14 items-center border-b border-sidebar-border', recolhida ? 'justify-center' : 'px-4')}>
          <Link href="/admin/dashboard" aria-label="Início">
            {recolhida ? (
              <Image src="/icons/icon-192x192.png" alt="ChekAI" width={28} height={28} className="rounded-md" />
            ) : (
              <Image src="/images/logo-large.png" alt="ChekAI" width={120} height={28} className="h-7 w-auto brightness-0 invert" priority />
            )}
          </Link>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
          {grupos.map((grupo) => (
            <div key={grupo.id} className="space-y-1">
              {grupo.titulo && !recolhida && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">{grupo.titulo}</p>
              )}
              {grupo.titulo && recolhida && <div className="mx-3 border-t border-sidebar-border" aria-hidden />}
              {grupo.itens.map((item) => (
                <LinkSidebar key={item.href} item={item} ativo={item.href === hrefAtivo} recolhida={recolhida} />
              ))}
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={onAlternar}
            className={cn(
              'flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-sidebar-foreground hover:bg-white/5 hover:text-white',
              recolhida && 'justify-center px-0',
            )}
            aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
          >
            {recolhida ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
            {!recolhida && 'Recolher'}
          </button>
          <MenuConta variante="sidebar" recolhida={recolhida} />
        </div>
      </aside>
    </TooltipProvider>
  );
}

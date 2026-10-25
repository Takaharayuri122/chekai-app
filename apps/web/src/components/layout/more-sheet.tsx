'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/shadcn/drawer';
import { getItensMais } from './navegacao';
import { podeGerenciarLegislacoes } from '@/lib/legislacao/permissao';

export function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { usuario, logout } = useAuthStore();
  if (!usuario) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Mais opções</DrawerTitle>
        </DrawerHeader>
        <div className="grid grid-cols-3 gap-2 px-4">
          {getItensMais(usuario.perfil, { podeGerenciarLegislacoes: podeGerenciarLegislacoes(usuario) }).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onOpenChange(false)}
              className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-lg p-2 text-center text-xs font-medium hover:bg-muted"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </span>
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = '/';
            }}
            className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-lg p-2 text-xs font-medium text-destructive hover:bg-muted"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <LogOut className="h-5 w-5" />
            </span>
            Sair
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

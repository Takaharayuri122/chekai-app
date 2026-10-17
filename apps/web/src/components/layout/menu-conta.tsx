'use client';

import Link from 'next/link';
import { ChevronsUpDown, LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import { getItensConta } from './navegacao';

const PERFIL_LABEL: Record<string, string> = { master: 'Administrador', gestor: 'Gestor', auditor: 'Auditor' };

export function iniciais(nome?: string): string {
  if (!nome) return 'U';
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

export function MenuConta({ variante, recolhida = false }: { variante: 'sidebar' | 'compacto'; recolhida?: boolean }) {
  const { usuario, logout } = useAuthStore();
  if (!usuario) return null;

  const sair = () => {
    logout();
    window.location.href = '/';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
          variante === 'sidebar' && 'w-full p-2 text-left hover:bg-white/5',
          variante === 'sidebar' && recolhida && 'justify-center',
        )}
        aria-label="Abrir menu da conta"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {iniciais(usuario.nome)}
        </span>
        {variante === 'sidebar' && !recolhida && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">{usuario.nome}</span>
              <span className="block truncate text-xs text-sidebar-foreground">{PERFIL_LABEL[usuario.perfil]}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 text-sidebar-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variante === 'sidebar' ? 'start' : 'end'} side={variante === 'sidebar' ? 'top' : 'bottom'} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{usuario.nome}</span>
          <span className="block truncate text-xs text-muted-foreground">{usuario.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {getItensConta(usuario.perfil).map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={sair} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

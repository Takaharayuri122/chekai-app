'use client';

import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/shadcn/command';
import { HREF_NOVA_AUDITORIA, getGruposNavegacao, getItensConta } from './navegacao';

export function BuscaGlobal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { usuario } = useAuthStore();
  if (!usuario) return null;

  const ir = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar telas e atalhos…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Atalhos">
          <CommandItem value="nova auditoria" onSelect={() => ir(HREF_NOVA_AUDITORIA)}>
            <Plus className="h-4 w-4" />
            Nova auditoria
          </CommandItem>
        </CommandGroup>
        {getGruposNavegacao(usuario.perfil).map((grupo) => (
          <CommandGroup key={grupo.id} heading={grupo.titulo ?? 'Geral'}>
            {grupo.itens.map((item) => (
              <CommandItem key={item.href} value={item.label} onSelect={() => ir(item.href)}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandGroup heading="Conta">
          {getItensConta(usuario.perfil).map((item) => (
            <CommandItem key={item.href} value={item.label} onSelect={() => ir(item.href)}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

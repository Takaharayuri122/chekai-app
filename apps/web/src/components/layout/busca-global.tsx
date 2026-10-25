'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, Plus } from 'lucide-react';
import { auditoriaService } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/shadcn/command';
import {
  HREF_NOVA_AUDITORIA,
  filtroBusca,
  getGruposNavegacao,
  getItensConta,
  itensBuscaAuditorias,
  type ResultadoBusca,
} from './navegacao';
import { podeGerenciarLegislacoes } from '@/lib/legislacao/permissao';

export function BuscaGlobal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { usuario } = useAuthStore();
  const [auditorias, setAuditorias] = useState<ResultadoBusca[] | null>(null);

  // Carrega as auditorias só na primeira abertura da busca
  useEffect(() => {
    if (!open || auditorias !== null) return;
    auditoriaService
      .listar(1, 100)
      .then((r) => setAuditorias(itensBuscaAuditorias(r.items || [])))
      .catch(() => setAuditorias([]));
  }, [open, auditorias]);

  if (!usuario) return null;

  const ir = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const opcoesNav = { podeGerenciarLegislacoes: podeGerenciarLegislacoes(usuario) };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} filter={filtroBusca}>
      <CommandInput placeholder="Buscar telas, unidades ou clientes…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Atalhos">
          <CommandItem value="nova auditoria" onSelect={() => ir(HREF_NOVA_AUDITORIA)}>
            <Plus className="h-4 w-4" />
            Nova auditoria
          </CommandItem>
        </CommandGroup>
        {getGruposNavegacao(usuario.perfil, opcoesNav).map((grupo) => (
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
          {getItensConta(usuario.perfil, opcoesNav).map((item) => (
            <CommandItem key={item.href} value={item.label} onSelect={() => ir(item.href)}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
        {auditorias && auditorias.length > 0 && (
          <CommandGroup heading="Auditorias">
            {auditorias.map((r) => (
              <CommandItem key={r.id} value={`${r.termos} ${r.id}`} onSelect={() => ir(r.href)}>
                <ClipboardCheck className="h-4 w-4" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{r.titulo}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.detalhe}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { auditoriaService, type Auditoria } from '@/lib/api';
import { dataLocalISO, formatarDataBr } from '@/lib/datas';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusChip } from '@/components/ui/status-chip';
import { Skeleton } from '@/components/ui/shadcn/skeleton';

/** Lista somente leitura das auditorias das unidades de um cliente. */
export function AuditoriasDoCliente({ clienteId }: { clienteId: string }) {
  const [auditorias, setAuditorias] = useState<Auditoria[] | null>(null);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      const todas: Auditoria[] = [];
      try {
        for (let pagina = 1; pagina <= 10; pagina++) {
          const r = await auditoriaService.listar(pagina, 100, clienteId);
          todas.push(...(r.items || []));
          if ((r.items || []).length < 100) break;
        }
      } catch {
        // erro tratado pelo interceptor
      }
      if (ativo) setAuditorias(todas);
    };
    void carregar();
    return () => {
      ativo = false;
    };
  }, [clienteId]);

  if (auditorias === null) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (<Skeleton key={i} className="h-14 w-full" />))}
      </div>
    );
  }

  if (auditorias.length === 0) {
    return <EmptyState icon={ClipboardCheck} title="Nenhuma auditoria" description="Este cliente ainda não tem auditorias registradas." />;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {auditorias.map((a) => (
        <li key={a.id}>
          <Link
            href={a.status === 'finalizada' ? `/admin/auditoria/${a.id}/relatorio` : `/admin/auditoria/${a.id}`}
            className="flex min-h-[56px] items-center gap-3 px-3 py-2 hover:bg-muted/50"
          >
            <span className="w-20 shrink-0 text-xs text-muted-foreground">{formatarDataBr(dataLocalISO(new Date(a.dataInicio)))}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{a.unidade?.nome}</span>
              <span className="block truncate text-xs text-muted-foreground">{a.template?.nome}</span>
            </span>
            {a.status === 'finalizada' ? (
              <span className="text-sm font-semibold">{Number(a.pontuacaoTotal || 0).toFixed(0)}%</span>
            ) : (
              <StatusChip status={a.status} />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AppLayout, PageHeader, EmptyState } from '@/components';
import { listaEsperaService, ListaEsperaItem } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const LIMITE_POR_PAGINA = 20;

export default function ListaEsperaPage() {
  const router = useRouter();
  const { isMaster } = useAuthStore();
  const [dados, setDados] = useState<{
    items: ListaEsperaItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isMaster()) {
      router.push('/admin/dashboard');
      return;
    }
    carregar();
  }, [isMaster, router]);

  const carregar = async (pagina = 1) => {
    setLoading(true);
    try {
      const res = await listaEsperaService.listar(pagina, LIMITE_POR_PAGINA);
      setDados({
        items: res.items,
        total: res.total,
        page: res.page,
        limit: res.limit,
        totalPages: res.totalPages,
      });
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isMaster()) {
    return null;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Lista de espera"
        subtitle="Inscrições da fase beta"
      />
      <div className="p-4 lg:p-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : dados && dados.items.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma inscrição"
            description="Ainda não há inscrições na lista de espera."
          />
        ) : dados ? (
          <>
            <div className="relative flex flex-col rounded-lg border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_tr]:border-b [&_tr]:border-border text-sm [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3 [&_tbody_tr:nth-child(even)]:bg-muted/40">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>E-mail</th>
                      <th>Telefone</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.items.map((item) => (
                      <tr key={item.id}>
                        <td className="whitespace-nowrap text-foreground/80">
                          {formatarData(item.criadoEm)}
                        </td>
                        <td>{item.email}</td>
                        <td>{item.telefone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {dados.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Total: {dados.total} registro{dados.total !== 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => carregar(dados.page - 1)}
                    disabled={dados.page <= 1}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 hover:bg-muted gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Anterior
                  </button>
                  <span className="flex items-center px-3 text-sm">
                    Página {dados.page} de {dados.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => carregar(dados.page + 1)}
                    disabled={dados.page >= dados.totalPages}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 hover:bg-muted gap-1"
                  >
                    Próxima
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}

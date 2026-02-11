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
            <div className="card bg-base-100 border border-base-300 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="table table-zebra">
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
                        <td className="whitespace-nowrap text-base-content/80">
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
                <p className="text-sm text-base-content/60">
                  Total: {dados.total} registro{dados.total !== 1 ? 's' : ''}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => carregar(dados.page - 1)}
                    disabled={dados.page <= 1}
                    className="btn btn-sm btn-ghost gap-1"
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
                    className="btn btn-sm btn-ghost gap-1"
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

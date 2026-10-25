'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus, Search } from 'lucide-react';
import { AppLayout, EmptyState, PageHeader, StatusChip } from '@/components';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { type RelatorioTecnicoResumo, relatorioTecnicoService } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

type FiltroStatus = 'todos' | 'rascunho' | 'finalizado';

function formatarData(data: string): string {
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function RelatoriosTecnicosPage() {
  const { isAuditor } = useAuthStore();
  const [loading, setLoading] = useState<boolean>(true);
  const [busca, setBusca] = useState<string>('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [relatorios, setRelatorios] = useState<RelatorioTecnicoResumo[]>([]);

  useEffect(() => {
    async function carregar(): Promise<void> {
      try {
        const response = await relatorioTecnicoService.listar(1, 100);
        setRelatorios(response.items || []);
      } finally {
        setLoading(false);
      }
    }
    void carregar();
  }, []);

  const relatoriosFiltrados = useMemo(() => {
    return relatorios.filter((relatorio) => {
      const matchStatus = filtroStatus === 'todos' || relatorio.status === filtroStatus;
      const nomeCliente = relatorio.cliente?.nomeFantasia || relatorio.cliente?.razaoSocial || '';
      const nomeUnidade = relatorio.unidade?.nome || '';
      const nomeConsultora = relatorio.consultora?.nome || '';
      const termo = busca.trim().toLowerCase();
      const matchBusca =
        !termo ||
        nomeCliente.toLowerCase().includes(termo) ||
        nomeUnidade.toLowerCase().includes(termo) ||
        nomeConsultora.toLowerCase().includes(termo) ||
        relatorio.identificacao.toLowerCase().includes(termo);
      return matchStatus && matchBusca;
    });
  }, [relatorios, filtroStatus, busca]);

  return (
    <AppLayout>
      <PageHeader
        title="Relatórios técnicos"
        subtitle="Controle técnico geral por cliente"
        action={
          <Button asChild>
            <Link href="/admin/relatorios-tecnicos/novo">
              <Plus className="h-4 w-4" />
              Novo relatório
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 px-4 py-4 lg:px-8">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-11 pl-9"
              placeholder="Buscar por cliente, unidade ou identificação"
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>
          <select
            aria-label="Status"
            className="h-11 rounded-md border border-input bg-card px-3 text-sm sm:w-48"
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as FiltroStatus)}
          >
            <option value="todos">Todos os status</option>
            <option value="rascunho">Rascunho</option>
            <option value="finalizado">Finalizado</option>
          </select>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 w-full" />))}
          </div>
        ) : relatoriosFiltrados.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum relatório técnico encontrado"
            description={busca || filtroStatus !== 'todos' ? 'Tente ajustar os filtros.' : 'Crie um relatório pelo botão no topo.'}
          />
        ) : (
          <ul className="space-y-2">
            {relatoriosFiltrados.map((relatorio) => {
              const nomeCliente = relatorio.cliente?.nomeFantasia || relatorio.cliente?.razaoSocial || 'Cliente';
              const nomeUnidade = relatorio.unidade?.nome || 'Sem unidade';
              const nomeConsultora = relatorio.consultora?.nome || '';
              const finalizado = relatorio.status === 'finalizado';
              return (
                <li key={relatorio.id}>
                  <Link
                    href={`/admin/relatorios-tecnicos/${relatorio.id}`}
                    className="block rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 active:bg-muted"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-medium">{nomeCliente}</p>
                      <StatusChip status={finalizado ? 'finalizada' : 'rascunho'} label={finalizado ? 'Finalizado' : 'Rascunho'} />
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{nomeUnidade}</p>
                    <p className="mt-1 line-clamp-2 text-sm">{relatorio.identificacao}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {!isAuditor() && nomeConsultora && `${nomeConsultora} · `}
                      Atualizado em {formatarData(relatorio.atualizadoEm)}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}

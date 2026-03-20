'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, Filter, Plus, Search } from 'lucide-react';
import { AppLayout, EmptyState, PageHeader } from '@/components';
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
        title="Relatórios Técnicos"
        subtitle="Controle técnico geral por cliente"
        action={(
          <Link href="/admin/relatorios-tecnicos/novo" className="btn btn-primary btn-sm gap-2">
            <Plus className="w-4 h-4" />
            Novo relatório
          </Link>
        )}
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              type="text"
              className="input input-bordered w-full pl-10 text-sm"
              placeholder="Buscar por cliente, unidade ou identificação..."
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
            />
          </div>
          <div className="dropdown dropdown-end w-full sm:w-auto">
            <div tabIndex={0} role="button" className="btn btn-outline btn-sm gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4" />
              Status
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 border border-base-300"
            >
              <li><button className={filtroStatus === 'todos' ? 'active' : ''} onClick={() => setFiltroStatus('todos')}>Todos</button></li>
              <li><button className={filtroStatus === 'rascunho' ? 'active' : ''} onClick={() => setFiltroStatus('rascunho')}>Rascunho</button></li>
              <li><button className={filtroStatus === 'finalizado' ? 'active' : ''} onClick={() => setFiltroStatus('finalizado')}>Finalizado</button></li>
            </ul>
          </div>
        </div>

        {loading ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          </div>
        ) : relatoriosFiltrados.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum relatório técnico encontrado"
            description={busca || filtroStatus !== 'todos' ? 'Tente ajustar os filtros.' : 'Crie seu primeiro relatório técnico.'}
            actionLabel={!busca && filtroStatus === 'todos' ? 'Novo relatório técnico' : undefined}
            actionHref="/admin/relatorios-tecnicos/novo"
          />
        ) : (
          <div className="space-y-3">
            {relatoriosFiltrados.map((relatorio, index) => {
              const nomeCliente = relatorio.cliente?.nomeFantasia || relatorio.cliente?.razaoSocial || 'Cliente';
              const nomeUnidade = relatorio.unidade?.nome || 'Sem unidade';
              const nomeConsultora = relatorio.consultora?.nome || '';
              return (
                <motion.div
                  key={relatorio.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <Link
                    href={`/admin/relatorios-tecnicos/${relatorio.id}`}
                    className="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-all block"
                  >
                    <div className="card-body p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-base">{nomeCliente}</h3>
                        <span className={`badge ${relatorio.status === 'finalizado' ? 'badge-success' : 'badge-warning'}`}>
                          {relatorio.status === 'finalizado' ? 'Finalizado' : 'Rascunho'}
                        </span>
                      </div>
                      <p className="text-sm text-base-content/60 mb-1">{nomeUnidade}</p>
                      <p className="text-sm">{relatorio.identificacao}</p>
                      <div className="flex items-center justify-between mt-2">
                        {!isAuditor() && nomeConsultora && (
                          <span className="text-xs badge badge-ghost badge-sm">{nomeConsultora}</span>
                        )}
                        <span className="text-xs text-base-content/50">
                          Atualizado em {formatarData(relatorio.atualizadoEm)}
                        </span>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

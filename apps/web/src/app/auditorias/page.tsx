'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ClipboardCheck,
  Search,
  Filter,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { AppLayout, PageHeader, EmptyState } from '@/components';
import { auditoriaService, type Auditoria } from '@/lib/api';
import { toastService } from '@/lib/toast';

export default function AuditoriasPage() {
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | 'em_andamento' | 'finalizada'>('todos');
  const [busca, setBusca] = useState('');

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const response = await auditoriaService.listar();
        setAuditorias(response.items || []);
      } catch (error) {
        // Erro já é tratado pelo interceptor
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, []);

  const auditoriasFiltradas = auditorias.filter((a) => {
    const matchFiltro = filtro === 'todos' || a.status === filtro;
    const matchBusca =
      !busca ||
      a.unidade?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      a.unidade?.cliente?.nome?.toLowerCase().includes(busca.toLowerCase());
    return matchFiltro && matchBusca;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'em_andamento':
        return <span className="badge badge-warning badge-sm">Em andamento</span>;
      case 'finalizada':
        return <span className="badge badge-success badge-sm">Finalizada</span>;
      case 'cancelada':
        return <span className="badge badge-error badge-sm">Cancelada</span>;
      default:
        return <span className="badge badge-ghost badge-sm">{status}</span>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <AppLayout>
      <PageHeader title="Auditorias" subtitle="Histórico de auditorias realizadas" />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {/* Search and Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              type="text"
              placeholder="Buscar por cliente ou unidade..."
              className="input input-bordered w-full pl-10"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost gap-1">
              <Filter className="w-4 h-4" />
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 border border-base-300"
            >
              <li>
                <button
                  className={filtro === 'todos' ? 'active' : ''}
                  onClick={() => setFiltro('todos')}
                >
                  Todos
                </button>
              </li>
              <li>
                <button
                  className={filtro === 'em_andamento' ? 'active' : ''}
                  onClick={() => setFiltro('em_andamento')}
                >
                  Em andamento
                </button>
              </li>
              <li>
                <button
                  className={filtro === 'finalizada' ? 'active' : ''}
                  onClick={() => setFiltro('finalizada')}
                >
                  Finalizadas
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          </div>
        ) : auditoriasFiltradas.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhuma auditoria encontrada"
            description={
              busca || filtro !== 'todos'
                ? 'Tente ajustar os filtros de busca.'
                : 'Inicie sua primeira auditoria.'
            }
            actionLabel={!busca && filtro === 'todos' ? 'Nova Auditoria' : undefined}
            actionHref="/auditoria/nova"
          />
        ) : (
          <div className="space-y-3">
            {auditoriasFiltradas.map((auditoria, index) => (
              <motion.div
                key={auditoria.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <Link
                  href={`/auditoria/${auditoria.id}`}
                  className="card bg-base-100 shadow-sm border border-base-300 hover:border-primary/30 transition-colors"
                >
                  <div className="card-body p-4 flex-row items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-base-content truncate">
                        {auditoria.unidade?.nome || 'Unidade'}
                      </p>
                      <p className="text-sm text-base-content/60 truncate">
                        {auditoria.unidade?.cliente?.nome || 'Cliente'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {getStatusBadge(auditoria.status)}
                        <span className="text-xs text-base-content/50 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(auditoria.dataInicio)}
                        </span>
                      </div>
                    </div>
                    {auditoria.status === 'finalizada' &&
                      auditoria.pontuacaoTotal !== undefined && (
                        <div
                          className={`radial-progress text-sm ${
                            Number(auditoria.pontuacaoTotal) >= 80
                              ? 'text-success'
                              : Number(auditoria.pontuacaoTotal) >= 60
                              ? 'text-warning'
                              : 'text-error'
                          }`}
                          style={{
                            '--value': Number(auditoria.pontuacaoTotal),
                            '--size': '3rem',
                            '--thickness': '4px',
                          } as React.CSSProperties}
                          role="progressbar"
                        >
                          <span className="text-xs font-bold">
                            {Number(auditoria.pontuacaoTotal).toFixed(0)}%
                          </span>
                        </div>
                      )}
                    <ChevronRight className="w-5 h-5 text-base-content/30" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}


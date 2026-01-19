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
  RotateCcw,
  Loader2,
  Trash2,
} from 'lucide-react';
import { AppLayout, PageHeader, EmptyState, ConfirmDialog } from '@/components';
import { auditoriaService, type Auditoria } from '@/lib/api';
import { toastService } from '@/lib/toast';
import { useAuthStore, PerfilUsuario } from '@/lib/store';

export default function AuditoriasPage() {
  const { usuario } = useAuthStore();
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | 'em_andamento' | 'finalizada'>('todos');
  const [busca, setBusca] = useState('');
  const [reabrindoId, setReabrindoId] = useState<string | null>(null);
  const [showReabrirConfirm, setShowReabrirConfirm] = useState<string | null>(null);
  const [removendoId, setRemovendoId] = useState<string | null>(null);
  const [showRemoverConfirm, setShowRemoverConfirm] = useState<string | null>(null);
  const podeRemover = usuario?.perfil === PerfilUsuario.MASTER || usuario?.perfil === PerfilUsuario.GESTOR;

  const carregarAuditorias = async () => {
    try {
      const response = await auditoriaService.listar();
      setAuditorias(response.items || []);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarAuditorias();
  }, []);

  const handleReabrirClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowReabrirConfirm(id);
  };

  const handleReabrirConfirm = async () => {
    if (!showReabrirConfirm) return;
    try {
      setReabrindoId(showReabrirConfirm);
      await auditoriaService.reabrir(showReabrirConfirm);
      toastService.success('Auditoria reaberta com sucesso!');
      await carregarAuditorias();
      setShowReabrirConfirm(null);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setReabrindoId(null);
    }
  };

  const handleRemoverClick = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowRemoverConfirm(id);
  };

  const handleRemoverConfirm = async () => {
    if (!showRemoverConfirm) return;
    try {
      setRemovendoId(showRemoverConfirm);
      await auditoriaService.remover(showRemoverConfirm);
      toastService.success('Auditoria removida com sucesso!');
      await carregarAuditorias();
      setShowRemoverConfirm(null);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setRemovendoId(null);
    }
  };

  const auditoriasFiltradas = auditorias.filter((a) => {
    const matchFiltro = filtro === 'todos' || a.status === filtro;
    const clienteNome = a.unidade?.cliente?.nomeFantasia || a.unidade?.cliente?.razaoSocial || '';
    const matchBusca =
      !busca ||
      a.unidade?.nome?.toLowerCase().includes(busca.toLowerCase()) ||
      clienteNome.toLowerCase().includes(busca.toLowerCase());
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
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              type="text"
              placeholder="Buscar por cliente ou unidade..."
              className="input input-bordered w-full pl-10 text-sm sm:text-base"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="dropdown dropdown-end w-full sm:w-auto">
            <div tabIndex={0} role="button" className="btn btn-ghost gap-1 w-full sm:w-auto justify-start sm:justify-center">
              <Filter className="w-4 h-4" />
              <span className="sm:hidden">Filtrar</span>
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
                <div className="card bg-base-100 shadow-sm border border-base-300 hover:border-primary/30 transition-colors">
                  <div className="card-body p-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Informações principais */}
                      <Link
                        href={`/auditoria/${auditoria.id}`}
                        className="flex-1 min-w-0"
                      >
                        <div className="space-y-2">
                          <div>
                            <p className="font-medium text-base sm:text-base text-base-content truncate">
                              {auditoria.unidade?.nome || 'Unidade'}
                            </p>
                            <p className="text-sm text-base-content/60 truncate mt-0.5">
                              {auditoria.unidade?.cliente?.nomeFantasia || auditoria.unidade?.cliente?.razaoSocial || 'Cliente'}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {getStatusBadge(auditoria.status)}
                            <span className="text-xs text-base-content/50 flex items-center gap-1">
                              <Calendar className="w-3 h-3 flex-shrink-0" />
                              <span>{formatDate(auditoria.dataInicio)}</span>
                            </span>
                            {auditoria.status === 'finalizada' &&
                              auditoria.pontuacaoTotal !== undefined && (
                                <div
                                  className={`radial-progress text-xs sm:text-sm ${
                                    Number(auditoria.pontuacaoTotal) >= 80
                                      ? 'text-success'
                                      : Number(auditoria.pontuacaoTotal) >= 60
                                      ? 'text-warning'
                                      : 'text-error'
                                  }`}
                                  style={{
                                    '--value': Number(auditoria.pontuacaoTotal),
                                    '--size': '2.25rem',
                                    '--thickness': '3px',
                                  } as React.CSSProperties}
                                  role="progressbar"
                                >
                                  <span className="text-[10px] sm:text-xs font-bold">
                                    {Number(auditoria.pontuacaoTotal).toFixed(0)}%
                                  </span>
                                </div>
                              )}
                          </div>
                        </div>
                      </Link>
                      {/* Ações */}
                      <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-base-200">
                        <div className="flex items-center gap-1 sm:gap-2">
                          {auditoria.status === 'finalizada' && (
                            <button
                              onClick={(e) => handleReabrirClick(auditoria.id, e)}
                              disabled={reabrindoId === auditoria.id}
                              className="btn btn-ghost btn-xs sm:btn-sm gap-1 px-2 sm:px-4"
                              title="Reabrir auditoria"
                            >
                              {reabrindoId === auditoria.id ? (
                                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              )}
                              <span className="hidden sm:inline">Reabrir</span>
                            </button>
                          )}
                          {podeRemover && (
                            <button
                              onClick={(e) => handleRemoverClick(auditoria.id, e)}
                              disabled={removendoId === auditoria.id}
                              className="btn btn-ghost btn-xs sm:btn-sm text-error hover:text-error hover:bg-error/10 p-2 sm:px-4"
                              title="Remover auditoria"
                            >
                              {removendoId === auditoria.id ? (
                                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              )}
                            </button>
                          )}
                        </div>
                        <Link 
                          href={`/auditoria/${auditoria.id}`}
                          className="btn btn-ghost btn-xs sm:btn-sm p-2 sm:p-2 flex-shrink-0"
                          title="Ver detalhes"
                        >
                          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-base-content/30" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Reabertura */}
      <ConfirmDialog
        open={showReabrirConfirm !== null}
        onClose={() => setShowReabrirConfirm(null)}
        onConfirm={handleReabrirConfirm}
        title="Reabrir Auditoria"
        message="Tem certeza que deseja reabrir esta auditoria? Você poderá fazer alterações e finalizá-la novamente."
        confirmLabel="Reabrir"
        cancelLabel="Cancelar"
        variant="warning"
        loading={reabrindoId !== null}
      />

      {/* Modal de Confirmação de Remoção */}
      <ConfirmDialog
        open={showRemoverConfirm !== null}
        onClose={() => setShowRemoverConfirm(null)}
        onConfirm={handleRemoverConfirm}
        title="Remover Auditoria"
        message="Tem certeza que deseja remover esta auditoria? Esta ação não pode ser desfeita e todos os dados relacionados serão excluídos permanentemente."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="danger"
        loading={removendoId !== null}
      />
    </AppLayout>
  );
}


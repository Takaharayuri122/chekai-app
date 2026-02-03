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
  Building2,
  FileText,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
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
        return {
          text: 'Em andamento',
          bgColor: 'bg-warning',
          borderColor: 'border-warning',
        };
      case 'finalizada':
        return {
          text: 'Finalizada',
          bgColor: 'bg-success',
          borderColor: 'border-success',
        };
      case 'cancelada':
        return {
          text: 'Cancelada',
          bgColor: 'bg-error',
          borderColor: 'border-error',
        };
      default:
        return {
          text: status,
          bgColor: 'bg-base-300',
          borderColor: 'border-base-300',
        };
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getProgressoTexto = (auditoria: Auditoria) => {
    if (!auditoria.itens || auditoria.itens.length === 0) return '0%';
    const respondidos = auditoria.itens.filter((i) => i.resposta && i.resposta !== 'nao_avaliado').length;
    const total = auditoria.itens.length;
    const percentual = Math.round((respondidos / total) * 100);
    return `${percentual}% (${respondidos}/${total})`;
  };

  const getDiasEmAndamento = (dataInicio: string): number => {
    const inicio = new Date(dataInicio);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    inicio.setHours(0, 0, 0, 0);
    const diffTime = hoje.getTime() - inicio.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <AppLayout>
      <PageHeader 
        title="Auditorias" 
        subtitle="Gerencie e acompanhe todas as suas auditorias"
        action={
          <Link href="/admin/auditoria/nova" className="btn btn-primary btn-sm gap-2">
            <ClipboardCheck className="w-4 h-4" />
            Nova Auditoria
          </Link>
        }
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              type="text"
              placeholder="Buscar por cliente ou unidade..."
              className="input input-bordered w-full pl-10 text-sm"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="dropdown dropdown-end w-full sm:w-auto">
            <div tabIndex={0} role="button" className="btn btn-outline btn-sm gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4" />
              <span>Filtrar</span>
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
            actionHref="/admin/auditoria/nova"
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
                <div className={`card bg-base-100 shadow-sm border-2 ${getStatusBadge(auditoria.status).borderColor} hover:shadow-md transition-all relative overflow-hidden`}>
                  {/* Badge no canto superior direito */}
                  <div className={`absolute top-3 right-3 ${getStatusBadge(auditoria.status).bgColor} text-white px-3 py-1 text-xs font-semibold shadow-lg z-10 whitespace-nowrap rounded min-w-[110px] text-center`}>
                    {getStatusBadge(auditoria.status).text}
                  </div>
                  <Link
                    href={
                      auditoria.status === 'finalizada'
                        ? `/admin/auditoria/${auditoria.id}/relatorio`
                        : `/admin/auditoria/${auditoria.id}`
                    }
                    className="card-body p-4 sm:p-5 cursor-pointer"
                  >
                    <div className="flex flex-col lg:flex-row gap-4">
                      {/* Coluna Esquerda - Informações Principais */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <ClipboardCheck className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base text-base-content truncate mb-1">
                              {auditoria.unidade?.nome || 'Unidade não informada'}
                            </h3>
                            <p className="text-sm text-base-content/60 truncate flex items-center gap-1">
                              <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                              {auditoria.unidade?.cliente?.nomeFantasia || auditoria.unidade?.cliente?.razaoSocial || 'Cliente não informado'}
                            </p>
                          </div>
                        </div>

                        {/* Grid de Informações */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm mb-3">
                          <div className="flex items-center gap-2 text-base-content/70">
                            <Calendar className="w-4 h-4 text-base-content/40 flex-shrink-0" />
                            <span className="font-medium w-[60px] flex-shrink-0">Início:</span>
                            <span>{formatDate(auditoria.dataInicio)}</span>
                          </div>
                          {auditoria.status === 'em_andamento' && (
                            <div className="flex items-center gap-2 text-base-content/70">
                              <Clock className="w-4 h-4 text-warning flex-shrink-0" />
                              <span className="font-medium w-[120px] flex-shrink-0">Em andamento:</span>
                              <span className="font-semibold text-warning">
                                {getDiasEmAndamento(auditoria.dataInicio)} {getDiasEmAndamento(auditoria.dataInicio) === 1 ? 'dia' : 'dias'}
                              </span>
                            </div>
                          )}
                          {auditoria.dataFim && (
                            <div className="flex items-center gap-2 text-base-content/70">
                              <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                              <span className="font-medium w-[120px] flex-shrink-0">Finalizada:</span>
                              <span>{formatDate(auditoria.dataFim)}</span>
                            </div>
                          )}
                          {auditoria.template?.nome && (
                            <div className="flex items-center gap-2 text-base-content/70 sm:col-span-2">
                              <FileText className="w-4 h-4 text-base-content/40 flex-shrink-0" />
                              <span className="font-medium min-w-[80px]">Checklist:</span>
                              <span className="truncate">{auditoria.template.nome}</span>
                            </div>
                          )}
                          {auditoria.unidade?.endereco && (
                            <div className="flex items-center gap-2 text-base-content/70 sm:col-span-2">
                              <MapPin className="w-4 h-4 text-base-content/40 flex-shrink-0" />
                              <span className="font-medium min-w-[50px]">Local:</span>
                              <span className="truncate">{auditoria.unidade.endereco}</span>
                            </div>
                          )}
                          {auditoria.itens && auditoria.itens.length > 0 && (
                            <div className="flex items-center gap-2 text-base-content/70 sm:col-span-2">
                              <ClipboardCheck className="w-4 h-4 text-base-content/40 flex-shrink-0" />
                              <span className="font-medium min-w-[80px]">Progresso:</span>
                              <span>{getProgressoTexto(auditoria)}</span>
                            </div>
                          )}
                        </div>

                        {/* Pontuação Final (apenas para finalizadas) */}
                        {auditoria.status === 'finalizada' && auditoria.pontuacaoTotal !== undefined && (
                          <div className="flex items-center gap-3 pt-3 border-t border-base-200">
                            <div
                              className={`radial-progress flex-shrink-0 ${
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
                            <div>
                              <p className="text-xs font-medium text-base-content/60">Pontuação Final</p>
                              <p className={`text-sm font-semibold ${
                                Number(auditoria.pontuacaoTotal) >= 80
                                  ? 'text-success'
                                  : Number(auditoria.pontuacaoTotal) >= 60
                                  ? 'text-warning'
                                  : 'text-error'
                              }`}>
                                {Number(auditoria.pontuacaoTotal) >= 80
                                  ? 'Excelente'
                                  : Number(auditoria.pontuacaoTotal) >= 60
                                  ? 'Bom'
                                  : 'Atenção'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Coluna Direita - Ações */}
                      <div 
                        className="flex flex-row lg:flex-col items-center justify-end lg:items-start gap-2 pt-3 lg:pt-8 border-t lg:border-t-0 lg:border-l border-base-200 lg:pl-4 lg:min-w-[140px]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {auditoria.status === 'finalizada' && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleReabrirClick(auditoria.id, e);
                            }}
                            disabled={reabrindoId === auditoria.id}
                            className="btn btn-primary btn-sm gap-2 w-[110px]"
                            title="Reabrir auditoria"
                          >
                            {reabrindoId === auditoria.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                            <span>Reabrir</span>
                          </button>
                        )}
                        {podeRemover && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemoverClick(auditoria.id, e);
                            }}
                            disabled={removendoId === auditoria.id}
                            className="btn btn-error btn-sm gap-2 w-[110px]"
                            title="Remover auditoria"
                          >
                            {removendoId === auditoria.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            <span>Remover</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </Link>
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


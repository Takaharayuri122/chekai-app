'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ClipboardCheck,
  Plus,
  Building2,
  TrendingUp,
  Clock,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { AppLayout, StatCard, EmptyState } from '@/components';
import { auditoriaService, type Auditoria } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';

export default function DashboardPage() {
  const { usuario } = useAuthStore();
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [loading, setLoading] = useState(true);

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

  const auditoriasEmAndamento = auditorias.filter((a) => a.status === 'em_andamento');
  const auditoriasFinalizadas = auditorias.filter((a) => a.status === 'finalizada');
  const ultimasAuditorias = auditorias.slice(0, 5);

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
    });
  };

  return (
    <AppLayout>
      <div className="px-4 py-6 lg:px-8 space-y-6">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-base-content">
            Olá, {usuario?.nome?.split(' ')[0] || 'Usuário'} 👋
          </h1>
          <p className="text-base-content/60">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link
            href="/auditoria/nova"
            className="btn btn-primary btn-lg w-full gap-2 justify-start"
          >
            <Plus className="w-5 h-5" />
            Iniciar Nova Auditoria
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatCard
            title="Em Andamento"
            value={auditoriasEmAndamento.length}
            icon={Clock}
            color="warning"
          />
          <StatCard
            title="Finalizadas"
            value={auditoriasFinalizadas.length}
            icon={ClipboardCheck}
            color="success"
          />
          <StatCard
            title="Este Mês"
            value={auditorias.filter((a) => {
              const date = new Date(a.dataInicio);
              const now = new Date();
              return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
            }).length}
            icon={Calendar}
            color="info"
          />
          <StatCard
            title="Clientes"
            value={new Set(auditorias.map((a) => a.unidade?.cliente?.id)).size}
            icon={Building2}
            color="secondary"
          />
        </motion.div>

        {/* Recent Audits */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-base-content">Auditorias Recentes</h2>
            {auditorias.length > 0 && (
              <Link href="/auditorias" className="btn btn-ghost btn-sm gap-1">
                Ver todas
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body items-center py-12">
                <span className="loading loading-spinner loading-lg text-primary"></span>
              </div>
            </div>
          ) : auditorias.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Nenhuma auditoria ainda"
              description="Inicie sua primeira auditoria para começar a usar o ChekAI."
              actionLabel="Iniciar Auditoria"
              actionHref="/auditoria/nova"
            />
          ) : (
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="divide-y divide-base-200">
                {ultimasAuditorias.map((auditoria, index) => (
                  <Link
                    key={auditoria.id}
                    href={`/auditoria/${auditoria.id}`}
                    className="flex items-center gap-4 p-4 hover:bg-base-200/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-base-content truncate">
                        {auditoria.unidade?.nome || 'Unidade'}
                      </p>
                      <p className="text-sm text-base-content/60 truncate">
                        {auditoria.unidade?.cliente?.nome || 'Cliente'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {getStatusBadge(auditoria.status)}
                      <span className="text-xs text-base-content/50">
                        {formatDate(auditoria.dataInicio)}
                      </span>
                    </div>
                    {auditoria.status === 'finalizada' && auditoria.pontuacaoTotal !== undefined && (
                      <div className="text-right">
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
                            '--size': '2.5rem',
                            '--thickness': '3px',
                          } as React.CSSProperties}
                          role="progressbar"
                        >
                          <span className="text-xs font-bold">
                            {Number(auditoria.pontuacaoTotal).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* In Progress */}
        {auditoriasEmAndamento.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-lg font-semibold text-base-content mb-4">
              Continuar Auditoria
            </h2>
            <div className="space-y-3">
              {auditoriasEmAndamento.slice(0, 3).map((auditoria) => (
                <Link
                  key={auditoria.id}
                  href={`/auditoria/${auditoria.id}`}
                  className="card bg-warning/10 border border-warning/20 hover:border-warning/40 transition-colors"
                >
                  <div className="card-body p-4 flex-row items-center gap-4">
                    <div className="w-10 h-10 bg-warning/20 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-warning" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-base-content truncate">
                        {auditoria.unidade?.nome}
                      </p>
                      <p className="text-sm text-base-content/60">
                        Iniciada em {formatDate(auditoria.dataInicio)}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-base-content/40" />
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}

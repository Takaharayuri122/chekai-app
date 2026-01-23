'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Coins,
  Loader2,
  TrendingUp,
  TrendingDown,
  Calendar,
  User,
  Zap,
} from 'lucide-react';
import { AppLayout, PageHeader, StatCard } from '@/components';
import {
  gestorService,
  SaldoCreditos,
  UsoCredito,
} from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';

export default function CreditosPage() {
  const router = useRouter();
  const { isGestor, isMaster } = useAuthStore();
  const [saldo, setSaldo] = useState<SaldoCreditos | null>(null);
  const [historico, setHistorico] = useState<UsoCredito[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    if (!isGestor() && !isMaster()) {
      router.push('/dashboard');
      return;
    }
    carregarCreditos();
  }, [isGestor, isMaster, router, page]);

  const carregarCreditos = async () => {
    try {
      const data = await gestorService.consultarCreditos(page, limit);
      setSaldo(data.saldo);
      setHistorico(data.historico.items || []);
      setTotal(data.historico.total || 0);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  };

  const formatarData = (data: string) => {
    return new Date(data).toLocaleString('pt-BR');
  };

  const getProvedorBadge = (provedor: string) => {
    switch (provedor) {
      case 'openai':
        return <span className="badge badge-info badge-sm">OpenAI</span>;
      case 'deepseek':
        return <span className="badge badge-secondary badge-sm">DeepSeek</span>;
      default:
        return <span className="badge badge-ghost badge-sm">{provedor}</span>;
    }
  };

  const calcularPercentual = (usado: number, limite: number) => {
    if (limite === 0) return 0;
    return Math.min(100, Math.round((usado / limite) * 100));
  };

  if (!isGestor() && !isMaster()) {
    return null;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Créditos de IA"
        subtitle="Visualize seu saldo e histórico de uso"
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {loading ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          </div>
        ) : saldo ? (
          <>
            {/* Cards de Saldo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Limite Total"
                value={saldo.limite.toLocaleString('pt-BR')}
                icon={Coins}
                color="info"
              />
              <StatCard
                title="Créditos Usados"
                value={saldo.usado.toLocaleString('pt-BR')}
                icon={TrendingUp}
                color={
                  calcularPercentual(saldo.usado, saldo.limite) >= 90
                    ? 'error'
                    : calcularPercentual(saldo.usado, saldo.limite) >= 70
                      ? 'warning'
                      : 'success'
                }
              />
              <StatCard
                title="Créditos Disponíveis"
                value={saldo.disponivel.toLocaleString('pt-BR')}
                icon={TrendingDown}
                color={
                  saldo.disponivel === 0
                    ? 'error'
                    : saldo.disponivel < saldo.limite * 0.1
                      ? 'warning'
                      : 'success'
                }
              />
            </div>

            {/* Barra de Progresso */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">Uso de Créditos</span>
                  <span
                    className={`text-sm font-medium ${
                      calcularPercentual(saldo.usado, saldo.limite) >= 90
                        ? 'text-error'
                        : calcularPercentual(saldo.usado, saldo.limite) >= 70
                          ? 'text-warning'
                          : 'text-success'
                    }`}
                  >
                    {calcularPercentual(saldo.usado, saldo.limite)}%
                  </span>
                </div>
                <progress
                  className="progress progress-primary w-full"
                  value={calcularPercentual(saldo.usado, saldo.limite)}
                  max="100"
                />
                <div className="flex justify-between text-xs text-base-content/60 mt-2">
                  <span>0</span>
                  <span>{saldo.limite.toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </div>

            {/* Histórico */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body">
                <h3 className="card-title mb-4">Histórico de Uso</h3>
                {historico.length === 0 ? (
                  <div className="text-center py-8 text-base-content/60">
                    Nenhum uso registrado ainda
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="table table-zebra">
                        <thead>
                          <tr>
                            <th>Data</th>
                            <th>Usuário</th>
                            <th>Provedor</th>
                            <th>Modelo</th>
                            <th>Método</th>
                            <th>Tokens</th>
                            <th>Créditos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {historico.map((uso) => (
                            <tr key={uso.id}>
                              <td>
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-base-content/40" />
                                  <span className="text-sm">
                                    {formatarData(uso.criadoEm)}
                                  </span>
                                </div>
                              </td>
                              <td>
                                {uso.usuario ? (
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-base-content/40" />
                                    <span className="text-sm">
                                      {uso.usuario.nome}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-sm text-base-content/60">
                                    -
                                  </span>
                                )}
                              </td>
                              <td>{getProvedorBadge(uso.provedor)}</td>
                              <td>
                                <span className="text-sm font-mono">
                                  {uso.modelo}
                                </span>
                              </td>
                              <td>
                                <span className="text-sm">{uso.metodoChamado}</span>
                              </td>
                              <td>
                                <div className="flex items-center gap-1">
                                  <Zap className="w-3 h-3 text-base-content/40" />
                                  <span className="text-sm">
                                    {uso.tokensTotal.toLocaleString('pt-BR')}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className="text-sm font-medium">
                                  {uso.creditosConsumidos.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Paginação */}
                    {total > limit && (
                      <div className="flex justify-center gap-2 mt-4">
                        <button
                          className="btn btn-sm btn-outline"
                          disabled={page === 1}
                          onClick={() => setPage(page - 1)}
                        >
                          Anterior
                        </button>
                        <span className="btn btn-sm btn-ghost">
                          Página {page} de {Math.ceil(total / limit)}
                        </span>
                        <button
                          className="btn btn-sm btn-outline"
                          disabled={page >= Math.ceil(total / limit)}
                          onClick={() => setPage(page + 1)}
                        >
                          Próxima
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <Coins className="w-12 h-12 text-warning mb-4" />
              <h3 className="card-title mb-2">Nenhuma assinatura ativa</h3>
              <p className="text-base-content/60">
                Entre em contato com o administrador para ativar um plano.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}


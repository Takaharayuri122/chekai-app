'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3,
  Loader2,
  TrendingUp,
  TrendingDown,
  Calendar,
  Filter,
  Download,
  Coins,
  Zap,
  Users,
  Package,
  Activity,
} from 'lucide-react';
import { AppLayout, PageHeader, StatCard, EmptyState } from '@/components';
import {
  auditoriaTokensService,
  EstatisticasTokens,
  UsoCredito,
  ProvedorIa,
} from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';

export default function AuditoriaTokensPage() {
  const router = useRouter();
  const { isMaster } = useAuthStore();
  const [estatisticas, setEstatisticas] = useState<EstatisticasTokens | null>(null);
  const [historico, setHistorico] = useState<{ items: UsoCredito[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [page, setPage] = useState(1);
  const [filtros, setFiltros] = useState({
    dataInicio: '',
    dataFim: '',
    gestorId: '',
    provedor: '' as ProvedorIa | '',
  });
  const limit = 50;

  useEffect(() => {
    if (!isMaster()) {
      router.push('/dashboard');
      return;
    }
    carregarDados();
  }, [isMaster, router]);

  useEffect(() => {
    if (filtros.dataInicio || filtros.dataFim || filtros.gestorId || filtros.provedor) {
      carregarDados();
    }
  }, [filtros]);

  useEffect(() => {
    carregarHistorico();
  }, [page, filtros]);

  const carregarDados = async () => {
    try {
      const data = await auditoriaTokensService.obterEstatisticas(
        filtros.dataInicio || undefined,
        filtros.dataFim || undefined,
      );
      setEstatisticas(data);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  };

  const carregarHistorico = async () => {
    setLoadingHistorico(true);
    try {
      const data = await auditoriaTokensService.listarHistorico(
        page,
        limit,
        filtros.gestorId || undefined,
        filtros.provedor || undefined,
        filtros.dataInicio || undefined,
        filtros.dataFim || undefined,
      );
      setHistorico(data);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setLoadingHistorico(false);
    }
  };

  const formatarNumero = (num: number) => {
    return new Intl.NumberFormat('pt-BR').format(num);
  };

  const formatarData = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatarDataHora = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!estatisticas) {
    return (
      <AppLayout>
        <PageHeader
          title="Auditoria de Tokens IA"
          subtitle="Monitoramento de uso de tokens de Inteligência Artificial"
        />
        <div className="px-4 py-4 lg:px-8">
          <EmptyState
            icon={BarChart3}
            title="Erro ao carregar estatísticas"
            description="Não foi possível carregar as estatísticas de tokens."
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Auditoria de Tokens IA"
        subtitle="Monitoramento detalhado de uso de tokens de Inteligência Artificial"
      />

      <div className="px-4 py-4 lg:px-8 space-y-6">
        {/* Filtros */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-4">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Filtros</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Data Início</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={filtros.dataInicio}
                  onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Data Fim</span>
                </label>
                <input
                  type="date"
                  className="input input-bordered"
                  value={filtros.dataFim}
                  onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Provedor</span>
                </label>
                <select
                  className="select select-bordered"
                  value={filtros.provedor}
                  onChange={(e) => setFiltros({ ...filtros, provedor: e.target.value as ProvedorIa | '' })}
                >
                  <option value="">Todos</option>
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Ações</span>
                </label>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setFiltros({ dataInicio: '', dataFim: '', gestorId: '', provedor: '' });
                    setPage(1);
                  }}
                >
                  Limpar Filtros
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Estatísticas Gerais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total de Tokens"
            value={formatarNumero(estatisticas.total.tokensTotal)}
            icon={Zap}
            color="primary"
            subtitle={`Input: ${formatarNumero(estatisticas.total.tokensInput)} | Output: ${formatarNumero(estatisticas.total.tokensOutput)}`}
          />
          <StatCard
            title="Créditos Consumidos"
            value={formatarNumero(estatisticas.total.creditosConsumidos)}
            icon={Coins}
            color="warning"
          />
          <StatCard
            title="Total de Usos"
            value={formatarNumero(estatisticas.total.totalUsos)}
            icon={Activity}
            color="info"
          />
          <StatCard
            title="Média Tokens/Uso"
            value={estatisticas.total.totalUsos > 0 
              ? formatarNumero(Math.round(estatisticas.total.tokensTotal / estatisticas.total.totalUsos))
              : '0'}
            icon={TrendingUp}
            color="success"
          />
          <StatCard
            title="Provedores"
            value={estatisticas.porProvedor.length.toString()}
            icon={Package}
            color="accent"
          />
        </div>

        {/* Estatísticas por Provedor */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-4">
            <h3 className="card-title text-lg mb-4">Por Provedor</h3>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Provedor</th>
                    <th>Tokens Input</th>
                    <th>Tokens Output</th>
                    <th>Tokens Total</th>
                    <th>Créditos</th>
                    <th>Usos</th>
                  </tr>
                </thead>
                <tbody>
                  {estatisticas.porProvedor.map((item) => (
                    <tr key={item.provedor}>
                      <td>
                        <span className="badge badge-primary capitalize">{item.provedor}</span>
                      </td>
                      <td>{formatarNumero(item.tokensInput)}</td>
                      <td>{formatarNumero(item.tokensOutput)}</td>
                      <td className="font-semibold">{formatarNumero(item.tokensTotal)}</td>
                      <td>{formatarNumero(item.creditosConsumidos)}</td>
                      <td>{formatarNumero(item.totalUsos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Estatísticas por Modelo */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-4">
            <h3 className="card-title text-lg mb-4">Por Modelo</h3>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Provedor</th>
                    <th>Modelo</th>
                    <th>Tokens Input</th>
                    <th>Tokens Output</th>
                    <th>Tokens Total</th>
                    <th>Créditos</th>
                    <th>Usos</th>
                  </tr>
                </thead>
                <tbody>
                  {estatisticas.porModelo.map((item, index) => (
                    <tr key={`${item.provedor}-${item.modelo}-${index}`}>
                      <td>
                        <span className="badge badge-primary badge-sm capitalize">{item.provedor}</span>
                      </td>
                      <td>
                        <code className="text-sm bg-base-200 px-2 py-1 rounded">{item.modelo}</code>
                      </td>
                      <td>{formatarNumero(item.tokensInput)}</td>
                      <td>{formatarNumero(item.tokensOutput)}</td>
                      <td className="font-semibold">{formatarNumero(item.tokensTotal)}</td>
                      <td>{formatarNumero(item.creditosConsumidos)}</td>
                      <td>{formatarNumero(item.totalUsos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Estatísticas por Gestor */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-4">
            <h3 className="card-title text-lg mb-4">Por Gestor</h3>
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Gestor</th>
                    <th>Tokens Input</th>
                    <th>Tokens Output</th>
                    <th>Tokens Total</th>
                    <th>Créditos</th>
                    <th>Usos</th>
                  </tr>
                </thead>
                <tbody>
                  {estatisticas.porGestor.map((item) => (
                    <tr key={item.gestorId}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          <span className="font-medium">{item.gestorNome}</span>
                        </div>
                      </td>
                      <td>{formatarNumero(item.tokensInput)}</td>
                      <td>{formatarNumero(item.tokensOutput)}</td>
                      <td className="font-semibold">{formatarNumero(item.tokensTotal)}</td>
                      <td>{formatarNumero(item.creditosConsumidos)}</td>
                      <td>{formatarNumero(item.totalUsos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Estatísticas por Período */}
        {estatisticas.porPeriodo.length > 0 && (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body p-4">
              <h3 className="card-title text-lg mb-4">Uso por Período</h3>
              <div className="overflow-x-auto">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Tokens Input</th>
                      <th>Tokens Output</th>
                      <th>Tokens Total</th>
                      <th>Créditos</th>
                      <th>Usos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estatisticas.porPeriodo.slice(-30).map((item) => (
                      <tr key={item.data}>
                        <td>
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-info" />
                            <span>{formatarData(item.data)}</span>
                          </div>
                        </td>
                        <td>{formatarNumero(item.tokensInput)}</td>
                        <td>{formatarNumero(item.tokensOutput)}</td>
                        <td className="font-semibold">{formatarNumero(item.tokensTotal)}</td>
                        <td>{formatarNumero(item.creditosConsumidos)}</td>
                        <td>{formatarNumero(item.totalUsos)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Histórico Detalhado */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="card-title text-lg">Histórico Detalhado</h3>
              {historico && historico.total > 0 && (
                <div className="text-sm text-base-content/70">
                  Total: {formatarNumero(historico.total)} registros
                </div>
              )}
            </div>
            {loadingHistorico ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : !historico || historico.items.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Nenhum registro encontrado"
                description="Não há registros de uso de tokens no período selecionado."
              />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="table table-zebra">
                    <thead>
                      <tr>
                        <th>Data/Hora</th>
                        <th>Gestor</th>
                        <th>Usuário</th>
                        <th>Provedor</th>
                        <th>Modelo</th>
                        <th>Tokens (I/O)</th>
                        <th>Total</th>
                        <th>Créditos</th>
                        <th>Método</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historico.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <span className="text-sm">{formatarDataHora(item.criadoEm)}</span>
                          </td>
                          <td>
                            <span className="text-sm">{item.gestor?.nome || 'N/A'}</span>
                          </td>
                          <td>
                            <span className="text-sm">{item.usuario?.nome || 'N/A'}</span>
                          </td>
                          <td>
                            <span className="badge badge-primary badge-sm capitalize">{item.provedor}</span>
                          </td>
                          <td>
                            <code className="text-xs bg-base-200 px-2 py-1 rounded">{item.modelo}</code>
                          </td>
                          <td>
                            <span className="text-sm">
                              {formatarNumero(item.tokensInput)} / {formatarNumero(item.tokensOutput)}
                            </span>
                          </td>
                          <td className="font-semibold">{formatarNumero(item.tokensTotal)}</td>
                          <td>{formatarNumero(item.creditosConsumidos)}</td>
                          <td>
                            <span className="text-xs text-base-content/70" title={item.metodoChamado}>
                              {item.metodoChamado?.split('/').pop() || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {historico.total > limit && (
                  <div className="join mt-4 flex justify-center">
                    <button
                      className="join-item btn"
                      onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                      disabled={page === 1}
                    >
                      «
                    </button>
                    <button className="join-item btn">
                      Página {page} de {Math.ceil(historico.total / limit)}
                    </button>
                    <button
                      className="join-item btn"
                      onClick={() => setPage((prev) => prev + 1)}
                      disabled={page * limit >= historico.total}
                    >
                      »
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}


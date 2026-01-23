'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  ClipboardCheck,
  Building2,
  Coins,
  Package,
  Loader2,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { AppLayout, PageHeader, StatCard } from '@/components';
import { gestorService, LimitesGestor } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';

export default function LimitesPage() {
  const router = useRouter();
  const { isGestor, isMaster } = useAuthStore();
  const [limites, setLimites] = useState<LimitesGestor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isGestor() && !isMaster()) {
      router.push('/dashboard');
      return;
    }
    carregarLimites();
  }, [isGestor, isMaster, router]);

  const carregarLimites = async () => {
    try {
      const data = await gestorService.consultarLimites();
      setLimites(data);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  };

  const calcularPercentual = (usado: number, limite: number) => {
    if (limite === 0) return 0;
    return Math.min(100, Math.round((usado / limite) * 100));
  };

  const getColorClass = (percentual: number) => {
    if (percentual >= 90) return 'text-error';
    if (percentual >= 70) return 'text-warning';
    return 'text-success';
  };

  if (!isGestor() && !isMaster()) {
    return null;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Meus Limites"
        subtitle="Visualize seus limites e uso atual"
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {loading ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          </div>
        ) : limites ? (
          <>
            {/* Plano Atual */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body">
                <div className="flex items-center gap-3 mb-4">
                  <Package className="w-6 h-6 text-primary" />
                  <h2 className="card-title">Plano: {limites.plano.nome}</h2>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Usuários"
                value={`${limites.uso.usuarios} / ${limites.plano.limiteUsuarios}`}
                icon={Users}
                color={
                  calcularPercentual(
                    limites.uso.usuarios,
                    limites.plano.limiteUsuarios,
                  ) >= 90
                    ? 'error'
                    : calcularPercentual(
                        limites.uso.usuarios,
                        limites.plano.limiteUsuarios,
                      ) >= 70
                      ? 'warning'
                      : 'success'
                }
              />
              <StatCard
                title="Auditorias"
                value={`${limites.uso.auditorias} / ${limites.plano.limiteAuditorias}`}
                icon={ClipboardCheck}
                color={
                  calcularPercentual(
                    limites.uso.auditorias,
                    limites.plano.limiteAuditorias,
                  ) >= 90
                    ? 'error'
                    : calcularPercentual(
                        limites.uso.auditorias,
                        limites.plano.limiteAuditorias,
                      ) >= 70
                      ? 'warning'
                      : 'success'
                }
              />
              <StatCard
                title="Clientes"
                value={`${limites.uso.clientes} / ${limites.plano.limiteClientes}`}
                icon={Building2}
                color={
                  calcularPercentual(
                    limites.uso.clientes,
                    limites.plano.limiteClientes,
                  ) >= 90
                    ? 'error'
                    : calcularPercentual(
                        limites.uso.clientes,
                        limites.plano.limiteClientes,
                      ) >= 70
                      ? 'warning'
                      : 'success'
                }
              />
              <StatCard
                title="Créditos IA"
                value={`${limites.uso.creditos.toLocaleString('pt-BR')} / ${limites.plano.limiteCreditos.toLocaleString('pt-BR')}`}
                icon={Coins}
                color={
                  calcularPercentual(
                    limites.uso.creditos,
                    limites.plano.limiteCreditos,
                  ) >= 90
                    ? 'error'
                    : calcularPercentual(
                        limites.uso.creditos,
                        limites.plano.limiteCreditos,
                      ) >= 70
                      ? 'warning'
                      : 'success'
                }
              />
            </div>

            {/* Barras de Progresso */}
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body">
                <h3 className="card-title mb-4">Uso Detalhado</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Usuários</span>
                      <span
                        className={`text-sm font-medium ${getColorClass(
                          calcularPercentual(
                            limites.uso.usuarios,
                            limites.plano.limiteUsuarios,
                          ),
                        )}`}
                      >
                        {calcularPercentual(
                          limites.uso.usuarios,
                          limites.plano.limiteUsuarios,
                        )}
                        %
                      </span>
                    </div>
                    <progress
                      className="progress progress-primary w-full"
                      value={calcularPercentual(
                        limites.uso.usuarios,
                        limites.plano.limiteUsuarios,
                      )}
                      max="100"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Auditorias</span>
                      <span
                        className={`text-sm font-medium ${getColorClass(
                          calcularPercentual(
                            limites.uso.auditorias,
                            limites.plano.limiteAuditorias,
                          ),
                        )}`}
                      >
                        {calcularPercentual(
                          limites.uso.auditorias,
                          limites.plano.limiteAuditorias,
                        )}
                        %
                      </span>
                    </div>
                    <progress
                      className="progress progress-primary w-full"
                      value={calcularPercentual(
                        limites.uso.auditorias,
                        limites.plano.limiteAuditorias,
                      )}
                      max="100"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Clientes</span>
                      <span
                        className={`text-sm font-medium ${getColorClass(
                          calcularPercentual(
                            limites.uso.clientes,
                            limites.plano.limiteClientes,
                          ),
                        )}`}
                      >
                        {calcularPercentual(
                          limites.uso.clientes,
                          limites.plano.limiteClientes,
                        )}
                        %
                      </span>
                    </div>
                    <progress
                      className="progress progress-primary w-full"
                      value={calcularPercentual(
                        limites.uso.clientes,
                        limites.plano.limiteClientes,
                      )}
                      max="100"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">Créditos IA</span>
                      <span
                        className={`text-sm font-medium ${getColorClass(
                          calcularPercentual(
                            limites.uso.creditos,
                            limites.plano.limiteCreditos,
                          ),
                        )}`}
                      >
                        {calcularPercentual(
                          limites.uso.creditos,
                          limites.plano.limiteCreditos,
                        )}
                        %
                      </span>
                    </div>
                    <progress
                      className="progress progress-primary w-full"
                      value={calcularPercentual(
                        limites.uso.creditos,
                        limites.plano.limiteCreditos,
                      )}
                      max="100"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Alertas */}
            {Object.entries({
              usuarios: {
                usado: limites.uso.usuarios,
                limite: limites.plano.limiteUsuarios,
                label: 'usuários',
              },
              auditorias: {
                usado: limites.uso.auditorias,
                limite: limites.plano.limiteAuditorias,
                label: 'auditorias',
              },
              clientes: {
                usado: limites.uso.clientes,
                limite: limites.plano.limiteClientes,
                label: 'clientes',
              },
              creditos: {
                usado: limites.uso.creditos,
                limite: limites.plano.limiteCreditos,
                label: 'créditos',
              },
            }).map(([key, { usado, limite, label }]) => {
              const percentual = calcularPercentual(usado, limite);
              if (percentual >= 90) {
                return (
                  <div
                    key={key}
                    className="alert alert-error shadow-lg"
                  >
                    <AlertCircle className="w-6 h-6" />
                    <div>
                      <h3 className="font-bold">Limite quase esgotado!</h3>
                      <div className="text-sm">
                        Você está usando {percentual}% do limite de {label} (
                        {usado} de {limite}).
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })}
          </>
        ) : (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <AlertCircle className="w-12 h-12 text-warning mb-4" />
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


'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  UserCheck,
  Plus,
  Loader2,
  Package,
  Calendar,
  X,
} from 'lucide-react';
import { AppLayout, PageHeader, EmptyState } from '@/components';
import {
  planoService,
  usuarioService,
  Plano,
  Usuario,
  Assinatura,
  CriarAssinaturaRequest,
  PerfilUsuario,
} from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';

export default function AssinaturasPage() {
  const router = useRouter();
  const { isMaster } = useAuthStore();
  const [gestores, setGestores] = useState<Usuario[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  const [assinaturaForm, setAssinaturaForm] = useState<CriarAssinaturaRequest>({
    gestorId: '',
    planoId: '',
    dataInicio: new Date().toISOString().split('T')[0],
    dataFim: '',
  });

  useEffect(() => {
    if (!isMaster()) {
      router.push('/dashboard');
      return;
    }
    carregarDados();
  }, [isMaster, router]);

  const carregarDados = async () => {
    try {
      const [gestoresResponse, planosResponse] = await Promise.all([
        usuarioService.listar(1, 100, PerfilUsuario.GESTOR),
        planoService.listar(1, 100),
      ]);
      setGestores(gestoresResponse.items || []);
      setPlanos(planosResponse.items || []);
      // Carregar assinaturas de cada gestor
      const assinaturasPromises = gestoresResponse.items.map(async (gestor) => {
        try {
          const assinatura = await planoService.buscarAssinaturaGestor(gestor.id);
          return assinatura ? { ...assinatura, gestor } : null;
        } catch {
          return null;
        }
      });
      const assinaturasResult = await Promise.all(assinaturasPromises);
      setAssinaturas(assinaturasResult.filter((a) => a !== null) as Assinatura[]);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  };

  const handleCriarAssinatura = async () => {
    if (!assinaturaForm.gestorId || !assinaturaForm.planoId) {
      toastService.warning('Selecione o gestor e o plano');
      return;
    }
    setSaving(true);

    try {
      await planoService.criarAssinatura(assinaturaForm.planoId, assinaturaForm);
      toastService.success('Assinatura criada com sucesso!');
      await carregarDados();
      handleFecharModal();
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleFecharModal = () => {
    setShowModal(false);
    setAssinaturaForm({
      gestorId: '',
      planoId: '',
      dataInicio: new Date().toISOString().split('T')[0],
      dataFim: '',
    });
  };

  const formatarData = (data?: string) => {
    if (!data) return 'Sem data de término';
    return new Date(data).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ativa':
        return <span className="badge badge-success badge-sm">Ativa</span>;
      case 'cancelada':
        return <span className="badge badge-error badge-sm">Cancelada</span>;
      case 'expirada':
        return <span className="badge badge-warning badge-sm">Expirada</span>;
      default:
        return <span className="badge badge-ghost badge-sm">{status}</span>;
    }
  };

  if (!isMaster()) {
    return null;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Assinaturas"
        subtitle="Gerencie as assinaturas dos gestores"
        action={
          <button
            className="btn btn-primary gap-2"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-4 h-4" />
            Nova Assinatura
          </button>
        }
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {loading ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          </div>
        ) : assinaturas.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="Nenhuma assinatura encontrada"
            description="Comece criando uma nova assinatura"
            actionLabel="Nova Assinatura"
            actionOnClick={() => setShowModal(true)}
          />
        ) : (
          <div className="card bg-base-100 shadow-sm border border-base-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Gestor</th>
                    <th>Plano</th>
                    <th>Status</th>
                    <th>Data Início</th>
                    <th>Data Fim</th>
                  </tr>
                </thead>
                <tbody>
                  {assinaturas.map((assinatura) => (
                    <tr key={assinatura.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="avatar placeholder">
                            <div className="bg-primary text-primary-content rounded-full w-10">
                              <UserCheck className="w-5 h-5" />
                            </div>
                          </div>
                          <div>
                            <div className="font-medium">
                              {(assinatura as any).gestor?.nome || 'Gestor'}
                            </div>
                            <div className="text-sm text-base-content/60">
                              {(assinatura as any).gestor?.email || ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-primary" />
                          <span>{assinatura.plano.nome}</span>
                        </div>
                      </td>
                      <td>{getStatusBadge(assinatura.status)}</td>
                      <td>{formatarData(assinatura.dataInicio)}</td>
                      <td>{formatarData(assinatura.dataFim)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de criação */}
      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">Nova Assinatura</h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Gestor *</span>
                </label>
                <select
                  className="select select-bordered"
                  value={assinaturaForm.gestorId}
                  onChange={(e) =>
                    setAssinaturaForm({
                      ...assinaturaForm,
                      gestorId: e.target.value,
                    })
                  }
                >
                  <option value="">Selecione um gestor</option>
                  {gestores.map((gestor) => (
                    <option key={gestor.id} value={gestor.id}>
                      {gestor.nome} ({gestor.email})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Plano *</span>
                </label>
                <select
                  className="select select-bordered"
                  value={assinaturaForm.planoId}
                  onChange={(e) =>
                    setAssinaturaForm({
                      ...assinaturaForm,
                      planoId: e.target.value,
                    })
                  }
                >
                  <option value="">Selecione um plano</option>
                  {planos
                    .filter((p) => p.ativo)
                    .map((plano) => (
                      <option key={plano.id} value={plano.id}>
                        {plano.nome}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Data de Início</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered"
                    value={assinaturaForm.dataInicio}
                    onChange={(e) =>
                      setAssinaturaForm({
                        ...assinaturaForm,
                        dataInicio: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Data de Fim (opcional)</span>
                  </label>
                  <input
                    type="date"
                    className="input input-bordered"
                    value={assinaturaForm.dataFim}
                    onChange={(e) =>
                      setAssinaturaForm({
                        ...assinaturaForm,
                        dataFim: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={handleFecharModal}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCriarAssinatura}
                disabled={
                  saving || !assinaturaForm.gestorId || !assinaturaForm.planoId
                }
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Criar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}


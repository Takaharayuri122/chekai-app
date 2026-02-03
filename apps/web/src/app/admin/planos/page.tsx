'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  Plus,
  Loader2,
  Edit,
  Trash2,
  Search,
  Users,
  ClipboardCheck,
  Building2,
  Coins,
} from 'lucide-react';
import { AppLayout, PageHeader, EmptyState } from '@/components';
import {
  planoService,
  Plano,
  CriarPlanoRequest,
  PaginatedResult,
} from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';

export default function PlanosPage() {
  const router = useRouter();
  const { isMaster } = useAuthStore();
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlano, setEditingPlano] = useState<Plano | null>(null);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState('');

  const [planoForm, setPlanoForm] = useState<CriarPlanoRequest>({
    nome: '',
    descricao: '',
    limiteUsuarios: 0,
    limiteAuditorias: 0,
    limiteClientes: 0,
    limiteCreditos: 0,
    ativo: true,
  });

  useEffect(() => {
    if (!isMaster()) {
      router.push('/admin/dashboard');
      return;
    }
    carregarPlanos();
  }, [isMaster, router]);

  const carregarPlanos = async () => {
    try {
      const response: PaginatedResult<Plano> = await planoService.listar(1, 100);
      setPlanos(response.items || []);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  };

  const handleCriarPlano = async () => {
    if (!planoForm.nome) {
      toastService.warning('O nome do plano é obrigatório');
      return;
    }
    setSaving(true);

    try {
      if (editingPlano) {
        await planoService.atualizar(editingPlano.id, planoForm);
        toastService.success('Plano atualizado com sucesso!');
      } else {
        await planoService.criar(planoForm);
        toastService.success('Plano criado com sucesso!');
      }
      await carregarPlanos();
      handleFecharModal();
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleEditarPlano = (plano: Plano) => {
    setEditingPlano(plano);
    setPlanoForm({
      nome: plano.nome,
      descricao: plano.descricao || '',
      limiteUsuarios: plano.limiteUsuarios,
      limiteAuditorias: plano.limiteAuditorias,
      limiteClientes: plano.limiteClientes,
      limiteCreditos: plano.limiteCreditos,
      ativo: plano.ativo,
    });
    setShowModal(true);
  };

  const handleFecharModal = () => {
    setShowModal(false);
    setEditingPlano(null);
    setPlanoForm({
      nome: '',
      descricao: '',
      limiteUsuarios: 0,
      limiteAuditorias: 0,
      limiteClientes: 0,
      limiteCreditos: 0,
      ativo: true,
    });
  };

  const handleRemoverPlano = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este plano?')) return;

    try {
      await planoService.remover(id);
      toastService.success('Plano removido com sucesso!');
      await carregarPlanos();
    } catch (error) {
      // Erro já é tratado pelo interceptor
    }
  };

  const planosFiltrados = planos.filter((p) => {
    const matchBusca =
      !busca ||
      p.nome.toLowerCase().includes(busca.toLowerCase()) ||
      (p.descricao && p.descricao.toLowerCase().includes(busca.toLowerCase()));
    return matchBusca;
  });

  if (!isMaster()) {
    return null;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Planos"
        subtitle="Gerencie os planos disponíveis no sistema"
        action={
          <button
            className="btn btn-primary gap-2"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-4 h-4" />
            Novo Plano
          </button>
        }
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
          <input
            type="text"
            placeholder="Buscar planos..."
            className="input input-bordered w-full pl-10"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Cards de Planos */}
        {loading ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          </div>
        ) : planosFiltrados.length === 0 ? (
          <EmptyState
            icon={Package}
            title="Nenhum plano encontrado"
            description={
              busca
                ? 'Tente ajustar a busca.'
                : 'Comece criando um novo plano'
            }
            actionLabel={!busca ? 'Novo Plano' : undefined}
            actionOnClick={() => setShowModal(true)}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {planosFiltrados.map((plano) => (
              <div
                key={plano.id}
                className="card bg-base-100 shadow-sm border border-base-300"
              >
                <div className="card-body">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="card-title text-lg">{plano.nome}</h3>
                    {plano.ativo ? (
                      <span className="badge badge-success badge-sm">Ativo</span>
                    ) : (
                      <span className="badge badge-error badge-sm">Inativo</span>
                    )}
                  </div>
                  {plano.descricao && (
                    <p className="text-sm text-base-content/60 mb-4">
                      {plano.descricao}
                    </p>
                  )}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-primary" />
                      <span>{plano.limiteUsuarios} usuários</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <ClipboardCheck className="w-4 h-4 text-primary" />
                      <span>{plano.limiteAuditorias} auditorias</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="w-4 h-4 text-primary" />
                      <span>{plano.limiteClientes} clientes</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Coins className="w-4 h-4 text-primary" />
                      <span>{plano.limiteCreditos.toLocaleString('pt-BR')} créditos</span>
                    </div>
                  </div>
                  <div className="card-actions justify-end">
                    <button
                      className="btn btn-ghost btn-sm gap-1"
                      onClick={() => handleEditarPlano(plano)}
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      className="btn btn-ghost btn-sm gap-1 text-error"
                      onClick={() => handleRemoverPlano(plano.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Remover
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de criação/edição */}
      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">
              {editingPlano ? 'Editar Plano' : 'Novo Plano'}
            </h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Nome *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={planoForm.nome}
                  onChange={(e) =>
                    setPlanoForm({ ...planoForm, nome: e.target.value })
                  }
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Descrição</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  value={planoForm.descricao}
                  onChange={(e) =>
                    setPlanoForm({ ...planoForm, descricao: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Limite de Usuários *</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    min="0"
                    value={planoForm.limiteUsuarios}
                    onChange={(e) =>
                      setPlanoForm({
                        ...planoForm,
                        limiteUsuarios: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Limite de Auditorias *</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    min="0"
                    value={planoForm.limiteAuditorias}
                    onChange={(e) =>
                      setPlanoForm({
                        ...planoForm,
                        limiteAuditorias: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Limite de Clientes *</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    min="0"
                    value={planoForm.limiteClientes}
                    onChange={(e) =>
                      setPlanoForm({
                        ...planoForm,
                        limiteClientes: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Limite de Créditos *</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    min="0"
                    value={planoForm.limiteCreditos}
                    onChange={(e) =>
                      setPlanoForm({
                        ...planoForm,
                        limiteCreditos: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Plano Ativo</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={planoForm.ativo}
                    onChange={(e) =>
                      setPlanoForm({ ...planoForm, ativo: e.target.checked })
                    }
                  />
                </label>
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
                onClick={handleCriarPlano}
                disabled={saving || !planoForm.nome}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingPlano ? (
                  'Salvar'
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


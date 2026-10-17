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
import { AppLayout, PageHeader, EmptyState, FormModal } from '@/components';
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
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/70" />
          <input
            type="text"
            placeholder="Buscar planos..."
            className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3 w-full pl-10"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        {/* Cards de Planos */}
        {loading ? (
          <div className="relative flex flex-col rounded-lg border border-border bg-card shadow-sm">
            <div className="flex flex-1 flex-col gap-2 items-center py-12">
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
                className="relative flex flex-col rounded-lg border border-border bg-card shadow-sm"
              >
                <div className="flex flex-1 flex-col gap-2 p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="flex items-center gap-2 font-display text-lg font-semibold">{plano.nome}</h3>
                    {plano.ativo ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 py-0.5 text-[11px] bg-success/12 text-[hsl(160_84%_28%)]">Ativo</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 py-0.5 text-[11px] bg-destructive/12 text-[hsl(0_72%_45%)]">Inativo</span>
                    )}
                  </div>
                  {plano.descricao && (
                    <p className="text-sm text-muted-foreground mb-4">
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
                  <div className="flex flex-wrap items-start justify-end gap-2">
                    <button
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 hover:bg-muted gap-1"
                      onClick={() => handleEditarPlano(plano)}
                    >
                      <Edit className="w-4 h-4" />
                      Editar
                    </button>
                    <button
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 hover:bg-muted gap-1 text-destructive"
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

      <FormModal
        open={showModal}
        onClose={handleFecharModal}
        title={editingPlano ? 'Editar Plano' : 'Novo Plano'}
        maxWidth="2xl"
        isDirty={Boolean(planoForm.nome || planoForm.descricao)}
        footer={
          <>
            <button
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 hover:bg-muted"
              onClick={handleFecharModal}
            >
              Cancelar
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
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
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col">
            <label className="flex items-center justify-between gap-2 py-1">
              <span className="text-sm font-medium text-foreground">Nome *</span>
            </label>
            <input
              type="text"
              className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
              value={planoForm.nome}
              onChange={(e) =>
                setPlanoForm({ ...planoForm, nome: e.target.value })
              }
            />
          </div>
          <div className="flex flex-col">
            <label className="flex items-center justify-between gap-2 py-1">
              <span className="text-sm font-medium text-foreground">Descrição</span>
            </label>
            <textarea
              className="min-h-[80px] px-3 py-2 rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              value={planoForm.descricao}
              onChange={(e) =>
                setPlanoForm({ ...planoForm, descricao: e.target.value })
              }
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <label className="flex items-center justify-between gap-2 py-1">
                <span className="text-sm font-medium text-foreground">Limite de Usuários *</span>
              </label>
              <input
                type="number"
                className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
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
            <div className="flex flex-col">
              <label className="flex items-center justify-between gap-2 py-1">
                <span className="text-sm font-medium text-foreground">Limite de Auditorias *</span>
              </label>
              <input
                type="number"
                className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
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
            <div className="flex flex-col">
              <label className="flex items-center justify-between gap-2 py-1">
                <span className="text-sm font-medium text-foreground">Limite de Clientes *</span>
              </label>
              <input
                type="number"
                className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
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
            <div className="flex flex-col">
              <label className="flex items-center justify-between gap-2 py-1">
                <span className="text-sm font-medium text-foreground">Limite de Créditos *</span>
              </label>
              <input
                type="number"
                className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
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
          <div className="flex flex-col">
            <label className="flex items-center justify-between gap-2 py-1 cursor-pointer">
              <span className="text-sm font-medium text-foreground">Plano Ativo</span>
              <input
                type="checkbox"
                className="relative shrink-0 cursor-pointer appearance-none rounded-full bg-muted-foreground/30 transition-colors checked:bg-primary before:absolute before:left-0.5 before:top-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform disabled:opacity-50 h-5 w-9 before:h-4 before:w-4 checked:before:translate-x-4"
                checked={planoForm.ativo}
                onChange={(e) =>
                  setPlanoForm({ ...planoForm, ativo: e.target.checked })
                }
              />
            </label>
          </div>
        </div>
      </FormModal>
    </AppLayout>
  );
}


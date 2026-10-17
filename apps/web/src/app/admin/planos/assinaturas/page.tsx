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
import { AppLayout, PageHeader, EmptyState, FormModal } from '@/components';
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
      router.push('/admin/dashboard');
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
        return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 py-0.5 text-[11px] bg-success/12 text-[hsl(160_84%_28%)]">Ativa</span>;
      case 'cancelada':
        return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 py-0.5 text-[11px] bg-destructive/12 text-[hsl(0_72%_45%)]">Cancelada</span>;
      case 'expirada':
        return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 py-0.5 text-[11px] bg-warning/15 text-[hsl(32_95%_34%)]">Expirada</span>;
      default:
        return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 py-0.5 text-[11px] bg-muted text-muted-foreground">{status}</span>;
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
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-4 h-4" />
            Nova Assinatura
          </button>
        }
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {loading ? (
          <div className="relative flex flex-col rounded-lg border border-border bg-card shadow-sm">
            <div className="flex flex-1 flex-col gap-2 items-center py-12">
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
          <div className="relative flex flex-col rounded-lg border border-border bg-card shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_tr]:border-b [&_tr]:border-border text-sm [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3 [&_tbody_tr:nth-child(even)]:bg-muted/40">
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
                          <div className="relative inline-flex [&>div]:flex [&>div]:items-center [&>div]:justify-center">
                            <div className="bg-primary text-primary-foreground rounded-full w-10">
                              <UserCheck className="w-5 h-5" />
                            </div>
                          </div>
                          <div>
                            <div className="font-medium">
                              {(assinatura as any).gestor?.nome || 'Gestor'}
                            </div>
                            <div className="text-sm text-muted-foreground">
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

      <FormModal
        open={showModal}
        onClose={handleFecharModal}
        title="Nova Assinatura"
        maxWidth="2xl"
        isDirty={Boolean(assinaturaForm.gestorId || assinaturaForm.planoId)}
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
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col">
            <label className="flex items-center justify-between gap-2 py-1">
              <span className="text-sm font-medium text-foreground">Gestor *</span>
            </label>
            <select
              className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
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
          <div className="flex flex-col">
            <label className="flex items-center justify-between gap-2 py-1">
              <span className="text-sm font-medium text-foreground">Plano *</span>
            </label>
            <select
              className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
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
            <div className="flex flex-col">
              <label className="flex items-center justify-between gap-2 py-1">
                <span className="text-sm font-medium text-foreground">Data de Início</span>
              </label>
              <input
                type="date"
                className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
                value={assinaturaForm.dataInicio}
                onChange={(e) =>
                  setAssinaturaForm({
                    ...assinaturaForm,
                    dataInicio: e.target.value,
                  })
                }
              />
            </div>
            <div className="flex flex-col">
              <label className="flex items-center justify-between gap-2 py-1">
                <span className="text-sm font-medium text-foreground">Data de Fim (opcional)</span>
              </label>
              <input
                type="date"
                className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
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
      </FormModal>
    </AppLayout>
  );
}


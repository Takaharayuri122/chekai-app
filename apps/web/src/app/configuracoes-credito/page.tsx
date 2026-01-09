'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Plus,
  Loader2,
  Edit,
  Trash2,
  Search,
  Coins,
  CheckCircle2,
  XCircle,
  Save,
  X,
} from 'lucide-react';
import { AppLayout, PageHeader, EmptyState, ConfirmDialog } from '@/components';
import {
  configuracaoCreditoService,
  ConfiguracaoCredito,
  CriarConfiguracaoCreditoRequest,
  ProvedorIa,
} from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';

export default function ConfiguracoesCreditoPage() {
  const router = useRouter();
  const { isMaster } = useAuthStore();
  const [configuracoes, setConfiguracoes] = useState<ConfiguracaoCredito[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<ConfiguracaoCredito | null>(null);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState('');
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<string | null>(null);

  const [configForm, setConfigForm] = useState<CriarConfiguracaoCreditoRequest>({
    provedor: 'openai' as ProvedorIa,
    modelo: '',
    tokensPorCredito: 1000,
    ativo: true,
  });

  useEffect(() => {
    if (!isMaster()) {
      router.push('/dashboard');
      return;
    }
    carregarConfiguracoes();
  }, [isMaster, router]);

  const carregarConfiguracoes = async () => {
    try {
      const data = await configuracaoCreditoService.listar();
      setConfiguracoes(data || []);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  };

  const handleCriarOuAtualizar = async () => {
    if (!configForm.provedor || !configForm.modelo) {
      toastService.warning('Provedor e modelo são obrigatórios');
      return;
    }
    if (configForm.tokensPorCredito <= 0) {
      toastService.warning('Tokens por crédito deve ser maior que zero');
      return;
    }
    setSaving(true);

    try {
      if (editingConfig) {
        await configuracaoCreditoService.atualizar(editingConfig.id, configForm);
        toastService.success('Configuração atualizada com sucesso!');
      } else {
        await configuracaoCreditoService.criarOuAtualizar(configForm);
        toastService.success('Configuração criada com sucesso!');
      }
      await carregarConfiguracoes();
      handleFecharModal();
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleEditar = (config: ConfiguracaoCredito) => {
    setEditingConfig(config);
    setConfigForm({
      provedor: config.provedor,
      modelo: config.modelo,
      tokensPorCredito: config.tokensPorCredito,
      ativo: config.ativo,
    });
    setShowModal(true);
  };

  const handleDeletar = async () => {
    if (!configToDelete) return;

    try {
      await configuracaoCreditoService.remover(configToDelete);
      toastService.success('Configuração removida com sucesso!');
      await carregarConfiguracoes();
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setShowConfirmDelete(false);
      setConfigToDelete(null);
    }
  };

  const handleFecharModal = () => {
    setShowModal(false);
    setEditingConfig(null);
    setConfigForm({
      provedor: 'openai' as ProvedorIa,
      modelo: '',
      tokensPorCredito: 1000,
      ativo: true,
    });
  };

  const handleNovo = () => {
    setEditingConfig(null);
    setConfigForm({
      provedor: 'openai' as ProvedorIa,
      modelo: '',
      tokensPorCredito: 1000,
      ativo: true,
    });
    setShowModal(true);
  };

  const configuracoesFiltradas = configuracoes.filter((config) => {
    const termoBusca = busca.toLowerCase();
    return (
      config.provedor.toLowerCase().includes(termoBusca) ||
      config.modelo.toLowerCase().includes(termoBusca)
    );
  });

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center items-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Configurações de Créditos IA"
        subtitle="Gerencie as taxas de conversão de tokens para créditos de IA"
      />

      <div className="px-4 py-4 lg:px-8">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="form-control">
              <div className="input-group">
                <span className="bg-base-200">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder="Buscar por provedor ou modelo..."
                  className="input input-bordered flex-1"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>
          </div>
          <button
            className="btn btn-primary gap-2"
            onClick={handleNovo}
          >
            <Plus className="w-5 h-5" />
            Nova Configuração
          </button>
        </div>

        {configuracoesFiltradas.length === 0 ? (
          <EmptyState
            icon={Settings}
            title={busca ? 'Nenhuma configuração encontrada' : 'Nenhuma configuração cadastrada'}
            description={
              busca
                ? 'Tente ajustar os filtros de busca'
                : 'Comece criando uma nova configuração de crédito'
            }
          />
        ) : (
          <div className="card bg-base-100 shadow-sm border border-base-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Provedor</th>
                    <th>Modelo</th>
                    <th>Tokens por Crédito</th>
                    <th>Status</th>
                    <th>Criado em</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {configuracoesFiltradas.map((config) => (
                    <tr key={config.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-primary" />
                          <span className="font-medium capitalize">{config.provedor}</span>
                        </div>
                      </td>
                      <td>
                        <code className="text-sm bg-base-200 px-2 py-1 rounded">
                          {config.modelo}
                        </code>
                      </td>
                      <td>
                        <span className="font-semibold">{config.tokensPorCredito.toLocaleString('pt-BR')}</span>
                      </td>
                      <td>
                        {config.ativo ? (
                          <span className="badge badge-success gap-2">
                            <CheckCircle2 className="w-3 h-3" />
                            Ativa
                          </span>
                        ) : (
                          <span className="badge badge-error gap-2">
                            <XCircle className="w-3 h-3" />
                            Inativa
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="text-sm text-base-content/70">
                          {new Date(config.criadoEm).toLocaleDateString('pt-BR')}
                        </span>
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button
                            className="btn btn-sm btn-ghost"
                            onClick={() => handleEditar(config)}
                            title="Editar"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            className="btn btn-sm btn-ghost text-error"
                            onClick={() => {
                              setConfigToDelete(config.id);
                              setShowConfirmDelete(true);
                            }}
                            title="Remover"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Criar/Editar */}
      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              {editingConfig ? 'Editar Configuração' : 'Nova Configuração'}
            </h3>

            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Provedor</span>
                  <span className="label-text-alt text-error">*</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={configForm.provedor}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, provedor: e.target.value as ProvedorIa })
                  }
                  disabled={!!editingConfig}
                >
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                </select>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Modelo</span>
                  <span className="label-text-alt text-error">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: gpt-4o-mini, deepseek-chat"
                  className="input input-bordered w-full"
                  value={configForm.modelo}
                  onChange={(e) => setConfigForm({ ...configForm, modelo: e.target.value })}
                  disabled={!!editingConfig}
                />
                <label className="label">
                  <span className="label-text-alt">
                    Nome do modelo da IA (não pode ser alterado após criar)
                  </span>
                </label>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Tokens por Crédito</span>
                  <span className="label-text-alt text-error">*</span>
                </label>
                <input
                  type="number"
                  placeholder="Ex: 1000"
                  className="input input-bordered w-full"
                  value={configForm.tokensPorCredito}
                  onChange={(e) =>
                    setConfigForm({
                      ...configForm,
                      tokensPorCredito: parseInt(e.target.value) || 0,
                    })
                  }
                  min="1"
                />
                <label className="label">
                  <span className="label-text-alt">
                    Quantos tokens equivalem a 1 crédito de IA
                  </span>
                </label>
              </div>

              <div className="form-control">
                <label className="label cursor-pointer">
                  <span className="label-text">Ativo</span>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={configForm.ativo}
                    onChange={(e) => setConfigForm({ ...configForm, ativo: e.target.checked })}
                  />
                </label>
                <label className="label">
                  <span className="label-text-alt">
                    Configurações inativas não serão utilizadas
                  </span>
                </label>
              </div>
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={handleFecharModal}
                disabled={saving}
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                className="btn btn-primary gap-2"
                onClick={handleCriarOuAtualizar}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    {editingConfig ? 'Atualizar' : 'Criar'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDialog
        open={showConfirmDelete}
        title="Remover Configuração"
        message="Tem certeza que deseja remover esta configuração? Esta ação marcará a configuração como inativa."
        onConfirm={handleDeletar}
        onCancel={() => {
          setShowConfirmDelete(false);
          setConfigToDelete(null);
        }}
      />
    </AppLayout>
  );
}


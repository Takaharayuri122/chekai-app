'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FileText,
  Plus,
  ChevronDown,
  ChevronUp,
  Tag,
  List,
  AlertTriangle,
  Loader2,
  Upload,
  Trash2,
  Power,
  PowerOff,
} from 'lucide-react';
import { AppLayout, PageHeader, EmptyState, ConfirmDialog } from '@/components';
import {
  checklistService,
  ChecklistTemplate,
  TipoAtividade,
  TIPO_ATIVIDADE_LABELS,
  CategoriaItem,
  CriticidadeItem,
  CATEGORIA_ITEM_LABELS,
  CRITICIDADE_LABELS,
  CriarTemplateItemRequest,
} from '@/lib/api';
import { toastService } from '@/lib/toast';
import { useAuthStore } from '@/lib/store';

/**
 * Página de listagem e gerenciamento de templates de checklist.
 */
export default function TemplatesPage() {
  const { isGestor, isMaster } = useAuthStore();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [showItemModal, setShowItemModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const [itemForm, setItemForm] = useState<CriarTemplateItemRequest>({
    pergunta: '',
    categoria: CategoriaItem.OUTRO,
    criticidade: CriticidadeItem.MEDIA,
    peso: 1,
    legislacaoReferencia: '',
    artigo: '',
    obrigatorio: true,
    opcoesResposta: [],
    usarRespostasPersonalizadas: false,
  });

  useEffect(() => {
    carregarTemplates();
  }, []);

  const carregarTemplates = async () => {
    try {
      const response = await checklistService.listarTemplates();
      setTemplates(response.items || []);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteConfirm) return;
    try {
      setDeletingId(showDeleteConfirm);
      await checklistService.removerTemplate(showDeleteConfirm);
      toastService.success('Checklist excluído com sucesso!');
      await carregarTemplates();
      setShowDeleteConfirm(null);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleStatus = async (id: string, novoStatus: boolean) => {
    try {
      setTogglingId(id);
      await checklistService.alterarStatusTemplate(id, novoStatus);
      toastService.success(`Checklist ${novoStatus ? 'ativado' : 'inativado'} com sucesso!`);
      await carregarTemplates();
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setTogglingId(null);
    }
  };

  const handleCriarTemplate = () => {
    // Redireciona para a página de criação completa
    window.location.href = '/templates/novo';
  };

  const handleAdicionarItem = async () => {
    if (!showItemModal || !itemForm.pergunta) return;
    setSaving(true);
    try {
      const dadosItem = {
        ...itemForm,
        opcoesResposta: itemForm.usarRespostasPersonalizadas ? itemForm.opcoesResposta : undefined,
      };
      const novoItem = await checklistService.adicionarItem(showItemModal, dadosItem);
      setTemplates((prevTemplates) =>
        prevTemplates.map((template) =>
          template.id === showItemModal
            ? {
                ...template,
                itens: [...(template.itens || []), novoItem],
              }
            : template
        )
      );
      toastService.success('Item adicionado com sucesso!');
      setShowItemModal(null);
      setItemForm({
        pergunta: '',
        categoria: CategoriaItem.OUTRO,
        criticidade: CriticidadeItem.MEDIA,
        peso: 1,
        legislacaoReferencia: '',
        artigo: '',
        obrigatorio: true,
        opcoesResposta: [],
        usarRespostasPersonalizadas: false,
      });
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setSaving(false);
    }
  };

  const getCriticidadeBadge = (criticidade: CriticidadeItem) => {
    const colors: Record<CriticidadeItem, string> = {
      [CriticidadeItem.BAIXA]: 'badge-info',
      [CriticidadeItem.MEDIA]: 'badge-warning',
      [CriticidadeItem.ALTA]: 'badge-error',
      [CriticidadeItem.CRITICA]: 'badge-error badge-outline',
    };
    return colors[criticidade] || 'badge-ghost';
  };

  return (
    <AppLayout>
      <PageHeader
        title="Checklists"
        subtitle="Modelos de checklist para auditorias"
        action={
          <div className="flex gap-2">
            <Link
              href="/templates/importar"
              className="btn btn-ghost btn-sm gap-1"
            >
              <Upload className="w-4 h-4" />
              Importar
            </Link>
            <Link
              href="/templates/novo"
              className="btn btn-primary btn-sm gap-1"
            >
              <Plus className="w-4 h-4" />
              Novo Checklist
            </Link>
          </div>
        }
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {loading ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum checklist cadastrado"
            description="Crie seu primeiro checklist para usar nas auditorias."
            actionLabel="Criar Checklist"
            actionHref="/templates/novo"
          />
        ) : (
          <div className="space-y-3">
            {templates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className={`card bg-base-100 shadow-sm border ${
                  !template.ativo 
                    ? 'opacity-60 border-base-300/50 bg-base-200/30' 
                    : 'border-base-300'
                }`}
              >
                <div className="card-body p-0">
                  {/* Checklist Header */}
                  <button
                    onClick={() =>
                      setExpandedTemplate(
                        expandedTemplate === template.id ? null : template.id
                      )
                    }
                    className="flex items-center gap-4 p-4 w-full text-left hover:bg-base-200/50 transition-colors"
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      !template.ativo 
                        ? 'bg-base-300/30' 
                        : 'bg-secondary/10'
                    }`}>
                      <FileText className={`w-6 h-6 ${
                        !template.ativo 
                          ? 'text-base-content/40' 
                          : 'text-secondary'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium truncate ${
                          !template.ativo ? 'text-base-content/50' : 'text-base-content'
                        }`}>
                          {template.nome}
                        </p>
                        {!template.ativo && (
                          <span className="badge badge-warning badge-sm">Inativo</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`badge badge-ghost badge-sm ${
                          !template.ativo ? 'opacity-60' : ''
                        }`}>
                          <Tag className="w-3 h-3 mr-1" />
                          {TIPO_ATIVIDADE_LABELS[template.tipoAtividade] || template.tipoAtividade}
                        </span>
                        <span className={`badge badge-ghost badge-sm ${
                          !template.ativo ? 'opacity-60' : ''
                        }`}>
                          <List className="w-3 h-3 mr-1" />
                          {template.itens?.filter((i) => i.ativo !== false).length || 0} itens
                        </span>
                        <span className={`text-xs ${
                          !template.ativo ? 'text-base-content/30' : 'text-base-content/50'
                        }`}>
                          v{template.versao}
                        </span>
                      </div>
                    </div>
                    {expandedTemplate === template.id ? (
                      <ChevronUp className="w-5 h-5 text-base-content/40" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-base-content/40" />
                    )}
                  </button>

                  {/* Itens do Checklist */}
                  {expandedTemplate === template.id && (
                    <div className="border-t border-base-200">
                      {template.descricao && (
                        <div className="px-4 py-3 bg-base-200/30 border-b border-base-200">
                          <p className="text-sm text-base-content/70">
                            {template.descricao}
                          </p>
                        </div>
                      )}
                      <div className="p-3 bg-base-200/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-base-content/70">
                            Itens do Checklist
                          </span>
                          <button
                            onClick={() => setShowItemModal(template.id)}
                            className="btn btn-ghost btn-xs gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Adicionar
                          </button>
                        </div>
                        {!template.itens || template.itens.length === 0 ? (
                          <div className="text-center py-6">
                            <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-2" />
                            <p className="text-sm text-base-content/50">
                              Nenhum item cadastrado
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {template.itens
                              .sort((a, b) => a.ordem - b.ordem)
                              .map((item, idx) => (
                                <div
                                  key={item.id}
                                  className="flex items-start gap-3 p-3 bg-base-100 rounded-lg"
                                >
                                  <span className="text-sm font-bold text-base-content/40 min-w-[24px]">
                                    {idx + 1}.
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-base-content">
                                      {item.pergunta}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                      <span className="badge badge-ghost badge-xs">
                                        {CATEGORIA_ITEM_LABELS[item.categoria] || item.categoria}
                                      </span>
                                      <span className={`badge badge-xs ${getCriticidadeBadge(item.criticidade)}`}>
                                        {CRITICIDADE_LABELS[item.criticidade] || item.criticidade}
                                      </span>
                                      {item.legislacaoReferencia && (
                                        <span className="text-xs text-base-content/50">
                                          {item.legislacaoReferencia}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                      <div className="p-3 border-t border-base-200 flex justify-between items-center">
                        <div className="flex gap-2">
                          {(isGestor() || isMaster()) && (
                            <>
                              <button
                                onClick={() => handleToggleStatus(template.id, !template.ativo)}
                                disabled={togglingId === template.id}
                                className={`btn btn-sm gap-1 ${
                                  template.ativo ? 'btn-warning' : 'btn-success'
                                }`}
                                title={template.ativo ? 'Inativar checklist' : 'Ativar checklist'}
                              >
                                {togglingId === template.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : template.ativo ? (
                                  <PowerOff className="w-3 h-3" />
                                ) : (
                                  <Power className="w-3 h-3" />
                                )}
                                {template.ativo ? 'Inativar' : 'Ativar'}
                              </button>
                              <button
                                onClick={() => handleDeleteClick(template.id)}
                                disabled={deletingId === template.id}
                                className="btn btn-error btn-sm gap-1"
                                title="Excluir checklist (apenas se não estiver em uso)"
                              >
                                {deletingId === template.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                                Excluir
                              </button>
                            </>
                          )}
                        </div>
                        {(isGestor() || isMaster()) && (
                          <Link
                            href={`/templates/${template.id}`}
                            className="btn btn-ghost btn-sm"
                          >
                            Editar Checklist
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Exclusão */}
      <ConfirmDialog
        open={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir Checklist"
        message="Tem certeza que deseja excluir este checklist? Esta ação não pode ser desfeita. O checklist só pode ser excluído se não estiver vinculado a nenhuma auditoria."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deletingId !== null}
      />

      {/* Modal Novo Item */}
      {showItemModal && (
        <div 
          className="modal modal-open"
          onClick={(e) => {
            // Não fecha ao clicar fora - removido para evitar perda de dados
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
          <div 
            className="modal-box max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-4">Novo Item do Checklist</h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Pergunta *</span>
                </label>
                <textarea
                  placeholder="Ex: Os manipuladores utilizam EPIs adequados?"
                  className="textarea textarea-bordered"
                  rows={3}
                  value={itemForm.pergunta}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, pergunta: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Categoria</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={itemForm.categoria}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        categoria: e.target.value as CategoriaItem,
                      })
                    }
                  >
                    {Object.entries(CATEGORIA_ITEM_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Criticidade</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={itemForm.criticidade}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        criticidade: e.target.value as CriticidadeItem,
                      })
                    }
                  >
                    {Object.entries(CRITICIDADE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Peso</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="input input-bordered"
                    value={itemForm.peso}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        peso: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">Obrigatório</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={itemForm.obrigatorio}
                      onChange={(e) =>
                        setItemForm({
                          ...itemForm,
                          obrigatorio: e.target.checked,
                        })
                      }
                    />
                  </label>
                </div>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Legislação de Referência</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: RDC 216/2004"
                  className="input input-bordered"
                  value={itemForm.legislacaoReferencia}
                  onChange={(e) =>
                    setItemForm({
                      ...itemForm,
                      legislacaoReferencia: e.target.value,
                    })
                  }
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Artigo/Inciso</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Art. 4.1.3"
                  className="input input-bordered"
                  value={itemForm.artigo}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, artigo: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowItemModal(null)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAdicionarItem}
                disabled={saving || !itemForm.pergunta}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Adicionar'
                )}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={(e) => {
              // Não fecha ao clicar fora - removido para evitar perda de dados
              e.stopPropagation();
            }}
          ></div>
        </div>
      )}
    </AppLayout>
  );
}

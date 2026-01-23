'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FileText,
  Plus,
  Tag,
  List,
  Loader2,
  Upload,
  Trash2,
  Power,
  PowerOff,
  Edit,
} from 'lucide-react';
import { AppLayout, PageHeader, EmptyState, ConfirmDialog } from '@/components';
import {
  checklistService,
  ChecklistTemplate,
  TipoAtividade,
  TIPO_ATIVIDADE_LABELS,
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
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showToggleConfirm, setShowToggleConfirm] = useState<{ id: string; novoStatus: boolean } | null>(null);

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

  const handleToggleClick = (id: string, novoStatus: boolean) => {
    setShowToggleConfirm({ id, novoStatus });
  };

  const handleToggleConfirm = async () => {
    if (!showToggleConfirm) return;
    try {
      setTogglingId(showToggleConfirm.id);
      await checklistService.alterarStatusTemplate(showToggleConfirm.id, showToggleConfirm.novoStatus);
      toastService.success(`Checklist ${showToggleConfirm.novoStatus ? 'ativado' : 'inativado'} com sucesso!`);
      await carregarTemplates();
      setShowToggleConfirm(null);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setTogglingId(null);
    }
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
                <div className="card-body p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
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
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-medium truncate ${
                          !template.ativo ? 'text-base-content/50' : 'text-base-content'
                        }`}>
                          {template.nome}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                      {template.descricao && (
                        <p className="text-sm text-base-content/60 mt-1 line-clamp-1">
                          {template.descricao}
                        </p>
                      )}
                    </div>
                    {(isGestor() || isMaster()) && (
                      <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end sm:justify-start">
                        <Link
                          href={`/templates/${template.id}`}
                          className="btn btn-primary btn-sm gap-1 flex-1 sm:flex-none sm:min-w-[110px]"
                          title="Editar checklist"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="hidden sm:inline">Editar</span>
                        </Link>
                        <button
                          onClick={() => handleToggleClick(template.id, !template.ativo)}
                          disabled={togglingId === template.id}
                          className={`btn btn-sm gap-1 flex-1 sm:flex-none sm:min-w-[110px] ${
                            template.ativo ? 'btn-warning' : 'btn-success'
                          }`}
                          title={template.ativo ? 'Inativar checklist' : 'Ativar checklist'}
                        >
                          {togglingId === template.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : template.ativo ? (
                            <PowerOff className="w-4 h-4" />
                          ) : (
                            <Power className="w-4 h-4" />
                          )}
                          <span className="hidden sm:inline">{template.ativo ? 'Inativar' : 'Ativar'}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(template.id)}
                          disabled={deletingId === template.id}
                          className="btn btn-error btn-sm gap-1 flex-1 sm:flex-none sm:min-w-[110px]"
                          title="Excluir checklist (apenas se não estiver em uso)"
                        >
                          {deletingId === template.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          <span className="hidden sm:inline">Excluir</span>
                        </button>
                      </div>
                    )}
                  </div>
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

      {/* Modal de Confirmação de Ativar/Inativar */}
      {showToggleConfirm && (
        <ConfirmDialog
          open={showToggleConfirm !== null}
          onClose={() => setShowToggleConfirm(null)}
          onConfirm={handleToggleConfirm}
          title={showToggleConfirm.novoStatus ? 'Ativar Checklist' : 'Inativar Checklist'}
          message={
            showToggleConfirm.novoStatus
              ? 'Tem certeza que deseja ativar este checklist? Ele ficará disponível para uso nas auditorias.'
              : 'Tem certeza que deseja inativar este checklist? Ele não ficará mais disponível para uso em novas auditorias.'
          }
          confirmLabel={showToggleConfirm.novoStatus ? 'Ativar' : 'Inativar'}
          cancelLabel="Cancelar"
          variant={showToggleConfirm.novoStatus ? 'info' : 'warning'}
          loading={togglingId !== null}
        />
      )}
    </AppLayout>
  );
}

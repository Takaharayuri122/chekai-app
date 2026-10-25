'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Upload,
  Trash2,
  Power,
  PowerOff,
  Edit,
  Tag,
  List,
  Sparkles,
} from 'lucide-react';
import {
  AppLayout,
  PageHeader,
  ConfirmDialog,
  CrudFiltros,
  CrudTable,
  type ColunaTabela,
  type AcaoTabela,
} from '@/components';
import {
  checklistService,
  ChecklistTemplate,
  TipoAtividade,
  StatusTemplate,
  STATUS_TEMPLATE_LABELS,
  TIPO_ATIVIDADE_LABELS,
} from '@/lib/api';
import { toastService } from '@/lib/toast';
import { useAuthStore } from '@/lib/store';
import { ChecklistIaChatModal } from '@/components/checklist/checklist-ia-chat-modal';

interface FiltrosChecklist {
  nome: string;
  tipoAtividade: string;
  status: string;
}

const FILTROS_INICIAIS: FiltrosChecklist = {
  nome: '',
  tipoAtividade: '',
  status: '',
};

const tipoAtividadeOpcoes = Object.entries(TIPO_ATIVIDADE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const STATUS_BADGE_CLASS: Record<StatusTemplate, string> = {
  [StatusTemplate.RASCUNHO]: '!bg-warning/15 !text-[hsl(32_95%_34%)]',
  [StatusTemplate.ATIVO]: '!bg-success/12 !text-[hsl(160_84%_28%)]',
  [StatusTemplate.INATIVO]: '!bg-destructive/12 !text-[hsl(0_72%_45%)]',
};

export default function TemplatesPage() {
  const router = useRouter();
  const { isGestor, isMaster } = useAuthStore();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showToggleConfirm, setShowToggleConfirm] = useState<{ id: string; novoStatus: StatusTemplate } | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [mostrarChatIa, setMostrarChatIa] = useState(false);

  const carregarTemplates = async (filtros?: FiltrosChecklist) => {
    setLoading(true);
    try {
      const response = await checklistService.listarTemplates(1, 100);
      let items = response.items || [];
      if (filtros) {
        if (filtros.nome) {
          const termo = filtros.nome.toLowerCase();
          items = items.filter((t) => t.nome.toLowerCase().includes(termo));
        }
        if (filtros.tipoAtividade) {
          items = items.filter((t) => t.tipoAtividade === filtros.tipoAtividade);
        }
        if (filtros.status) {
          items = items.filter((t) => t.status === filtros.status);
        }
      }
      setTemplates(items);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteConfirm) return;
    try {
      setIsDeleting(true);
      await checklistService.removerTemplate(showDeleteConfirm);
      toastService.success('Checklist excluído com sucesso!');
      await carregarTemplates();
      setShowDeleteConfirm(null);
    } catch {
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleConfirm = async () => {
    if (!showToggleConfirm) return;
    try {
      setIsToggling(true);
      await checklistService.alterarStatusTemplate(showToggleConfirm.id, showToggleConfirm.novoStatus);
      const label = STATUS_TEMPLATE_LABELS[showToggleConfirm.novoStatus];
      toastService.success(`Checklist alterado para "${label}" com sucesso!`);
      await carregarTemplates();
      setShowToggleConfirm(null);
    } catch {
    } finally {
      setIsToggling(false);
    }
  };

  const handleIaFinalizado = (templateId: string) => {
    setMostrarChatIa(false);
    router.push(`/admin/templates/${templateId}`);
  };

  const colunas: ColunaTabela<ChecklistTemplate>[] = [
    {
      label: 'Nome',
      render: (t) => (
        <span className={`font-medium ${t.status === StatusTemplate.INATIVO ? 'text-muted-foreground' : 'text-foreground'}`}>
          {t.nome}
        </span>
      ),
    },
    {
      label: 'Tipo de Atividade',
      render: (t) => (
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <Tag className="w-3 h-3" />
          {TIPO_ATIVIDADE_LABELS[t.tipoAtividade] || t.tipoAtividade}
        </span>
      ),
    },
    {
      label: 'Itens',
      render: (t) => (
        <span className="text-sm text-muted-foreground flex items-center gap-1 tabular-nums">
          <List className="w-3 h-3" />
          {t.itens?.filter((i) => i.ativo !== false).length || 0}
        </span>
      ),
    },
    {
      label: 'Versão',
      render: (t) => (
        <span className="text-sm text-muted-foreground tabular-nums">v{t.versao}</span>
      ),
    },
    {
      label: 'Status',
      render: (t) => (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 py-0.5 text-[11px] bg-muted text-foreground ${STATUS_BADGE_CLASS[t.status] || '!bg-muted !text-muted-foreground'}`}>
          {STATUS_TEMPLATE_LABELS[t.status] || t.status}
        </span>
      ),
    },
  ];

  const acoes: AcaoTabela<ChecklistTemplate>[] = [
    {
      label: 'Editar',
      icon: Edit,
      onClick: (t) => { window.location.href = `/admin/templates/${t.id}`; },
      isVisivel: () => isGestor() || isMaster(),
    },
    {
      label: 'Ativar',
      icon: Power,
      onClick: (t) => setShowToggleConfirm({ id: t.id, novoStatus: StatusTemplate.ATIVO }),
      className: 'text-success',
      isVisivel: (t) => t.status !== StatusTemplate.ATIVO && (isGestor() || isMaster()),
    },
    {
      label: 'Inativar',
      icon: PowerOff,
      onClick: (t) => setShowToggleConfirm({ id: t.id, novoStatus: StatusTemplate.INATIVO }),
      className: 'text-warning',
      isVisivel: (t) => t.status === StatusTemplate.ATIVO && (isGestor() || isMaster()),
    },
    {
      label: 'Excluir',
      icon: Trash2,
      onClick: (t) => setShowDeleteConfirm(t.id),
      className: 'text-destructive',
      isVisivel: () => isGestor() || isMaster(),
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Checklists"
        subtitle="Modelos de checklist para auditorias"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setMostrarChatIa(true)}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 bg-info text-white hover:bg-info/90 gap-1"
            >
              <Sparkles className="w-4 h-4" />
              Criar com IA
            </button>
            <Link href="/admin/templates/importar" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 hover:bg-muted gap-1">
              <Upload className="w-4 h-4" />
              Importar
            </Link>
            <Link href="/admin/templates/novo" className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90 gap-1">
              <Plus className="w-4 h-4" />
              Novo Checklist
            </Link>
          </div>
        }
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        <CrudFiltros
          campos={[
            { key: 'nome', label: 'Nome', tipo: 'text', placeholder: 'Buscar por nome...' },
            {
              key: 'tipoAtividade',
              label: 'Tipo de Atividade',
              tipo: 'select',
              opcoes: tipoAtividadeOpcoes,
            },
            {
              key: 'status',
              label: 'Status',
              tipo: 'select',
              opcoes: Object.entries(STATUS_TEMPLATE_LABELS).map(([value, label]) => ({
                value,
                label,
              })),
            },
          ]}
          valoresIniciais={FILTROS_INICIAIS}
          onPesquisar={(filtros) => carregarTemplates(filtros)}
          onLimpar={() => carregarTemplates()}
        />

        <CrudTable
          colunas={colunas}
          dados={templates}
          acoes={acoes}
          keyExtractor={(t) => t.id}
          loading={loading}
          emptyState={{
            icon: FileText,
            title: 'Nenhum checklist encontrado',
            description: 'Ajuste os filtros ou crie um checklist pelo botão no topo.',
          }}
        />
      </div>

      <ConfirmDialog
        open={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Excluir Checklist"
        message="Tem certeza que deseja excluir este checklist? Esta ação não pode ser desfeita. O checklist só pode ser excluído se não estiver vinculado a nenhuma auditoria."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        loading={isDeleting}
      />

      {showToggleConfirm && (
        <ConfirmDialog
          open={showToggleConfirm !== null}
          onClose={() => setShowToggleConfirm(null)}
          onConfirm={handleToggleConfirm}
          title={
            showToggleConfirm.novoStatus === StatusTemplate.ATIVO
              ? 'Ativar Checklist'
              : 'Inativar Checklist'
          }
          message={
            showToggleConfirm.novoStatus === StatusTemplate.ATIVO
              ? 'Tem certeza que deseja ativar este checklist? Ele ficará disponível para uso nas auditorias. É necessário que o checklist tenha ao menos um item.'
              : 'Tem certeza que deseja inativar este checklist? Ele não ficará mais disponível para uso em novas auditorias.'
          }
          confirmLabel={showToggleConfirm.novoStatus === StatusTemplate.ATIVO ? 'Ativar' : 'Inativar'}
          cancelLabel="Cancelar"
          variant={showToggleConfirm.novoStatus === StatusTemplate.ATIVO ? 'info' : 'warning'}
          loading={isToggling}
        />
      )}

      <ChecklistIaChatModal
        open={mostrarChatIa}
        onClose={() => setMostrarChatIa(false)}
        onChecklistGerado={handleIaFinalizado}
      />
    </AppLayout>
  );
}

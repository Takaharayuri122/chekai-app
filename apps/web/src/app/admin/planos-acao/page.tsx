'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Edit, ListChecks, Plus, Trash2 } from 'lucide-react';
import {
  AppLayout,
  ConfirmDialog,
  CrudFiltros,
  CrudTable,
  FormModal,
  PageHeader,
  type AcaoTabela,
  type ColunaTabela,
} from '@/components';
import { auditoriaService, usuarioService, type Auditoria, type Usuario } from '@/lib/api';
import { useAuthStore, PerfilUsuario } from '@/lib/store';
import { toastService } from '@/lib/toast';
import {
  planoAcaoService,
  STATUS_TAREFA_LABELS,
  type StatusTarefaPlanoAcao,
  type TarefaPlanoAcao,
} from '@/lib/services/plano-acao.service';

const FILTROS_INICIAIS = { status: '', responsavelId: '' };
const FORM_INICIAL = { titulo: '', descricao: '', responsavelId: '', auditoriaId: '', prazo: '' };

const BADGE_STATUS: Record<StatusTarefaPlanoAcao, string> = {
  pendente: 'badge-warning',
  em_andamento: 'badge-info',
  concluida: 'badge-success',
  cancelada: 'badge-ghost',
};

function formatarPrazo(prazo: string): string {
  const [ano, mes, dia] = prazo.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

function estaAtrasada(t: TarefaPlanoAcao): boolean {
  return (t.status === 'pendente' || t.status === 'em_andamento') && t.prazo.slice(0, 10) < new Date().toISOString().slice(0, 10);
}

export default function PlanosAcaoPage() {
  const { usuario } = useAuthStore();
  const ehAuditor = usuario?.perfil === PerfilUsuario.AUDITOR;
  const [tarefas, setTarefas] = useState<TarefaPlanoAcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [responsaveis, setResponsaveis] = useState<Usuario[]>([]);
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<TarefaPlanoAcao | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState<TarefaPlanoAcao | null>(null);

  const carregar = useCallback(async (filtros: typeof FILTROS_INICIAIS, limit: number) => {
    setLoading(true);
    try {
      const r = await planoAcaoService.listar(
        1,
        limit,
        (filtros.status || undefined) as StatusTarefaPlanoAcao | undefined,
        filtros.responsavelId || undefined,
      );
      setTarefas(r.items);
    } catch {
      // erro tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const carregarOpcoes = async () => {
      try {
        const [u, a] = await Promise.all([
          ehAuditor ? Promise.resolve({ items: [] as Usuario[] }) : usuarioService.listar(1, 100),
          auditoriaService.listar(1, 100),
        ]);
        setResponsaveis(u.items);
        setAuditorias(a.items);
      } catch {
        // opções são opcionais
      }
    };
    void carregarOpcoes();
  }, [ehAuditor]);

  const recarregar = () => carregar(FILTROS_INICIAIS, 20);

  const abrirNovo = () => {
    setEditando(null);
    setForm(FORM_INICIAL);
    setModalAberto(true);
  };

  const abrirEdicao = (t: TarefaPlanoAcao) => {
    setEditando(t);
    setForm({
      titulo: t.titulo,
      descricao: t.descricao ?? '',
      responsavelId: t.responsavelId ?? '',
      auditoriaId: t.auditoriaId ?? '',
      prazo: t.prazo.slice(0, 10),
    });
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.titulo.trim() || !form.prazo) {
      toastService.error('Informe o título e o prazo.');
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        await planoAcaoService.atualizar(editando.id, {
          titulo: form.titulo,
          descricao: form.descricao,
          prazo: form.prazo,
          ...(form.responsavelId ? { responsavelId: form.responsavelId } : {}),
        });
        toastService.success('Tarefa atualizada.');
      } else {
        await planoAcaoService.criar({
          titulo: form.titulo,
          descricao: form.descricao || undefined,
          prazo: form.prazo,
          responsavelId: form.responsavelId || undefined,
          auditoriaId: form.auditoriaId || undefined,
        });
        toastService.success('Tarefa criada.');
      }
      setModalAberto(false);
      await recarregar();
    } catch {
      // erro tratado pelo interceptor
    } finally {
      setSalvando(false);
    }
  };

  const concluir = async (t: TarefaPlanoAcao) => {
    try {
      await planoAcaoService.atualizar(t.id, { status: 'concluida' });
      toastService.success('Tarefa concluída.');
      await recarregar();
    } catch {
      // erro tratado pelo interceptor
    }
  };

  const confirmarRemocao = async () => {
    if (!removendo) return;
    try {
      await planoAcaoService.remover(removendo.id);
      toastService.success('Tarefa removida.');
      setRemovendo(null);
      await recarregar();
    } catch {
      // erro tratado pelo interceptor
    }
  };

  const colunas: ColunaTabela<TarefaPlanoAcao>[] = [
    { label: 'Tarefa', render: (t) => <span className="font-medium">{t.titulo}</span> },
    { label: 'Responsável', render: (t) => t.responsavel?.nome ?? '-' },
    { label: 'Unidade', render: (t) => t.auditoria?.unidade?.nome ?? '-', mobileOculta: true },
    {
      label: 'Prazo',
      render: (t) => (
        <span className={estaAtrasada(t) ? 'text-error font-semibold' : ''}>{formatarPrazo(t.prazo)}</span>
      ),
    },
    {
      label: 'Status',
      render: (t) => <span className={`badge badge-sm ${BADGE_STATUS[t.status]}`}>{STATUS_TAREFA_LABELS[t.status]}</span>,
    },
  ];

  const acoes: AcaoTabela<TarefaPlanoAcao>[] = [
    {
      label: 'Concluir',
      icon: CheckCircle2,
      onClick: concluir,
      isVisivel: (t) => t.status === 'pendente' || t.status === 'em_andamento',
    },
    { label: 'Editar', icon: Edit, onClick: abrirEdicao },
    { label: 'Remover', icon: Trash2, onClick: setRemovendo, className: 'text-error', isVisivel: () => !ehAuditor },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Planos de Ação"
        subtitle="Acompanhe tarefas corretivas com responsável e prazo"
        action={
          <button className="btn btn-primary btn-sm gap-2" onClick={abrirNovo}>
            <Plus className="w-4 h-4" /> Nova tarefa
          </button>
        }
      />
      <div className="px-4 py-4 lg:px-8 space-y-4">
        <CrudFiltros
          campos={[
            {
              key: 'status',
              label: 'Status',
              tipo: 'select',
              opcoes: Object.entries(STATUS_TAREFA_LABELS).map(([value, label]) => ({ value, label })),
            },
            ...(ehAuditor
              ? []
              : [
                  {
                    key: 'responsavelId',
                    label: 'Responsável',
                    tipo: 'select' as const,
                    opcoes: responsaveis.map((u) => ({ value: u.id, label: u.nome })),
                  },
                ]),
          ]}
          valoresIniciais={FILTROS_INICIAIS}
          onPesquisar={(f) => void carregar(f, 200)}
          onLimpar={() => void carregar(FILTROS_INICIAIS, 20)}
        />
        <CrudTable
          colunas={colunas}
          dados={tarefas}
          acoes={acoes}
          keyExtractor={(t) => t.id}
          loading={loading}
          emptyState={{
            icon: ListChecks,
            title: 'Nenhuma tarefa encontrada',
            description: 'Crie tarefas para acompanhar as correções das não conformidades.',
            actionLabel: 'Nova tarefa',
            actionOnClick: abrirNovo,
          }}
        />
      </div>

      <FormModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar tarefa' : 'Nova tarefa'}
        maxWidth="lg"
        isDirty={form.titulo !== (editando?.titulo ?? '')}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setModalAberto(false)}>Cancelar</button>
            <button className="btn btn-primary" onClick={salvar} disabled={salvando}>
              {salvando ? <span className="loading loading-spinner loading-sm" /> : 'Salvar'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="form-control">
            <span className="label-text mb-1">Título *</span>
            <input className="input input-bordered" maxLength={200} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">Descrição</span>
            <textarea className="textarea textarea-bordered" rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">Prazo *</span>
            <input type="date" className="input input-bordered" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
          </label>
          {!ehAuditor && (
            <label className="form-control">
              <span className="label-text mb-1">Responsável</span>
              <select className="select select-bordered" value={form.responsavelId} onChange={(e) => setForm({ ...form, responsavelId: e.target.value })}>
                <option value="">Sem responsável</option>
                {responsaveis.map((u) => (<option key={u.id} value={u.id}>{u.nome}</option>))}
              </select>
            </label>
          )}
          {!editando && (
            <label className="form-control">
              <span className="label-text mb-1">Auditoria de origem</span>
              <select className="select select-bordered" value={form.auditoriaId} onChange={(e) => setForm({ ...form, auditoriaId: e.target.value })}>
                <option value="">Nenhuma</option>
                {auditorias.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.unidade?.nome} - {a.template?.nome} ({new Date(a.dataInicio).toLocaleDateString('pt-BR')})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </FormModal>

      <ConfirmDialog
        open={removendo !== null}
        onClose={() => setRemovendo(null)}
        onConfirm={confirmarRemocao}
        title="Remover tarefa"
        message={`Deseja remover a tarefa "${removendo?.titulo ?? ''}"?`}
        confirmLabel="Remover"
      />
    </AppLayout>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Edit, ListChecks, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  AppLayout,
  ConfirmDialog,
  StatusChip,
  CrudFiltros,
  CrudTable,
  FormModal,
  PageHeader,
  type AcaoTabela,
  type ColunaTabela,
} from '@/components';
import { auditoriaService, usuarioService, type Auditoria, type Usuario } from '@/lib/api';
import { useAuthStore, PerfilUsuario } from '@/lib/store';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { toastService } from '@/lib/toast';
import { dataLocalISO, formatarDataBr } from '@/lib/datas';
import {
  planoAcaoService,
  STATUS_TAREFA_LABELS,
  type StatusTarefaPlanoAcao,
  type TarefaPlanoAcao,
} from '@/lib/services/plano-acao.service';

const FILTROS_INICIAIS = { status: '', responsavelId: '' };
const FORM_INICIAL = { titulo: '', descricao: '', responsavelId: '', auditoriaId: '', prazo: '' };

function estaAtrasada(t: TarefaPlanoAcao): boolean {
  return (t.status === 'pendente' || t.status === 'em_andamento') && t.prazo.slice(0, 10) < dataLocalISO();
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
    {
      label: 'Tarefa',
      render: (t) => (
        <div>
          <span className="font-medium">{t.titulo}</span>
          {t.referenciaLegal && <p className="mt-0.5 text-xs text-muted-foreground">Legislação: {t.referenciaLegal}</p>}
        </div>
      ),
    },
    { label: 'Responsável', render: (t) => t.responsavel?.nome ?? '-' },
    { label: 'Unidade', render: (t) => t.auditoria?.unidade?.nome ?? '-', mobileOculta: true },
    {
      label: 'Prazo',
      render: (t) => (
        <span className={estaAtrasada(t) ? 'text-destructive font-semibold' : ''}>{formatarDataBr(t.prazo)}</span>
      ),
    },
    {
      label: 'Status',
      render: (t) => <StatusChip status={estaAtrasada(t) ? 'atrasada' : t.status} label={estaAtrasada(t) ? 'Atrasada' : STATUS_TAREFA_LABELS[t.status]} />,
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
    { label: 'Remover', icon: Trash2, onClick: setRemovendo, className: 'text-destructive', isVisivel: () => !ehAuditor },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Planos de Ação"
        subtitle="Acompanhe tarefas corretivas com responsável e prazo"
        action={
          <Button onClick={abrirNovo}>
            <Plus className="h-4 w-4" /> Nova tarefa
          </Button>
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
            description: 'Crie uma tarefa pelo botão no topo para acompanhar as correções.',
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
            <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Título *</span>
            <Input maxLength={200} value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Descrição</span>
            <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Prazo *</span>
            <Input type="date" value={form.prazo} onChange={(e) => setForm({ ...form, prazo: e.target.value })} />
          </label>
          {!ehAuditor && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Responsável</span>
              <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={form.responsavelId} onChange={(e) => setForm({ ...form, responsavelId: e.target.value })}>
                <option value="">Sem responsável</option>
                {responsaveis.map((u) => (<option key={u.id} value={u.id}>{u.nome}</option>))}
              </select>
            </label>
          )}
          {!editando && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Auditoria de origem</span>
              <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={form.auditoriaId} onChange={(e) => setForm({ ...form, auditoriaId: e.target.value })}>
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

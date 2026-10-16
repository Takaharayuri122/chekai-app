'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, Edit, Play, Plus, Trash2, XCircle } from 'lucide-react';
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
import { checklistService, unidadeService, usuarioService, type ChecklistTemplate, type Unidade, type Usuario } from '@/lib/api';
import { useAuthStore, PerfilUsuario } from '@/lib/store';
import { toastService } from '@/lib/toast';
import {
  agendaService,
  RECORRENCIA_LABELS,
  STATUS_AGENDA_LABELS,
  type AgendaItem,
  type RecorrenciaAgenda,
  type StatusAgenda,
} from '@/lib/services/agenda.service';

const FILTROS_INICIAIS = { status: 'agendada', responsavelId: '' };
const FORM_INICIAL = { unidadeId: '', templateId: '', responsavelId: '', dataPrevista: '', recorrencia: 'nenhuma' as RecorrenciaAgenda, observacao: '' };
const BADGE: Record<StatusAgenda, string> = { agendada: 'badge-info', realizada: 'badge-success', cancelada: 'badge-ghost' };

const formatarData = (d: string) => d.slice(0, 10).split('-').reverse().join('/');
const atrasada = (a: AgendaItem) => a.status === 'agendada' && a.dataPrevista.slice(0, 10) < new Date().toISOString().slice(0, 10);

export default function AgendaPage() {
  const { usuario } = useAuthStore();
  const ehAuditor = usuario?.perfil === PerfilUsuario.AUDITOR;
  const [itens, setItens] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [responsaveis, setResponsaveis] = useState<Usuario[]>([]);
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<AgendaItem | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [removendo, setRemovendo] = useState<AgendaItem | null>(null);

  const carregar = useCallback(async (f: typeof FILTROS_INICIAIS, limit: number) => {
    setLoading(true);
    try {
      const r = await agendaService.listar(1, limit, (f.status || undefined) as StatusAgenda | undefined, f.responsavelId || undefined);
      setItens(r.items);
    } catch {
      // erro tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ehAuditor) return;
    const carregarOpcoes = async () => {
      try {
        const [u, t, r] = await Promise.all([
          unidadeService.listar(),
          checklistService.listarTemplates(1, 100),
          usuarioService.listar(1, 100),
        ]);
        setUnidades(u);
        setTemplates(t.items.filter((x) => x.status === 'ativo'));
        setResponsaveis(r.items);
      } catch {
        // opções são carregadas sob demanda do usuário
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

  const abrirEdicao = (a: AgendaItem) => {
    setEditando(a);
    setForm({
      unidadeId: a.unidadeId,
      templateId: a.templateId,
      responsavelId: a.responsavelId ?? '',
      dataPrevista: a.dataPrevista.slice(0, 10),
      recorrencia: a.recorrencia,
      observacao: a.observacao ?? '',
    });
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.unidadeId || !form.templateId || !form.dataPrevista) {
      toastService.error('Informe unidade, checklist e data.');
      return;
    }
    setSalvando(true);
    try {
      if (editando) {
        await agendaService.atualizar(editando.id, {
          dataPrevista: form.dataPrevista,
          recorrencia: form.recorrencia,
          observacao: form.observacao,
          ...(form.responsavelId ? { responsavelId: form.responsavelId } : {}),
        });
        toastService.success('Agendamento atualizado.');
      } else {
        await agendaService.criar({
          unidadeId: form.unidadeId,
          templateId: form.templateId,
          dataPrevista: form.dataPrevista,
          recorrencia: form.recorrencia,
          responsavelId: form.responsavelId || undefined,
          observacao: form.observacao || undefined,
        });
        toastService.success('Auditoria agendada.');
      }
      setModalAberto(false);
      await recarregar();
    } catch {
      // erro tratado pelo interceptor
    } finally {
      setSalvando(false);
    }
  };

  const executar = async (acao: () => Promise<unknown>, msg: string) => {
    try {
      await acao();
      toastService.success(msg);
      await recarregar();
    } catch {
      // erro tratado pelo interceptor
    }
  };

  const colunas: ColunaTabela<AgendaItem>[] = [
    { label: 'Data', render: (a) => <span className={atrasada(a) ? 'text-error font-semibold' : ''}>{formatarData(a.dataPrevista)}</span> },
    { label: 'Unidade', render: (a) => <span className="font-medium">{a.unidade?.nome ?? '-'}</span> },
    { label: 'Checklist', render: (a) => a.template?.nome ?? '-' },
    { label: 'Responsável', render: (a) => a.responsavel?.nome ?? '-', mobileOculta: true },
    { label: 'Repete', render: (a) => RECORRENCIA_LABELS[a.recorrencia], mobileOculta: true },
    { label: 'Status', render: (a) => <span className={`badge badge-sm ${BADGE[a.status]}`}>{STATUS_AGENDA_LABELS[a.status]}</span> },
  ];

  const pendente = (a: AgendaItem) => a.status === 'agendada';
  const acoes: AcaoTabela<AgendaItem>[] = [
    { label: 'Iniciar auditoria', icon: Play, onClick: () => { window.location.href = '/admin/auditoria/nova'; }, isVisivel: pendente },
    { label: 'Marcar como realizada', icon: CheckCircle2, onClick: (a) => void executar(() => agendaService.concluir(a.id), 'Agendamento concluído.'), isVisivel: (a) => pendente(a) },
    { label: 'Editar', icon: Edit, onClick: abrirEdicao, isVisivel: (a) => pendente(a) && !ehAuditor },
    { label: 'Cancelar', icon: XCircle, onClick: (a) => void executar(() => agendaService.atualizar(a.id, { status: 'cancelada' }), 'Agendamento cancelado.'), isVisivel: (a) => pendente(a) && !ehAuditor },
    { label: 'Remover', icon: Trash2, onClick: setRemovendo, className: 'text-error', isVisivel: () => !ehAuditor },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Agenda"
        subtitle="Programe auditorias por unidade, com recorrência"
        action={!ehAuditor ? (
          <button className="btn btn-primary btn-sm gap-2" onClick={abrirNovo}>
            <Plus className="w-4 h-4" /> Agendar
          </button>
        ) : undefined}
      />
      <div className="px-4 py-4 lg:px-8 space-y-4">
        <CrudFiltros
          campos={[
            { key: 'status', label: 'Status', tipo: 'select', opcoes: Object.entries(STATUS_AGENDA_LABELS).map(([value, label]) => ({ value, label })) },
            ...(ehAuditor ? [] : [{ key: 'responsavelId', label: 'Responsável', tipo: 'select' as const, opcoes: responsaveis.map((u) => ({ value: u.id, label: u.nome })) }]),
          ]}
          valoresIniciais={FILTROS_INICIAIS}
          onPesquisar={(f) => void carregar(f, 200)}
          onLimpar={() => void carregar(FILTROS_INICIAIS, 20)}
        />
        <CrudTable
          colunas={colunas}
          dados={itens}
          acoes={acoes}
          keyExtractor={(a) => a.id}
          loading={loading}
          emptyState={{
            icon: CalendarClock,
            title: 'Nenhum agendamento encontrado',
            description: 'Agende auditorias para não perder os prazos de visita.',
            ...(!ehAuditor ? { actionLabel: 'Agendar', actionOnClick: abrirNovo } : {}),
          }}
        />
        <p className="text-xs text-base-content/50">
          Ao concluir um agendamento recorrente, o próximo é criado automaticamente. Para realizar a visita, use <Link href="/admin/auditoria/nova" className="link">Nova Auditoria</Link>.
        </p>
      </div>

      <FormModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar agendamento' : 'Agendar auditoria'}
        maxWidth="lg"
        isDirty={form.dataPrevista !== (editando?.dataPrevista.slice(0, 10) ?? '')}
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
            <span className="label-text mb-1">Unidade *</span>
            <select className="select select-bordered" disabled={!!editando} value={form.unidadeId} onChange={(e) => setForm({ ...form, unidadeId: e.target.value })}>
              <option value="">Selecione</option>
              {unidades.map((u) => (<option key={u.id} value={u.id}>{u.nome}</option>))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1">Checklist *</span>
            <select className="select select-bordered" disabled={!!editando} value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
              <option value="">Selecione</option>
              {templates.map((t) => (<option key={t.id} value={t.id}>{t.nome}</option>))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1">Data *</span>
            <input type="date" className="input input-bordered" value={form.dataPrevista} onChange={(e) => setForm({ ...form, dataPrevista: e.target.value })} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1">Repetição</span>
            <select className="select select-bordered" value={form.recorrencia} onChange={(e) => setForm({ ...form, recorrencia: e.target.value as RecorrenciaAgenda })}>
              {Object.entries(RECORRENCIA_LABELS).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1">Responsável</span>
            <select className="select select-bordered" value={form.responsavelId} onChange={(e) => setForm({ ...form, responsavelId: e.target.value })}>
              <option value="">Sem responsável</option>
              {responsaveis.map((u) => (<option key={u.id} value={u.id}>{u.nome}</option>))}
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1">Observação</span>
            <textarea className="textarea textarea-bordered" rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </label>
        </div>
      </FormModal>

      <ConfirmDialog
        open={removendo !== null}
        onClose={() => setRemovendo(null)}
        onConfirm={async () => {
          if (!removendo) return;
          await executar(() => agendaService.remover(removendo.id), 'Agendamento removido.');
          setRemovendo(null);
        }}
        title="Remover agendamento"
        message="Deseja remover este agendamento?"
        confirmLabel="Remover"
      />
    </AppLayout>
  );
}

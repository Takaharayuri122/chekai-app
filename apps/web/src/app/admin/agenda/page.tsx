'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, CalendarDays, CheckCircle2, Edit, List, Loader2, Play, Plus, Trash2, XCircle } from 'lucide-react';
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
import { checklistService, unidadeService, usuarioService, type ChecklistTemplate, type Unidade, type Usuario } from '@/lib/api';
import { useAuthStore, PerfilUsuario } from '@/lib/store';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { toastService } from '@/lib/toast';
import { dataLocalISO, formatarDataBr } from '@/lib/datas';
import { intervaloGrade } from '@/lib/agenda/calendario';
import { CalendarioAgenda } from '@/components/agenda/calendario-agenda';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
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

const atrasada = (a: AgendaItem) => a.status === 'agendada' && a.dataPrevista.slice(0, 10) < dataLocalISO();

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
  const [visao, setVisao] = useState<'calendario' | 'lista'>('calendario');
  const [mesAtual, setMesAtual] = useState(() => ({ ano: new Date().getFullYear(), mes: new Date().getMonth() }));
  const [itensMes, setItensMes] = useState<AgendaItem[]>([]);
  const [carregandoMes, setCarregandoMes] = useState(true);
  const [detalhe, setDetalhe] = useState<AgendaItem | null>(null);

  useEffect(() => {
    try {
      const salva = localStorage.getItem('chekai:agenda-visao');
      if (salva === 'lista' || salva === 'calendario') setVisao(salva);
    } catch {
      // preferência indisponível
    }
  }, []);

  const trocarVisao = (v: 'calendario' | 'lista') => {
    setVisao(v);
    try {
      localStorage.setItem('chekai:agenda-visao', v);
    } catch {
      // preferência não persistida
    }
  };

  const carregarMes = useCallback(async (ano: number, mes: number) => {
    setCarregandoMes(true);
    try {
      const r = await agendaService.listar(1, 500, undefined, undefined, intervaloGrade(ano, mes));
      setItensMes(r.items);
    } catch {
      // erro tratado pelo interceptor
    } finally {
      setCarregandoMes(false);
    }
  }, []);

  useEffect(() => {
    void carregarMes(mesAtual.ano, mesAtual.mes);
  }, [carregarMes, mesAtual]);

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

  const recarregar = () => Promise.all([carregar(FILTROS_INICIAIS, 20), carregarMes(mesAtual.ano, mesAtual.mes)]);

  const abrirNovo = (dataPrevista = '') => {
    setEditando(null);
    setForm({ ...FORM_INICIAL, dataPrevista });
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
    { label: 'Data', render: (a) => <span className={atrasada(a) ? 'font-semibold text-destructive' : ''}>{formatarDataBr(a.dataPrevista)}</span> },
    { label: 'Unidade', render: (a) => <span className="font-medium">{a.unidade?.nome ?? '-'}</span> },
    { label: 'Checklist', render: (a) => a.template?.nome ?? '-' },
    { label: 'Responsável', render: (a) => a.responsavel?.nome ?? '-', mobileOculta: true },
    { label: 'Repete', render: (a) => RECORRENCIA_LABELS[a.recorrencia], mobileOculta: true },
    { label: 'Status', render: (a) => <StatusChip status={atrasada(a) ? 'atrasada' : a.status} label={atrasada(a) ? 'Atrasada' : STATUS_AGENDA_LABELS[a.status]} /> },
  ];

  const pendente = (a: AgendaItem) => a.status === 'agendada';
  const acoes: AcaoTabela<AgendaItem>[] = [
    { label: 'Iniciar auditoria', icon: Play, onClick: () => { window.location.href = '/admin/auditoria/nova'; }, isVisivel: pendente },
    { label: 'Marcar como realizada', icon: CheckCircle2, onClick: (a) => void executar(() => agendaService.concluir(a.id), 'Agendamento concluído.'), isVisivel: (a) => pendente(a) },
    { label: 'Editar', icon: Edit, onClick: abrirEdicao, isVisivel: (a) => pendente(a) && !ehAuditor },
    { label: 'Cancelar', icon: XCircle, onClick: (a) => void executar(() => agendaService.atualizar(a.id, { status: 'cancelada' }), 'Agendamento cancelado.'), isVisivel: (a) => pendente(a) && !ehAuditor },
    { label: 'Remover', icon: Trash2, onClick: setRemovendo, className: 'text-destructive', isVisivel: () => !ehAuditor },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Agenda"
        subtitle="Programe auditorias por unidade, com recorrência"
        action={!ehAuditor ? (
          <Button onClick={() => abrirNovo()}>
            <Plus className="h-4 w-4" /> Agendar
          </Button>
        ) : undefined}
      />
      <div className="px-4 py-4 lg:px-8 space-y-4">
        <div className="inline-flex rounded-md border border-border bg-card p-1" role="tablist" aria-label="Visualização">
          {([
            ['calendario', 'Calendário', CalendarDays],
            ['lista', 'Lista', List],
          ] as const).map(([valor, rotulo, Icone]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={visao === valor}
              onClick={() => trocarVisao(valor)}
              className={`flex h-9 items-center gap-2 rounded px-3 text-sm font-medium ${visao === valor ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Icone className="h-4 w-4" />
              {rotulo}
            </button>
          ))}
        </div>

        {visao === 'calendario' && (
          <CalendarioAgenda
            ano={mesAtual.ano}
            mes={mesAtual.mes}
            itens={itensMes}
            carregando={carregandoMes}
            podeAgendar={!ehAuditor}
            onMudarMes={(ano, mes) => setMesAtual({ ano, mes })}
            onSelecionarItem={setDetalhe}
            onAgendarNoDia={(iso) => abrirNovo(iso)}
          />
        )}

        {visao === 'lista' && (
        <>
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
            ...(!ehAuditor ? { actionLabel: 'Agendar', actionOnClick: () => abrirNovo() } : {}),
          }}
        />
        </>
        )}
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
            <Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Unidade *</span>
            <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" disabled={!!editando} value={form.unidadeId} onChange={(e) => setForm({ ...form, unidadeId: e.target.value })}>
              <option value="">Selecione</option>
              {unidades.map((u) => (<option key={u.id} value={u.id}>{u.nome}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Checklist *</span>
            <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" disabled={!!editando} value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })}>
              <option value="">Selecione</option>
              {templates.map((t) => (<option key={t.id} value={t.id}>{t.nome}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Data *</span>
            <Input type="date" value={form.dataPrevista} onChange={(e) => setForm({ ...form, dataPrevista: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Repetição</span>
            <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={form.recorrencia} onChange={(e) => setForm({ ...form, recorrencia: e.target.value as RecorrenciaAgenda })}>
              {Object.entries(RECORRENCIA_LABELS).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Responsável</span>
            <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={form.responsavelId} onChange={(e) => setForm({ ...form, responsavelId: e.target.value })}>
              <option value="">Sem responsável</option>
              {responsaveis.map((u) => (<option key={u.id} value={u.id}>{u.nome}</option>))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Observação</span>
            <Textarea rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />
          </label>
        </div>
      </FormModal>

      <ResponsiveDialog
        open={detalhe !== null}
        onOpenChange={(aberto) => !aberto && setDetalhe(null)}
        title={detalhe?.unidade?.nome ?? 'Agendamento'}
        description={detalhe ? `${formatarDataBr(detalhe.dataPrevista)} · ${detalhe.template?.nome ?? ''}` : undefined}
      >
        {detalhe && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd className="mt-1"><StatusChip status={atrasada(detalhe) ? 'atrasada' : detalhe.status} label={atrasada(detalhe) ? 'Atrasada' : STATUS_AGENDA_LABELS[detalhe.status]} /></dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Repete</dt>
                <dd className="mt-1">{RECORRENCIA_LABELS[detalhe.recorrencia]}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Responsável</dt>
                <dd className="mt-1">{detalhe.responsavel?.nome ?? '—'}</dd>
              </div>
              {detalhe.observacao && (
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Observação</dt>
                  <dd className="mt-1">{detalhe.observacao}</dd>
                </div>
              )}
            </dl>
            <div className="flex flex-col gap-2">
              {acoes
                .filter((acao) => !acao.isVisivel || acao.isVisivel(detalhe))
                .map((acao) => (
                  <Button
                    key={acao.label}
                    variant="outline"
                    className={`h-11 justify-start ${acao.label === 'Remover' ? 'text-destructive' : ''}`}
                    onClick={() => {
                      const item = detalhe;
                      setDetalhe(null);
                      acao.onClick(item);
                    }}
                  >
                    <acao.icon className="h-4 w-4" />
                    {acao.label}
                  </Button>
                ))}
            </div>
          </div>
        )}
      </ResponsiveDialog>

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

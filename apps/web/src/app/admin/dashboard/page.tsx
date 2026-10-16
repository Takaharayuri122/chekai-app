'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ClipboardCheck,
  Plus,
  Building2,
  TrendingUp,
  Clock,
  ChevronRight,
  Calendar,
  Trophy,
  Star,
  Printer,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppLayout, StatCard, EmptyState } from '@/components';
import { auditoriaService, type Auditoria } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';
import { agendaService, type AgendaItem } from '@/lib/services/agenda.service';
import { planoAcaoService, type ResumoPlanoAcao } from '@/lib/services/plano-acao.service';

export default function DashboardPage() {
  const { usuario } = useAuthStore();
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [resumoPlano, setResumoPlano] = useState<ResumoPlanoAcao | null>(null);
  const [proximasAgendas, setProximasAgendas] = useState<AgendaItem[]>([]);

  useEffect(() => {
    agendaService.listar(1, 5, 'agendada').then((r) => setProximasAgendas(r.items)).catch(() => undefined);
  }, []);

  useEffect(() => {
    planoAcaoService.resumo().then(setResumoPlano).catch(() => undefined);
  }, []);

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const todas: Auditoria[] = [];
        for (let pagina = 1; pagina <= 10; pagina++) {
          const response = await auditoriaService.listar(pagina, 100);
          todas.push(...(response.items || []));
          if ((response.items || []).length < 100) break;
        }
        setAuditorias(todas);
      } catch (error) {
        // Erro já é tratado pelo interceptor
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, []);

  const [periodoInicio, setPeriodoInicio] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [periodoFim, setPeriodoFim] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [filtroTemplate, setFiltroTemplate] = useState<string>('');
  const [filtroUnidade, setFiltroUnidade] = useState<string>('');

  const templatesOpcoes = useMemo(() => {
    const mapa = new Map<string, string>();
    auditorias.forEach((a) => a.template && mapa.set(a.template.id, a.template.nome));
    return Array.from(mapa, ([id, nome]) => ({ id, nome }));
  }, [auditorias]);

  const unidadesOpcoes = useMemo(() => {
    const mapa = new Map<string, string>();
    auditorias.forEach((a) => a.unidade && mapa.set(a.unidade.id, a.unidade.nome));
    return Array.from(mapa, ([id, nome]) => ({ id, nome }));
  }, [auditorias]);

  const auditoriasFiltradas = useMemo(() => {
    const inicio = new Date(`${periodoInicio}T00:00:00`).getTime();
    const fim = new Date(`${periodoFim}T23:59:59`).getTime();
    return auditorias.filter((a) => {
      const t = new Date(a.dataInicio).getTime();
      if (t < inicio || t > fim) return false;
      if (filtroTemplate && a.template?.id !== filtroTemplate) return false;
      if (filtroUnidade && a.unidade?.id !== filtroUnidade) return false;
      return true;
    });
  }, [auditorias, periodoInicio, periodoFim, filtroTemplate, filtroUnidade]);

  const [aba, setAba] = useState<'classica' | 'checklist'>('classica');
  const [abaFavorita, setAbaFavorita] = useState<'classica' | 'checklist'>('classica');

  useEffect(() => {
    try {
      const salva = localStorage.getItem('dashboard-aba-favorita');
      if (salva === 'classica' || salva === 'checklist') {
        setAbaFavorita(salva);
        setAba(salva);
      }
    } catch {
      // localStorage indisponível
    }
  }, []);

  const favoritarAba = (valor: 'classica' | 'checklist') => {
    setAbaFavorita(valor);
    try {
      localStorage.setItem('dashboard-aba-favorita', valor);
    } catch {
      // localStorage indisponível
    }
  };

  const resumoPorChecklist = useMemo(() => {
    const mapa = new Map<string, { nome: string; total: number; finalizadas: number; soma: number }>();
    auditoriasFiltradas.forEach((a) => {
      const id = a.template?.id || 'x';
      const atual = mapa.get(id) || { nome: a.template?.nome || 'Sem checklist', total: 0, finalizadas: 0, soma: 0 };
      atual.total += 1;
      if (a.status === 'finalizada') {
        atual.finalizadas += 1;
        atual.soma += Number(a.pontuacaoTotal || 0);
      }
      mapa.set(id, atual);
    });
    return Array.from(mapa.values()).sort((x, y) => y.total - x.total);
  }, [auditoriasFiltradas]);

  const auditoriasEmAndamento = auditoriasFiltradas.filter((a) => a.status === 'em_andamento');
  const auditoriasFinalizadas = auditoriasFiltradas.filter((a) => a.status === 'finalizada');
  const ultimasAuditorias = auditoriasFiltradas.slice(0, 10);

  const mediaAproveitamento = auditoriasFinalizadas.length
    ? auditoriasFinalizadas.reduce((acc, a) => acc + Number(a.pontuacaoTotal || 0), 0) /
      auditoriasFinalizadas.length
    : 0;

  const avaliacoesPorMes = useMemo(() => {
    const mapa = new Map<string, number>();
    auditoriasFiltradas.forEach((a) => {
      const d = new Date(a.dataInicio);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      mapa.set(chave, (mapa.get(chave) || 0) + 1);
    });
    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([chave, total]) => {
        const [ano, mes] = chave.split('-');
        return { mes: `${mes}/${ano.slice(2)}`, total };
      });
  }, [auditoriasFiltradas]);

  const rankingAvaliadores = useMemo(() => {
    const mapa = new Map<string, { nome: string; total: number }>();
    auditoriasFiltradas.forEach((a) => {
      const id = a.consultor?.id || 'desconhecido';
      const atual = mapa.get(id) || { nome: a.consultor?.nome || 'Não especificado', total: 0 };
      atual.total += 1;
      mapa.set(id, atual);
    });
    return Array.from(mapa.values()).sort((x, y) => y.total - x.total);
  }, [auditoriasFiltradas]);

  const rankingUnidades = useMemo(() => {
    const mapa = new Map<string, { nome: string; notas: number[]; ultima: number }>();
    [...auditoriasFinalizadas]
      .sort((x, y) => new Date(x.dataInicio).getTime() - new Date(y.dataInicio).getTime())
      .forEach((a) => {
        const id = a.unidade?.id || 'x';
        const atual = mapa.get(id) || { nome: a.unidade?.nome || 'Unidade', notas: [], ultima: 0 };
        atual.notas.push(Number(a.pontuacaoTotal || 0));
        atual.ultima = Number(a.pontuacaoTotal || 0);
        mapa.set(id, atual);
      });
    return Array.from(mapa.values())
      .map((u) => ({ ...u, media: u.notas.reduce((x, y) => x + y, 0) / u.notas.length }))
      .sort((x, y) => y.media - x.media);
  }, [auditoriasFinalizadas]);

  const corAproveitamento = (v: number) => (v >= 80 ? '#16a34a' : v >= 60 ? '#f59e0b' : '#dc2626');
  const gaugeData = [
    { name: 'valor', value: mediaAproveitamento },
    { name: 'resto', value: Math.max(0, 100 - mediaAproveitamento) },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'em_andamento':
        return <span className="badge badge-warning badge-sm">Em andamento</span>;
      case 'finalizada':
        return <span className="badge badge-success badge-sm">Finalizada</span>;
      case 'cancelada':
        return <span className="badge badge-error badge-sm">Cancelada</span>;
      default:
        return <span className="badge badge-ghost badge-sm">{status}</span>;
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  const formatDateWithTime = (date: string | Date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAuditoriaDate = (auditoria: Auditoria) => {
    if (auditoria.status === 'finalizada' && auditoria.dataFim) {
      return auditoria.dataFim;
    }
    return auditoria.dataInicio;
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 lg:px-8 space-y-4">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-base-content">
            Olá, {usuario?.nome?.split(' ')[0] || 'Usuário'} 👋
          </h1>
          <p className="text-base-content/60">
            {new Date().toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Link
            href="/admin/auditoria/nova"
            className="btn btn-primary btn-lg w-full gap-2 justify-start"
          >
            <Plus className="w-5 h-5" />
            Iniciar Nova Auditoria
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <StatCard
            title="Em Andamento"
            value={auditoriasEmAndamento.length}
            icon={Clock}
            color="warning"
          />
          <StatCard
            title="Finalizadas"
            value={auditoriasFinalizadas.length}
            icon={ClipboardCheck}
            color="success"
          />
          <StatCard
            title="No Período"
            value={auditoriasFiltradas.length}
            icon={Calendar}
            color="info"
          />
          <StatCard
            title="Clientes"
            value={new Set(auditoriasFiltradas.map((a) => a.unidade?.cliente?.id)).size}
            icon={Building2}
            color="secondary"
          />
        </motion.div>

        {/* Abas */}
        <div className="flex items-center justify-between print:hidden">
          <div role="tablist" className="tabs tabs-lifted">
            {([['classica', 'Clássica'], ['checklist', 'Checklist']] as const).map(([valor, label]) => (
              <a key={valor} role="tab" className={`tab gap-2 ${aba === valor ? 'tab-active font-semibold' : ''}`} onClick={() => setAba(valor)}>
                {label}
                <button
                  type="button"
                  title={abaFavorita === valor ? 'Aba inicial' : 'Definir como aba inicial'}
                  aria-label="Definir como aba inicial"
                  onClick={(e) => { e.stopPropagation(); favoritarAba(valor); }}
                >
                  <Star className={`w-4 h-4 ${abaFavorita === valor ? 'fill-warning text-warning' : 'text-base-content/40'}`} />
                </button>
              </a>
            ))}
          </div>
          <button className="btn btn-ghost btn-sm btn-square" title="Imprimir" onClick={() => window.print()}>
            <Printer className="w-4 h-4" />
          </button>
        </div>

        {/* Filtros */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <label className="form-control">
              <span className="label-text text-xs mb-1">De</span>
              <input type="date" className="input input-bordered input-sm" value={periodoInicio} onChange={(e) => setPeriodoInicio(e.target.value)} />
            </label>
            <label className="form-control">
              <span className="label-text text-xs mb-1">Até</span>
              <input type="date" className="input input-bordered input-sm" value={periodoFim} onChange={(e) => setPeriodoFim(e.target.value)} />
            </label>
            <label className="form-control">
              <span className="label-text text-xs mb-1">Checklist</span>
              <select className="select select-bordered select-sm" value={filtroTemplate} onChange={(e) => setFiltroTemplate(e.target.value)}>
                <option value="">Todos</option>
                {templatesOpcoes.map((t) => (<option key={t.id} value={t.id}>{t.nome}</option>))}
              </select>
            </label>
            <label className="form-control">
              <span className="label-text text-xs mb-1">Unidade</span>
              <select className="select select-bordered select-sm" value={filtroUnidade} onChange={(e) => setFiltroUnidade(e.target.value)}>
                <option value="">Todas</option>
                {unidadesOpcoes.map((u) => (<option key={u.id} value={u.id}>{u.nome}</option>))}
              </select>
            </label>
          </div>
        </div>

        {aba === 'checklist' && (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body p-4">
              <h2 className="text-sm font-semibold uppercase text-primary">Desempenho por checklist</h2>
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead><tr><th>Checklist</th><th className="text-right">Avaliações</th><th className="text-right">Finalizadas</th><th className="text-right">Média</th></tr></thead>
                  <tbody>
                    {resumoPorChecklist.length === 0 && (<tr><td colSpan={4} className="text-base-content/50">Nenhum registro encontrado para os filtros selecionados.</td></tr>)}
                    {resumoPorChecklist.map((c) => (
                      <tr key={c.nome}>
                        <td>{c.nome}</td>
                        <td className="text-right">{c.total}</td>
                        <td className="text-right">{c.finalizadas}</td>
                        <td className="text-right">{c.finalizadas ? `${(c.soma / c.finalizadas).toFixed(1).replace('.', ',')} %` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {aba === 'classica' && (<>
        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body p-4">
              <h2 className="text-sm font-semibold uppercase text-primary">Número de avaliações por mês</h2>
              {avaliacoesPorMes.length === 0 ? (
                <p className="text-sm text-base-content/60 py-10 text-center">Nenhum registro encontrado para os filtros selecionados.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={avaliacoesPorMes}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="mes" />
                      <YAxis allowDecimals={false} />
                      <RTooltip />
                      <Bar dataKey="total" name="Avaliações" radius={[4, 4, 0, 0]}>
                        {avaliacoesPorMes.map((_, i) => (<Cell key={i} fill={i % 2 === 0 ? '#14b8a6' : '#f97316'} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body p-4">
              <h2 className="text-sm font-semibold uppercase text-primary">% Média de aproveitamento</h2>
              {auditoriasFinalizadas.length === 0 ? (
                <p className="text-sm text-base-content/60 py-10 text-center">Nenhuma auditoria finalizada no período.</p>
              ) : (
                <div className="h-56 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={gaugeData} dataKey="value" startAngle={180} endAngle={0} cx="50%" cy="80%" innerRadius="65%" outerRadius="95%" stroke="none">
                        <Cell fill={corAproveitamento(mediaAproveitamento)} />
                        <Cell fill="#e5e7eb" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-x-0 bottom-6 text-center text-3xl font-bold">
                    {mediaAproveitamento.toFixed(2).replace('.', ',')} %
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body p-4">
              <h2 className="text-sm font-semibold uppercase text-primary">Plano de ação - tarefas por término</h2>
              {!resumoPlano || resumoPlano.atrasadas + resumoPlano.proximos7Dias + resumoPlano.futuras + resumoPlano.concluidas === 0 ? (
                <p className="text-sm text-base-content/60 py-10 text-center">Nenhuma tarefa cadastrada.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { nome: 'Atrasadas', total: resumoPlano.atrasadas, cor: '#dc2626' },
                        { nome: 'Próx. 7 dias', total: resumoPlano.proximos7Dias, cor: '#f59e0b' },
                        { nome: 'Futuras', total: resumoPlano.futuras, cor: '#14b8a6' },
                        { nome: 'Concluídas', total: resumoPlano.concluidas, cor: '#16a34a' },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="nome" />
                      <YAxis allowDecimals={false} />
                      <RTooltip />
                      <Bar dataKey="total" name="Tarefas" radius={[4, 4, 0, 0]}>
                        {['#dc2626', '#f59e0b', '#14b8a6', '#16a34a'].map((c) => (<Cell key={c} fill={c} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <Link href="/admin/planos-acao" className="btn btn-ghost btn-xs self-end gap-1">Ver tarefas <ChevronRight className="w-3 h-3" /></Link>
            </div>
          </div>
        </div>

        {/* Rankings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body p-4">
              <h2 className="text-sm font-semibold uppercase text-primary flex items-center gap-2">
                <Trophy className="w-4 h-4" /> Ranking de avaliadores
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { titulo: 'Mais ativos', lista: rankingAvaliadores.slice(0, 3) },
                  { titulo: 'Menos ativos', lista: [...rankingAvaliadores].reverse().slice(0, 3) },
                ].map((bloco) => (
                  <div key={bloco.titulo}>
                    <h3 className="text-sm font-semibold mb-1">{bloco.titulo}</h3>
                    <table className="table table-xs">
                      <thead><tr><th>Nome</th><th className="text-right">Quant.</th></tr></thead>
                      <tbody>
                        {bloco.lista.length === 0 && (<tr><td colSpan={2} className="text-base-content/50">Sem dados</td></tr>)}
                        {bloco.lista.map((r, i) => (
                          <tr key={r.nome}><td>{i + 1} {r.nome}</td><td className="text-right">{r.total}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
              <Link href="/admin/auditorias" className="btn btn-ghost btn-xs self-end">Ver todos...</Link>
            </div>
          </div>
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body p-4">
              <h2 className="text-sm font-semibold uppercase text-primary flex items-center gap-2">
                <Building2 className="w-4 h-4" /> Ranking de unidades
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { titulo: 'Melhor aproveitamento', lista: rankingUnidades.slice(0, 3) },
                  { titulo: 'Pior aproveitamento', lista: [...rankingUnidades].reverse().slice(0, 3) },
                ].map((bloco) => (
                  <div key={bloco.titulo}>
                    <h3 className="text-sm font-semibold mb-1">{bloco.titulo}</h3>
                    <table className="table table-xs">
                      <thead><tr><th>Unidade</th><th className="text-right">Última</th><th className="text-right">Média</th></tr></thead>
                      <tbody>
                        {bloco.lista.length === 0 && (<tr><td colSpan={3} className="text-base-content/50">Sem dados</td></tr>)}
                        {bloco.lista.map((u, i) => (
                          <tr key={u.nome}>
                            <td className="max-w-[8rem] truncate">{i + 1} {u.nome}</td>
                            <td className="text-right">{u.ultima.toFixed(0)}%</td>
                            <td className="text-right">{u.media.toFixed(0)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        </>)}

        {proximasAgendas.length > 0 && (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body p-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase text-primary flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Próximas auditorias agendadas
                </h2>
                <Link href="/admin/agenda" className="btn btn-ghost btn-xs">Ver agenda</Link>
              </div>
              <ul className="divide-y divide-base-200">
                {proximasAgendas.map((a) => {
                  const atrasada = a.dataPrevista.slice(0, 10) < new Date().toISOString().slice(0, 10);
                  return (
                    <li key={a.id} className="flex items-center justify-between py-2 text-sm gap-3">
                      <span className="truncate">{a.unidade?.nome} - {a.template?.nome}</span>
                      <span className={`whitespace-nowrap ${atrasada ? 'text-error font-semibold' : 'text-base-content/60'}`}>
                        {a.dataPrevista.slice(0, 10).split('-').reverse().join('/')}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Recent Audits */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-base-content">Auditorias Recentes</h2>
            {auditorias.length > 0 && (
              <Link href="/admin/auditorias" className="btn btn-ghost btn-sm gap-1">
                Ver todas
                <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body items-center py-12">
                <span className="loading loading-spinner loading-lg text-primary"></span>
              </div>
            </div>
          ) : auditoriasFiltradas.length === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Nenhuma auditoria encontrada"
              description="Ajuste os filtros ou inicie uma nova auditoria."
              actionLabel="Iniciar Auditoria"
              actionHref="/admin/auditoria/nova"
            />
          ) : (
            <div className="space-y-2">
                {ultimasAuditorias.map((auditoria, index) => (
                  <Link
                    key={auditoria.id}
                    href={
                      auditoria.status === 'finalizada'
                        ? `/admin/auditoria/${auditoria.id}/relatorio`
                        : `/admin/auditoria/${auditoria.id}`
                    }
                    className="flex items-start gap-4 p-4 rounded-lg border border-base-200 bg-base-100 shadow-sm hover:bg-base-200/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-medium text-base-content truncate">
                        {auditoria.template?.nome || 'Template não especificado'} - {auditoria.unidade?.nome || 'Unidade'}
                      </p>
                      <p className="text-sm text-base-content/60 truncate">
                        Cliente: {auditoria.unidade?.cliente?.nomeFantasia || auditoria.unidade?.cliente?.razaoSocial || 'Cliente'}
                      </p>
                      <p className="text-sm text-base-content/60 truncate">
                        Auditor: {auditoria.consultor?.nome || 'Auditor não especificado'}
                      </p>
                      <p className="text-xs text-base-content/50">
                        {formatDateWithTime(getAuditoriaDate(auditoria))}
                        {auditoria.totalFotos !== undefined && ` · ${auditoria.totalFotos} foto(s)`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {getStatusBadge(auditoria.status)}
                      {auditoria.status === 'finalizada' && auditoria.pontuacaoTotal !== undefined && (
                        <div className="text-right">
                          <div
                            className={`radial-progress text-sm ${
                              Number(auditoria.pontuacaoTotal) >= 80
                                ? 'text-success'
                                : Number(auditoria.pontuacaoTotal) >= 60
                                ? 'text-warning'
                                : 'text-error'
                            }`}
                            style={{
                              '--value': Number(auditoria.pontuacaoTotal),
                              '--size': '2.5rem',
                              '--thickness': '3px',
                            } as React.CSSProperties}
                            role="progressbar"
                          >
                            <span className="text-xs font-bold">
                              {Number(auditoria.pontuacaoTotal).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </motion.div>

        {/* In Progress */}
        {auditoriasEmAndamento.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h2 className="text-lg font-semibold text-base-content mb-4">
              Continuar Auditoria
            </h2>
            <div className="space-y-3">
              {auditoriasEmAndamento.slice(0, 3).map((auditoria) => (
                <Link
                  key={auditoria.id}
                  href={`/admin/auditoria/${auditoria.id}`}
                  className="card bg-warning/10 border border-warning/20 hover:border-warning/40 transition-colors"
                >
                  <div className="card-body p-4 flex-row items-center gap-4">
                    <div className="w-10 h-10 bg-warning/20 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-warning" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-base-content truncate">
                        {auditoria.unidade?.nome}
                      </p>
                      <p className="text-sm text-base-content/60">
                        Iniciada em {formatDate(auditoria.dataInicio)}
                      </p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-base-content/40" />
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}

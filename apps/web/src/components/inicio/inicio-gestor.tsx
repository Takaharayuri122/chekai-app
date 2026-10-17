'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock, ClipboardCheck, Clock, ListChecks, Printer, TrendingUp } from 'lucide-react';
import { EmptyState, StatCard, StatusChip } from '@/components';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/shadcn/tabs';
import { auditoriaService, type Auditoria } from '@/lib/api';
import { agendaService, type AgendaItem } from '@/lib/services/agenda.service';
import { planoAcaoService, type ResumoPlanoAcao } from '@/lib/services/plano-acao.service';
import { useAuthStore } from '@/lib/store';
import { dataLocalISO, formatarDataBr } from '@/lib/datas';
import {
  avaliacoesPorMes,
  filtrarDashboard,
  mediaAproveitamento,
  rankingAvaliadores,
  rankingUnidades,
  resumoPorChecklist,
  type FiltroDashboard,
} from '@/lib/dashboard/agregacoes';

const SELECT = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm';
const PRIMARY = 'hsl(175 100% 36%)';

function Painel({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1).replace('.', ',')}%`);

export function InicioGestor() {
  const { usuario } = useAuthStore();
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [resumoPlano, setResumoPlano] = useState<ResumoPlanoAcao | null>(null);
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [filtro, setFiltro] = useState<FiltroDashboard>(() => {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 30);
    return { inicio: dataLocalISO(inicio), fim: dataLocalISO(), templateId: '', unidadeId: '' };
  });

  useEffect(() => {
    const carregar = async () => {
      try {
        const todas: Auditoria[] = [];
        for (let pagina = 1; pagina <= 10; pagina++) {
          const r = await auditoriaService.listar(pagina, 100);
          todas.push(...(r.items || []));
          if ((r.items || []).length < 100) break;
        }
        setAuditorias(todas);
      } catch {
        // erro tratado pelo interceptor
      } finally {
        setCarregando(false);
      }
    };
    void carregar();
    planoAcaoService.resumo().then(setResumoPlano).catch(() => undefined);
    agendaService.listar(1, 5, 'agendada').then((r) => setAgendas(r.items)).catch(() => undefined);
  }, []);

  const opcoes = useMemo(() => {
    const t = new Map<string, string>();
    const u = new Map<string, string>();
    auditorias.forEach((a) => {
      if (a.template) t.set(a.template.id, a.template.nome);
      if (a.unidade) u.set(a.unidade.id, a.unidade.nome);
    });
    return { templates: Array.from(t, ([id, nome]) => ({ id, nome })), unidades: Array.from(u, ([id, nome]) => ({ id, nome })) };
  }, [auditorias]);

  const filtradas = useMemo(() => filtrarDashboard(auditorias, filtro), [auditorias, filtro]);
  const media = mediaAproveitamento(filtradas);
  const porMes = avaliacoesPorMes(filtradas);
  const avaliadores = rankingAvaliadores(filtradas);
  const unidades = rankingUnidades(filtradas);
  const checklists = resumoPorChecklist(filtradas);
  const emAndamento = filtradas.filter((a) => a.status === 'em_andamento').length;
  const set = <K extends keyof FiltroDashboard>(k: K, v: string) => setFiltro((f) => ({ ...f, [k]: v }));
  const maxAvaliador = Math.max(1, ...avaliadores.map((r) => r.total));

  return (
    <div className="space-y-4 px-4 py-4 lg:px-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Olá, {usuario?.nome?.split(' ')[0] ?? 'gestor'}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="hidden h-10 w-10 md:inline-flex print:hidden" onClick={() => window.print()} aria-label="Imprimir">
          <Printer className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 shadow-sm lg:grid-cols-4 print:hidden">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">De</span>
          <Input type="date" value={filtro.inicio} onChange={(e) => set('inicio', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Até</span>
          <Input type="date" value={filtro.fim} onChange={(e) => set('fim', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Checklist</span>
          <select className={SELECT} value={filtro.templateId} onChange={(e) => set('templateId', e.target.value)}>
            <option value="">Todos</option>
            {opcoes.templates.map((o) => (<option key={o.id} value={o.id}>{o.nome}</option>))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Unidade</span>
          <select className={SELECT} value={filtro.unidadeId} onChange={(e) => set('unidadeId', e.target.value)}>
            <option value="">Todas</option>
            {opcoes.unidades.map((o) => (<option key={o.id} value={o.id}>{o.nome}</option>))}
          </select>
        </label>
      </div>

      {carregando ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-20" />))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Avaliações no período" value={filtradas.length} icon={ClipboardCheck} color="primary" />
          <StatCard title="Aproveitamento médio" value={pct(media)} icon={TrendingUp} color="success" />
          <StatCard title="Em andamento" value={emAndamento} icon={Clock} color="warning" />
          <StatCard title="Tarefas atrasadas" value={resumoPlano?.atrasadas ?? '—'} icon={ListChecks} color="error" />
        </div>
      )}

      <Tabs defaultValue="geral">
        <TabsList className="w-full justify-start overflow-x-auto print:hidden">
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Painel titulo="Avaliações por mês">
              {porMes.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma avaliação no período.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porMes}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="mes" fontSize={12} />
                      <YAxis allowDecimals={false} fontSize={12} />
                      <RTooltip />
                      <Bar dataKey="total" name="Avaliações" fill={PRIMARY} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Painel>
            <Painel titulo="Plano de ação por prazo" acao={<Link href="/admin/planos-acao" className="text-sm font-medium text-primary">Ver tarefas</Link>}>
              {!resumoPlano || resumoPlano.atrasadas + resumoPlano.proximos7Dias + resumoPlano.futuras + resumoPlano.concluidas === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { nome: 'Atrasadas', total: resumoPlano.atrasadas, cor: 'hsl(0 84% 60%)' },
                        { nome: 'Próx. 7 dias', total: resumoPlano.proximos7Dias, cor: 'hsl(38 92% 50%)' },
                        { nome: 'Futuras', total: resumoPlano.futuras, cor: PRIMARY },
                        { nome: 'Concluídas', total: resumoPlano.concluidas, cor: 'hsl(160 84% 39%)' },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="nome" fontSize={12} />
                      <YAxis allowDecimals={false} fontSize={12} />
                      <RTooltip />
                      <Bar dataKey="total" name="Tarefas" radius={[4, 4, 0, 0]}>
                        {['hsl(0 84% 60%)', 'hsl(38 92% 50%)', PRIMARY, 'hsl(160 84% 39%)'].map((c) => (<Cell key={c} fill={c} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Painel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Painel titulo="Últimas avaliações" acao={<Link href="/admin/auditorias" className="text-sm font-medium text-primary">Ver todas</Link>}>
                {filtradas.length === 0 ? (
                  <EmptyState icon={ClipboardCheck} title="Nenhuma avaliação" description="Ajuste o período ou inicie uma auditoria." />
                ) : (
                  <ul className="divide-y divide-border">
                    {filtradas.slice(0, 8).map((a) => (
                      <li key={a.id}>
                        <Link
                          href={a.status === 'finalizada' ? `/admin/auditoria/${a.id}/relatorio` : `/admin/auditoria/${a.id}`}
                          className="flex min-h-[52px] items-center gap-3 py-2 hover:bg-muted/40"
                        >
                          <span className="w-16 shrink-0 text-xs text-muted-foreground">{formatarDataBr(dataLocalISO(new Date(a.dataInicio)))}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{a.unidade?.nome}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {a.consultor?.nome}
                              {a.totalFotos !== undefined && ` · ${a.totalFotos} foto(s)`}
                            </span>
                          </span>
                          {a.status === 'finalizada' ? (
                            <span className="text-sm font-semibold">{pct(Number(a.pontuacaoTotal || 0))}</span>
                          ) : (
                            <StatusChip status={a.status} />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Painel>
            </div>
            <Painel titulo="Próximas visitas" acao={<Link href="/admin/agenda" className="text-sm font-medium text-primary">Agenda</Link>}>
              {agendas.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">Nada agendado.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {agendas.map((g) => {
                    const atrasada = g.dataPrevista.slice(0, 10) < dataLocalISO();
                    return (
                      <li key={g.id} className="flex min-h-[48px] items-center gap-3 py-2 text-sm">
                        <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{g.unidade?.nome}</span>
                        <span className={atrasada ? 'font-semibold text-destructive' : 'text-muted-foreground'}>{formatarDataBr(g.dataPrevista)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Painel>
          </div>
        </TabsContent>

        <TabsContent value="checklists">
          <Painel titulo="Desempenho por checklist">
            {checklists.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Nenhuma avaliação no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-2 font-medium">Checklist</th>
                      <th className="px-2 py-2 text-right font-medium">Avaliações</th>
                      <th className="px-2 py-2 text-right font-medium">Finalizadas</th>
                      <th className="py-2 pl-2 text-right font-medium">Média</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {checklists.map((c) => (
                      <tr key={c.id} className="h-11">
                        <td className="pr-2">{c.nome}</td>
                        <td className="px-2 text-right">{c.total}</td>
                        <td className="px-2 text-right">{c.finalizadas}</td>
                        <td className="pl-2 text-right font-semibold">{pct(c.media)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>
        </TabsContent>

        <TabsContent value="equipe">
          <Painel titulo="Avaliações por pessoa">
            {avaliadores.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Nenhuma avaliação no período.</p>
            ) : (
              <ul className="space-y-3">
                {avaliadores.map((r, i) => (
                  <li key={r.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>
                        {i + 1}. {r.nome}
                      </span>
                      <span className="font-semibold">{r.total}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(r.total / maxAvaliador) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </TabsContent>

        <TabsContent value="unidades">
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { titulo: 'Melhor aproveitamento', lista: unidades.slice(0, 5) },
              { titulo: 'Pior aproveitamento', lista: [...unidades].reverse().slice(0, 5) },
            ].map((bloco) => (
              <Painel key={bloco.titulo} titulo={bloco.titulo}>
                {bloco.lista.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">Nenhuma auditoria finalizada no período.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-2 font-medium">Unidade</th>
                        <th className="px-2 py-2 text-right font-medium">Última</th>
                        <th className="py-2 pl-2 text-right font-medium">Média</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {bloco.lista.map((u, i) => (
                        <tr key={u.id} className="h-11">
                          <td className="max-w-[12rem] truncate pr-2">
                            {i + 1}. {u.nome}
                          </td>
                          <td className="px-2 text-right">{pct(u.ultima)}</td>
                          <td className="pl-2 text-right font-semibold">{pct(u.media)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Painel>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

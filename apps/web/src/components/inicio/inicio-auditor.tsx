'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ChevronRight, ClipboardCheck, ListChecks, Plus } from 'lucide-react';
import { auditoriaService, type Auditoria } from '@/lib/api';
import { agendaService, type AgendaItem } from '@/lib/services/agenda.service';
import { planoAcaoService, type TarefaPlanoAcao } from '@/lib/services/plano-acao.service';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/shadcn/button';
import { Skeleton } from '@/components/ui/shadcn/skeleton';

const hoje = () => new Date().toISOString().slice(0, 10);
const dataBr = (d: string) => d.slice(0, 10).split('-').reverse().join('/');

function Bloco({ titulo, icone: Icone, href, children }: { titulo: string; icone: typeof ClipboardCheck; href: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <Icone className="h-4 w-4 text-primary" />
          {titulo}
        </h2>
        <Link href={href} className="text-sm font-medium text-primary">Ver tudo</Link>
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

function Linha({ href, titulo, detalhe, destaque }: { href: string; titulo: string; detalhe: string; destaque?: boolean }) {
  return (
    <Link href={href} className="flex min-h-[52px] items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{titulo}</p>
        <p className={destaque ? 'text-xs font-medium text-destructive' : 'text-xs text-muted-foreground'}>{detalhe}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

const Vazio = ({ texto }: { texto: string }) => <p className="px-2 py-4 text-sm text-muted-foreground">{texto}</p>;

export function InicioAuditor() {
  const { usuario } = useAuthStore();
  const [carregando, setCarregando] = useState(true);
  const [emAndamento, setEmAndamento] = useState<Auditoria[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [tarefas, setTarefas] = useState<TarefaPlanoAcao[]>([]);

  useEffect(() => {
    Promise.allSettled([auditoriaService.listar(1, 50), agendaService.listar(1, 50, 'agendada'), planoAcaoService.listar(1, 50)])
      .then(([a, g, t]) => {
        if (a.status === 'fulfilled') setEmAndamento((a.value.items || []).filter((x) => x.status === 'em_andamento').slice(0, 3));
        if (g.status === 'fulfilled') setAgenda(g.value.items.filter((x) => x.dataPrevista.slice(0, 10) <= hoje()).slice(0, 5));
        if (t.status === 'fulfilled')
          setTarefas(
            t.value.items
              .filter((x) => (x.status === 'pendente' || x.status === 'em_andamento') && x.prazo.slice(0, 10) < hoje())
              .slice(0, 5),
          );
      })
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div className="space-y-4 px-4 py-4 lg:px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Olá, {usuario?.nome?.split(' ')[0] ?? 'auditor'}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <Button asChild size="lg" className="h-14 w-full text-base">
        <Link href="/admin/auditoria/nova">
          <Plus className="h-5 w-5" />
          Nova auditoria
        </Link>
      </Button>

      {carregando ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Bloco titulo="Continuar auditoria" icone={ClipboardCheck} href="/admin/auditorias">
            {emAndamento.length === 0 ? (
              <Vazio texto="Nenhuma auditoria em andamento." />
            ) : (
              emAndamento.map((a) => (
                <Linha key={a.id} href={`/admin/auditoria/${a.id}`} titulo={a.unidade?.nome ?? 'Unidade'} detalhe={`${a.template?.nome ?? ''} · iniciada em ${dataBr(a.dataInicio)}`} />
              ))
            )}
          </Bloco>
          <Bloco titulo="Hoje na agenda" icone={CalendarClock} href="/admin/agenda">
            {agenda.length === 0 ? (
              <Vazio texto="Nenhuma visita para hoje." />
            ) : (
              agenda.map((g) => {
                const atrasada = g.dataPrevista.slice(0, 10) < hoje();
                return (
                  <Linha key={g.id} href="/admin/auditoria/nova" titulo={g.unidade?.nome ?? 'Unidade'} detalhe={`${g.template?.nome ?? ''} · ${atrasada ? `atrasada desde ${dataBr(g.dataPrevista)}` : 'hoje'}`} destaque={atrasada} />
                );
              })
            )}
          </Bloco>
          <Bloco titulo="Tarefas atrasadas" icone={ListChecks} href="/admin/planos-acao">
            {tarefas.length === 0 ? (
              <Vazio texto="Nenhuma tarefa atrasada." />
            ) : (
              tarefas.map((t) => (
                <Linha key={t.id} href="/admin/planos-acao" titulo={t.titulo} detalhe={`Prazo ${dataBr(t.prazo)}`} destaque />
              ))
            )}
          </Bloco>
        </div>
      )}
    </div>
  );
}

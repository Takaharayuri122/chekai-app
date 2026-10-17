'use client';

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { dataLocalISO, formatarDataBr } from '@/lib/datas';
import { montarGradeMes } from '@/lib/agenda/calendario';
import type { AgendaItem } from '@/lib/services/agenda.service';
import { Button } from '@/components/ui/shadcn/button';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { StatusChip } from '@/components/ui/status-chip';

const DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const estaAtrasado = (a: AgendaItem) => a.status === 'agendada' && a.dataPrevista.slice(0, 10) < dataLocalISO();

const COR_CHIP: Record<string, string> = {
  agendada: 'bg-info/12 text-[hsl(217_80%_45%)]',
  realizada: 'bg-success/12 text-[hsl(160_84%_28%)]',
  cancelada: 'bg-muted text-muted-foreground line-through',
  atrasada: 'bg-destructive/12 text-[hsl(0_72%_45%)]',
};

const COR_PONTO: Record<string, string> = {
  agendada: 'bg-info',
  realizada: 'bg-success',
  cancelada: 'bg-muted-foreground/50',
  atrasada: 'bg-destructive',
};

const tom = (a: AgendaItem) => (estaAtrasado(a) ? 'atrasada' : a.status);

interface CalendarioAgendaProps {
  ano: number;
  mes: number;
  itens: AgendaItem[];
  carregando: boolean;
  podeAgendar: boolean;
  onMudarMes: (ano: number, mes: number) => void;
  onSelecionarItem: (item: AgendaItem) => void;
  onAgendarNoDia: (iso: string) => void;
}

export function CalendarioAgenda({ ano, mes, itens, carregando, podeAgendar, onMudarMes, onSelecionarItem, onAgendarNoDia }: CalendarioAgendaProps) {
  const semanas = useMemo(() => montarGradeMes(ano, mes, itens), [ano, mes, itens]);
  const [diaSelecionado, setDiaSelecionado] = useState<string>(dataLocalISO());
  const titulo = new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const doDia = semanas.flat().find((d) => d.iso === diaSelecionado);

  const mover = (delta: number) => {
    const alvo = new Date(ano, mes + delta, 1);
    onMudarMes(alvo.getFullYear(), alvo.getMonth());
  };

  const irParaHoje = () => {
    const hoje = new Date();
    setDiaSelecionado(dataLocalISO(hoje));
    onMudarMes(hoje.getFullYear(), hoje.getMonth());
  };

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <h2 className="font-display text-base font-semibold capitalize">{titulo}</h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => mover(-1)} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-10" onClick={irParaHoje}>
            Hoje
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => mover(1)} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {carregando ? (
        <div className="p-4">
          <Skeleton className="h-72 w-full" />
        </div>
      ) : (
        <>
          {/* Desktop: grade completa com chips */}
          <div className="hidden lg:block">
            <div className="grid grid-cols-7 border-b border-border text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {semanas.flat().map((dia) => (
                <div
                  key={dia.iso}
                  className={cn('group min-h-[112px] border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0', !dia.doMes && 'bg-muted/40')}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                        dia.hoje ? 'bg-primary font-semibold text-primary-foreground' : dia.doMes ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {dia.dia}
                    </span>
                    {podeAgendar && (
                      <button
                        type="button"
                        onClick={() => onAgendarNoDia(dia.iso)}
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus:opacity-100 group-hover:opacity-100"
                        aria-label={`Agendar em ${formatarDataBr(dia.iso)}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dia.itens.slice(0, 3).map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onSelecionarItem(a)}
                        className={cn('block w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium', COR_CHIP[tom(a)])}
                        title={`${a.unidade?.nome ?? ''} · ${a.template?.nome ?? ''}`}
                      >
                        {a.unidade?.nome ?? 'Unidade'}
                      </button>
                    ))}
                    {dia.itens.length > 3 && (
                      <button type="button" onClick={() => setDiaSelecionado(dia.iso)} className="px-1.5 text-xs font-medium text-primary">
                        +{dia.itens.length - 3}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mobile/tablet: mês compacto com pontos + lista do dia */}
          <div className="lg:hidden">
            <div className="grid grid-cols-7 px-2 pt-2 text-center text-[11px] font-medium text-muted-foreground">
              {DIAS_SEMANA.map((d) => (
                <div key={d} className="py-1">{d.slice(0, 1)}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1 px-2 pb-2">
              {semanas.flat().map((dia) => (
                <button
                  key={dia.iso}
                  type="button"
                  onClick={() => setDiaSelecionado(dia.iso)}
                  className={cn(
                    'flex h-12 flex-col items-center justify-center gap-1 rounded-md text-sm',
                    !dia.doMes && 'text-muted-foreground/60',
                    dia.iso === diaSelecionado && 'bg-primary/10 font-semibold text-primary',
                  )}
                  aria-label={`${formatarDataBr(dia.iso)}, ${dia.itens.length} agendamento(s)`}
                >
                  <span className={cn(dia.hoje && 'flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground')}>{dia.dia}</span>
                  <span className="flex h-1.5 gap-0.5">
                    {dia.itens.slice(0, 3).map((a) => (
                      <span key={a.id} className={cn('h-1.5 w-1.5 rounded-full', COR_PONTO[tom(a)])} />
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Lista do dia selecionado (sempre no mobile; no desktop quando escolhido pelo "+N") */}
          <div className={cn('border-t border-border p-3', 'lg:hidden', doDia && doDia.itens.length > 3 && 'lg:block')}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">{formatarDataBr(diaSelecionado)}</p>
              {podeAgendar && (
                <Button variant="ghost" size="sm" onClick={() => onAgendarNoDia(diaSelecionado)}>
                  <Plus className="h-4 w-4" />
                  Agendar
                </Button>
              )}
            </div>
            {!doDia || doDia.itens.length === 0 ? (
              <p className="py-3 text-sm text-muted-foreground">Nenhum agendamento neste dia.</p>
            ) : (
              <ul className="space-y-2">
                {doDia.itens.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => onSelecionarItem(a)}
                      className="flex min-h-[56px] w-full items-center gap-3 rounded-md border border-border p-3 text-left hover:bg-muted/50"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{a.unidade?.nome}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {a.template?.nome}
                          {a.responsavel?.nome && ` · ${a.responsavel.nome}`}
                        </span>
                      </span>
                      <StatusChip status={tom(a)} label={estaAtrasado(a) ? 'Atrasada' : undefined} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

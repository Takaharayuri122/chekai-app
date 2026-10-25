'use client';

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import type { LegislacaoOpcao } from '@/lib/api';
import { alternarSelecao, filtrarOpcoes } from '@/lib/legislacao/selecao';
import { useOpcoesLegislacao } from '@/lib/legislacao/use-opcoes-legislacao';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/shadcn/button';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/shadcn/command';

interface SeletorLegislacoesProps {
  valor: string[];
  onChange: (ids: string[]) => void;
  /** Texto de referência antigo, exibido quando ainda não há legislação vinculada. */
  referenciaAnterior?: string | null;
  desabilitado?: boolean;
}

export function SeletorLegislacoes({ valor, onChange, referenciaAnterior, desabilitado }: SeletorLegislacoesProps) {
  const { opcoes, carregando } = useOpcoesLegislacao();
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const porId = useMemo(() => new Map(opcoes.map((o) => [o.id, o])), [opcoes]);
  const filtradas = useMemo(() => filtrarOpcoes(opcoes, busca), [opcoes, busca]);
  const mostrarAnterior = valor.length === 0 && Boolean(referenciaAnterior?.trim());

  const fechar = (open: boolean) => {
    setAberto(open);
    if (!open) setBusca('');
  };

  return (
    <div className="space-y-2">
      {valor.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {valor.map((id) => {
            const opcao = porId.get(id);
            return (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-2.5 pr-1 text-xs font-medium text-foreground">
                <span>{opcao?.nome ?? 'Legislação'}</span>
                {!desabilitado && (
                  <Tooltip content="Remover">
                    <button
                      type="button"
                      aria-label={`Remover ${opcao?.nome ?? 'legislação'}`}
                      onClick={() => onChange(valor.filter((x) => x !== id))}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-background/60"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                )}
              </span>
            );
          })}
        </div>
      )}

      {!desabilitado && (
        <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" onClick={() => setAberto(true)}>
          <Plus className="h-4 w-4" />
          Adicionar legislação
        </Button>
      )}

      {mostrarAnterior && (
        <p className="text-xs text-muted-foreground">
          Referência anterior: {referenciaAnterior?.trim()} — escolha a legislação correspondente.
        </p>
      )}

      <ResponsiveDialog
        open={aberto}
        onOpenChange={fechar}
        title="Adicionar legislação"
        elevado
        footer={
          <Button type="button" className="h-11 min-w-[120px]" onClick={() => fechar(false)}>
            Concluir
          </Button>
        }
      >
        {!carregando && opcoes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma legislação cadastrada ainda.</p>
        ) : (
          <Command shouldFilter={false} className="rounded-lg border border-border">
            <CommandInput placeholder="Buscar por número ou título" value={busca} onValueChange={setBusca} />
            <CommandList className="max-h-none">
              <CommandEmpty>Nenhuma legislação encontrada.</CommandEmpty>
              {filtradas.map((o) => (
                <LinhaOpcao key={o.id} opcao={o} marcada={valor.includes(o.id)} onAlternar={() => onChange(alternarSelecao(valor, o.id))} />
              ))}
            </CommandList>
          </Command>
        )}
      </ResponsiveDialog>
    </div>
  );
}

function LinhaOpcao({ opcao, marcada, onAlternar }: { opcao: LegislacaoOpcao; marcada: boolean; onAlternar: () => void }) {
  return (
    <CommandItem value={opcao.id} onSelect={onAlternar} className="min-h-[44px] items-start gap-3 py-2">
      <Checkbox checked={marcada} tabIndex={-1} aria-hidden className="mt-0.5 pointer-events-none" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{opcao.nome}</span>
          {opcao.situacao === 'revogada' && (
            <span className="inline-flex items-center rounded-full border border-destructive/40 px-2 py-0.5 text-[11px] font-semibold text-destructive">
              Revogada
            </span>
          )}
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{opcao.titulo}</p>
      </div>
    </CommandItem>
  );
}

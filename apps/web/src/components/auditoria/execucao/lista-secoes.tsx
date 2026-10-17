'use client';

import { useState } from 'react';
import { Camera, ChevronDown, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/cn';
import { statusItem, type SecaoExecucao, type StatusItem } from '@/lib/auditoria/execucao';

const COR_STATUS: Record<StatusItem, string> = {
  pendente: 'border-2 border-muted-foreground/40 bg-transparent',
  conforme: 'bg-success',
  nao_conforme: 'bg-destructive',
  neutro: 'bg-muted-foreground/50',
  respondido: 'bg-info',
};

const ROTULO_STATUS: Record<StatusItem, string> = {
  pendente: 'Pendente',
  conforme: 'Conforme',
  nao_conforme: 'Não conforme',
  neutro: 'Não aplicável ou neutro',
  respondido: 'Respondido',
};

interface ListaSecoesProps {
  secoes: SecaoExecucao[];
  selecionadoId: string | null;
  destacados: Set<string>;
  onSelecionar: (id: string) => void;
}

export function ListaSecoes({ secoes, selecionadoId, destacados, onSelecionar }: ListaSecoesProps) {
  const [fechadas, setFechadas] = useState<Set<string>>(
    () => new Set(secoes.filter((s) => s.respondidos === s.itens.length && s.itens.length > 0).map((s) => s.id)),
  );
  // Numeração contínua entre seções, inclusive quando alguma está recolhida
  const inicios = secoes.reduce<number[]>((acc, secao, i) => {
    acc.push(i === 0 ? 0 : acc[i - 1] + secoes[i - 1].itens.length);
    return acc;
  }, []);

  const alternar = (id: string) =>
    setFechadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  return (
    <div className="space-y-3">
      {secoes.map((secao, indiceSecao) => {
        const aberta = !fechadas.has(secao.id);
        return (
          <section key={secao.id} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <button
              type="button"
              onClick={() => alternar(secao.id)}
              aria-expanded={aberta}
              className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 text-left"
            >
              <span className="font-semibold">{secao.nome}</span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                {secao.respondidos}/{secao.itens.length}
                <ChevronDown className={cn('h-4 w-4 transition-transform', aberta && 'rotate-180')} />
              </span>
            </button>
            {aberta && (
              <ul className="divide-y divide-border border-t border-border">
                {secao.itens.map((it, indiceItem) => {
                  const numero = inicios[indiceSecao] + indiceItem + 1;
                  const status = statusItem(it);
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => onSelecionar(it.id)}
                        className={cn(
                          'flex min-h-[52px] w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/60',
                          selecionadoId === it.id && 'bg-primary/5',
                          destacados.has(it.id) && 'bg-destructive/5',
                        )}
                      >
                        <span className={cn('mt-1 h-3 w-3 shrink-0 rounded-full', COR_STATUS[status])} title={ROTULO_STATUS[status]} />
                        <span className="w-6 shrink-0 text-xs text-muted-foreground">{numero}</span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm">
                            {it.templateItem.pergunta}
                            {it.templateItem.obrigatorio && <span className="text-destructive"> *</span>}
                          </span>
                          {destacados.has(it.id) && <span className="text-xs font-medium text-destructive">Obrigatória pendente</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                          {it.fotos?.length > 0 && (
                            <span className="flex items-center gap-0.5 text-xs">
                              <Camera className="h-3.5 w-3.5" />
                              {it.fotos.length}
                            </span>
                          )}
                          {it.observacao && <MessageSquare className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

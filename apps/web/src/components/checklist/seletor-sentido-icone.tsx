'use client';

import { Check } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import { ICONES_RESPOSTA } from '@/lib/checklist/icones';
import { classeDoSentido, type SentidoResposta } from '@/lib/checklist/sentido';
import { cn } from '@/lib/cn';
import {
  SENTIDOS,
  emojiDoIcone,
  escolherIcone,
  escolherSentido,
  iconeExibido,
  sentidoMarcado,
  type SentidoIcone,
} from './seletor-sentido-icone.logic';

interface SeletorSentidoIconeProps {
  /** Sentido gravado na resposta (null = o gestor ainda não escolheu). */
  sentido: SentidoResposta | null;
  icone: string | null;
  /** Sentido que a resposta teria sem escolha, marcado enquanto nada foi gravado. */
  sentidoDeduzido: SentidoResposta;
  onChange: (valor: SentidoIcone) => void;
  className?: string;
}

/** Sentido (positiva, neutra, negativa) e ícone de uma resposta do checklist. */
export function SeletorSentidoIcone({ sentido, icone, sentidoDeduzido, onChange, className }: SeletorSentidoIconeProps) {
  const marcado = sentidoMarcado(sentido, sentidoDeduzido);
  const atual: SentidoIcone = { sentido, icone };
  const iconeAtual = emojiDoIcone(icone);

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <div role="group" aria-label="Sentido da resposta" className="flex min-w-0 flex-1 gap-1">
        {SENTIDOS.map((s) => {
          const ativo = marcado === s.valor;
          return (
            <Tooltip key={s.valor} content={s.dica} className="flex-1">
              <button
                type="button"
                aria-pressed={ativo}
                onClick={() => onChange(escolherSentido(atual, s.valor))}
                className={cn(
                  'h-10 w-full rounded-md border px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  ativo ? classeDoSentido(s.valor) : classeDoSentido(null),
                )}
              >
                {s.rotulo}
              </button>
            </Tooltip>
          );
        })}
      </div>
      <DropdownMenu>
        <Tooltip content="Ícone mostrado no relatório">
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Escolher ícone da resposta"
              className="flex h-10 min-w-10 items-center justify-center rounded-md border border-border bg-card px-2 text-base hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {iconeExibido(icone, marcado)}
            </button>
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="end" className="z-[90] w-60 p-2">
          <div className="grid grid-cols-4 gap-1">
            {ICONES_RESPOSTA.map((i) => {
              const escolhido = iconeAtual === i.emoji;
              return (
                <Tooltip key={i.codigo} content={i.rotulo} className="w-full">
                  <button
                    type="button"
                    aria-label={i.rotulo}
                    aria-pressed={escolhido}
                    onClick={() => onChange(escolherIcone(atual, i.emoji))}
                    className={cn(
                      'flex h-10 w-full items-center justify-center rounded-md border text-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      escolhido ? 'border-primary bg-primary/10' : 'border-transparent',
                    )}
                  >
                    {i.emoji}
                  </button>
                </Tooltip>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onChange(escolherIcone(atual, null))}
            className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-border text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {!icone && <Check className="h-3.5 w-3.5" aria-hidden />}
            Sem ícone
          </button>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

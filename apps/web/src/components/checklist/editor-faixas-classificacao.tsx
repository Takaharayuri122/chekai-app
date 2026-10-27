'use client';

import { useState } from 'react';
import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tooltip } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import { ICONES_RESPOSTA } from '@/lib/checklist/icones';
import { segmentosDaBarra } from '@/lib/checklist/barra-faixas';
import type { FaixaClassificacao } from '@/lib/checklist/faixas';
import { cn } from '@/lib/cn';
import {
  NOME_MAX,
  PALETA_FAIXAS,
  adicionarFaixa,
  avaliarRascunho,
  rascunhoDeFaixas,
  removerFaixa,
  type RascunhoFaixa,
} from './editor-faixas-classificacao.logic';

interface EditorFaixasClassificacaoProps {
  /** Faixas gravadas no checklist (null = padrão do sistema). */
  valor: FaixaClassificacao[] | null;
  /** Chamado só com faixas válidas; null quando o gestor volta ao padrão. */
  onChange: (faixas: FaixaClassificacao[] | null) => void;
  /** Informa se o rascunho atual pode ser salvo. */
  onValidadeChange?: (valido: boolean) => void;
}

const CAMPO =
  'h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';
const ROTULO = 'text-xs font-medium text-muted-foreground';

export function EditorFaixasClassificacao({ valor, onChange, onValidadeChange }: EditorFaixasClassificacaoProps) {
  const [rascunho, setRascunho] = useState<RascunhoFaixa[]>(() => rascunhoDeFaixas(valor));
  const [removendo, setRemovendo] = useState<number | null>(null);

  const avaliacao = avaliarRascunho(rascunho);

  const aplicar = (novo: RascunhoFaixa[]) => {
    setRascunho(novo);
    const a = avaliarRascunho(novo);
    onValidadeChange?.(a.valido);
    if (a.valido && a.faixas) onChange(a.faixas);
  };

  const alterar = (i: number, parcial: Partial<RascunhoFaixa>) =>
    aplicar(rascunho.map((f, j) => (j === i ? { ...f, ...parcial } : f)));

  const voltarAoPadrao = () => {
    setRascunho(rascunhoDeFaixas(null));
    onValidadeChange?.(true);
    onChange(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-muted-foreground">
          As faixas definem como a nota final da auditoria é classificada no relatório. Cada nota deve cair em uma
          única faixa.
        </p>
        <button
          type="button"
          onClick={voltarAoPadrao}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Voltar ao padrão
        </button>
      </div>

      <div
        role="img"
        aria-label="Prévia das faixas de 0 a 100"
        className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
      >
        {avaliacao.valido &&
          avaliacao.faixas &&
          segmentosDaBarra(avaliacao.faixas).map((s, i) => (
            <div
              key={i}
              title={s.nome}
              className="absolute inset-y-0"
              style={{ backgroundColor: s.cor, left: `${s.inicio}%`, width: `${s.largura}%` }}
            />
          ))}
      </div>

      <ul className="space-y-3">
        {rascunho.map((f, i) => (
          <li key={i} className="rounded-lg border border-border bg-card p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,2fr)_auto_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
              <div className="flex flex-col gap-1">
                <label className="flex items-center justify-between">
                  <span className={ROTULO}>Nome</span>
                  <span className={ROTULO}>{f.nome.length}/{NOME_MAX}</span>
                </label>
                <input
                  type="text"
                  className={CAMPO}
                  value={f.nome}
                  maxLength={NOME_MAX}
                  onChange={(e) => alterar(i, { nome: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className={ROTULO}>Cor</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {PALETA_FAIXAS.map((cor) => (
                    <Tooltip key={cor} content={cor}>
                      <button
                        type="button"
                        aria-label={`Cor ${cor}`}
                        aria-pressed={f.cor.toUpperCase() === cor}
                        onClick={() => alterar(i, { cor })}
                        style={{ backgroundColor: cor }}
                        className={cn(
                          'h-7 w-7 rounded-full border-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          f.cor.toUpperCase() === cor ? 'border-foreground' : 'border-transparent',
                        )}
                      />
                    </Tooltip>
                  ))}
                  <input
                    type="text"
                    aria-label="Cor em #RRGGBB"
                    className={cn(CAMPO, 'w-28 font-mono uppercase')}
                    value={f.cor}
                    maxLength={7}
                    onChange={(e) => alterar(i, { cor: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:contents">
                <div className="flex flex-col gap-1">
                  <label className={ROTULO}>De</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={CAMPO}
                    value={f.de}
                    onChange={(e) => alterar(i, { de: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className={ROTULO}>Até</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={CAMPO}
                    value={f.ate}
                    onChange={(e) => alterar(i, { ate: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-end justify-between gap-2 sm:justify-end">
                <DropdownMenu>
                  <Tooltip content="Ícone da faixa no relatório">
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label="Escolher ícone da faixa"
                        className="flex h-10 min-w-10 items-center justify-center rounded-md border border-border bg-card px-2 text-base hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {f.emoji ?? <span className="text-xs text-muted-foreground">Ícone</span>}
                      </button>
                    </DropdownMenuTrigger>
                  </Tooltip>
                  <DropdownMenuContent align="end" className="z-[90] w-60 p-2">
                    <div className="grid grid-cols-4 gap-1">
                      {ICONES_RESPOSTA.map((ic) => (
                        <Tooltip key={ic.codigo} content={ic.rotulo} className="w-full">
                          <button
                            type="button"
                            aria-label={ic.rotulo}
                            aria-pressed={f.emoji === ic.emoji}
                            onClick={() => alterar(i, { emoji: ic.emoji })}
                            className={cn(
                              'flex h-10 w-full items-center justify-center rounded-md border text-lg hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              f.emoji === ic.emoji ? 'border-primary bg-primary/10' : 'border-transparent',
                            )}
                          >
                            {ic.emoji}
                          </button>
                        </Tooltip>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => alterar(i, { emoji: null })}
                      className="mt-2 flex h-10 w-full items-center justify-center rounded-md border border-border text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Sem ícone
                    </button>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Tooltip content="Remover faixa">
                  <button
                    type="button"
                    aria-label="Remover faixa"
                    onClick={() => setRemovendo(i)}
                    className="flex h-10 w-10 items-center justify-center rounded-md border border-border text-destructive hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </Tooltip>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => aplicar(adicionarFaixa(rascunho))}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Nova faixa
      </button>

      {avaliacao.erros.length > 0 && (
        <ul role="alert" className="space-y-1 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {avaliacao.erros.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {avaliacao.lacunas.length > 0 && (
        <ul className="space-y-1 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
          {avaliacao.lacunas.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={removendo !== null}
        onClose={() => setRemovendo(null)}
        onConfirm={() => {
          if (removendo !== null) aplicar(removerFaixa(rascunho, removendo));
          setRemovendo(null);
        }}
        title="Remover faixa"
        message="Tem certeza que deseja remover esta faixa de classificação?"
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="danger"
      />
    </div>
  );
}

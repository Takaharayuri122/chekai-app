'use client';

import { AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { AuditoriaItem } from '@/lib/api';
import { Button } from '@/components/ui/shadcn/button';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';

interface RevisaoFinalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendentes: AuditoriaItem[];
  naoConformes: AuditoriaItem[];
  observacoes: string;
  onObservacoes: (valor: string) => void;
  erro: string;
  finalizando: boolean;
  onIrParaItem: (id: string) => void;
  onFinalizar: () => void;
}

export function RevisaoFinal({ open, onOpenChange, pendentes, naoConformes, observacoes, onObservacoes, erro, finalizando, onIrParaItem, onFinalizar }: RevisaoFinalProps) {
  const bloqueado = pendentes.length > 0;
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Revisar e finalizar"
      description="Confira as pendências antes de encerrar a auditoria."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button onClick={onFinalizar} disabled={bloqueado || finalizando}>
            {finalizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Finalizar auditoria
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {bloqueado ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertCircle className="h-4 w-4" />
              {pendentes.length} pergunta(s) obrigatória(s) sem resposta
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {pendentes.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onIrParaItem(p.id)} className="min-h-[48px] w-full px-3 py-2 text-left text-sm hover:bg-muted">
                    {p.templateItem.pergunta}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm font-medium text-[hsl(160_84%_28%)]">
            <CheckCircle2 className="h-4 w-4" />
            Todas as perguntas obrigatórias foram respondidas.
          </p>
        )}

        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <XCircle className="h-4 w-4 text-destructive" />
            {naoConformes.length} não conformidade(s)
          </p>
          {naoConformes.length > 0 && (
            <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {naoConformes.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => onIrParaItem(n.id)} className="min-h-[44px] w-full px-3 py-2 text-left text-sm hover:bg-muted">
                    {n.templateItem.pergunta}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="observacoes-gerais" className="text-sm font-medium">
            Observações gerais (opcional)
          </label>
          <Textarea id="observacoes-gerais" rows={4} value={observacoes} onChange={(e) => onObservacoes(e.target.value)} placeholder="Observações gerais…" />
        </div>

        {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
      </div>
    </ResponsiveDialog>
  );
}

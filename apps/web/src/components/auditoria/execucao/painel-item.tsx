'use client';

import { Camera, ChevronLeft, ChevronRight, MessageSquare, Sparkles } from 'lucide-react';
import type { AuditoriaItem } from '@/lib/api';
import { Button } from '@/components/ui/shadcn/button';

interface PainelItemProps {
  item: AuditoriaItem;
  numero: number;
  total: number;
  anterior: AuditoriaItem | null;
  proximo: AuditoriaItem | null;
  somenteLeitura: boolean;
  respostas: React.ReactNode;
  onNavegar: (id: string) => void;
  onDocumentar: () => void;
}

export function PainelItem({ item, numero, total, anterior, proximo, somenteLeitura, respostas, onNavegar, onDocumentar }: PainelItemProps) {
  const t = item.templateItem;
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Pergunta {numero} de {total}
            {t.obrigatorio && <span className="text-destructive"> · obrigatória</span>}
          </p>
          <h2 className="font-display text-lg font-semibold leading-snug">{t.pergunta}</h2>
          {t.legislacaoReferencia && <p className="text-xs text-info">{t.legislacaoReferencia}</p>}
        </div>

        {respostas}

        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={onDocumentar}
            className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left hover:bg-muted/60"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Camera className="h-4 w-4 text-primary" />
              {somenteLeitura ? 'Ver fotos e observação' : 'Fotos e observação'}
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {item.fotos?.length > 0 && `${item.fotos.length} foto(s)`}
              {item.observacao && <MessageSquare className="h-3.5 w-3.5" />}
              {item.descricaoIa && <Sparkles className="h-3.5 w-3.5 text-primary" />}
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
          {(item.observacao || item.descricaoIa) && (
            <details className="border-t border-border px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-muted-foreground">Detalhes registrados</summary>
              <div className="mt-2 space-y-2">
                {item.descricaoIa && (
                  <p>
                    <span className="font-medium">Análise da imagem: </span>
                    {item.descricaoIa}
                  </p>
                )}
                {item.observacao && (
                  <p>
                    <span className="font-medium">Observação: </span>
                    {item.observacao}
                  </p>
                )}
                {item.referenciaLegal && <p className="text-info">{item.referenciaLegal}</p>}
              </div>
            </details>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
        <Button variant="outline" className="h-11 flex-1" disabled={!anterior} onClick={() => anterior && onNavegar(anterior.id)}>
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <Button className="h-11 flex-1" disabled={!proximo} onClick={() => proximo && onNavegar(proximo.id)}>
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

'use client';

import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';

interface BarraSelecaoProps {
  quantidade: number;
  onLimpar: () => void;
  onConfigurar: () => void;
}

/** Barra fixa (sticky) no rodapé do editor, acima da navegação inferior no mobile com a contagem de perguntas selecionadas e a ação em lote. */
export function BarraSelecao({ quantidade, onLimpar, onConfigurar }: BarraSelecaoProps) {
  if (quantidade <= 0) return null;

  return (
    <div className="sticky bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-30 rounded-lg border border-border bg-card px-4 py-3 shadow-lg md:bottom-4">
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm font-medium text-foreground" aria-live="polite">
          {quantidade === 1 ? '1 pergunta selecionada' : `${quantidade} perguntas selecionadas`}
        </p>
        <Button variant="ghost" onClick={onLimpar}>
          Limpar
        </Button>
        <Button onClick={onConfigurar}>
          <Settings2 className="h-4 w-4" />
          Configurar em lote
        </Button>
      </div>
    </div>
  );
}

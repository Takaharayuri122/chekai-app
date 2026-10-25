'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { MINIMO_CARACTERES_TEXTO } from '@/lib/legislacao/leitura';

interface ModalColarTextoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnviar: (texto: string) => Promise<void>;
}

/** Texto da legislação colado à mão, usado quando o sistema não consegue ler o link. */
export function ModalColarTexto({ open, onOpenChange, onEnviar }: ModalColarTextoProps) {
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (open) setTexto('');
  }, [open]);

  const tamanho = texto.trim().length;
  const valido = tamanho >= MINIMO_CARACTERES_TEXTO;

  const enviar = async () => {
    if (!valido) return;
    setEnviando(true);
    try {
      await onEnviar(texto.trim());
      onOpenChange(false);
    } catch {
      // erro já exibido pelo interceptor
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(valor) => !enviando && onOpenChange(valor)}
      title="Colar texto"
      description="Cole o texto completo da legislação. O sistema preenche os dados a partir dele."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={!valido || enviando}>
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={12}
          placeholder="Cole aqui o texto da legislação"
          aria-label="Texto da legislação"
        />
        <p className={`text-xs ${valido ? 'text-muted-foreground' : 'text-warning'}`}>
          {tamanho} de no mínimo {MINIMO_CARACTERES_TEXTO} caracteres
        </p>
      </div>
    </ResponsiveDialog>
  );
}

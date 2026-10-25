'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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
  const [interagiu, setInteragiu] = useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);

  useEffect(() => {
    if (open) {
      setTexto('');
      setInteragiu(false);
      setConfirmarDescarte(false);
    }
  }, [open]);

  const tamanho = texto.trim().length;
  const isDirty = tamanho > 0;
  const valido = tamanho >= MINIMO_CARACTERES_TEXTO;

  /** Pede confirmação ao descartar só depois de o usuário ter digitado algo. */
  const solicitarFechamento = () => {
    if (enviando) return;
    if (isDirty && interagiu) {
      setConfirmarDescarte(true);
      return;
    }
    onOpenChange(false);
  };

  const enviar = async () => {
    if (!valido) return;
    setEnviando(true);
    try {
      await onEnviar(texto.trim());
      onOpenChange(false);
    } catch {
      // o erro já foi mostrado pela página; o modal continua aberto
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
    <ResponsiveDialog
      open={open}
      onOpenChange={(valor) => (valor ? onOpenChange(true) : solicitarFechamento())}
      title="Colar texto"
      description="Cole o texto completo da legislação. O sistema preenche os dados a partir dele."
      footer={
        <>
          <Button variant="ghost" onClick={solicitarFechamento} disabled={enviando}>
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
          onChange={(e) => {
            setTexto(e.target.value);
            setInteragiu(true);
          }}
          rows={12}
          placeholder="Cole aqui o texto da legislação"
          aria-label="Texto da legislação"
        />
        <p className={`text-xs ${valido ? 'text-muted-foreground' : 'text-warning'}`}>
          {tamanho} de no mínimo {MINIMO_CARACTERES_TEXTO} caracteres
        </p>
      </div>
    </ResponsiveDialog>
    <ConfirmDialog
      open={confirmarDescarte}
      onClose={() => setConfirmarDescarte(false)}
      onConfirm={() => {
        setConfirmarDescarte(false);
        onOpenChange(false);
      }}
      title="Descartar alterações?"
      message="O texto colado será perdido."
      confirmLabel="Descartar"
      variant="warning"
    />
    </>
  );
}

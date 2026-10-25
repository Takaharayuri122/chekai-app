'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';
import { Button } from '@/components/ui/shadcn/button';
import { TAMANHO_MAXIMO_PDF } from '@/lib/legislacao/leitura';

interface ModalEnviarPdfProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnviar: (arquivo: File) => Promise<void>;
}

/** Envio do PDF da legislação, usado quando o sistema não consegue ler o link. */
export function ModalEnviarPdf({ open, onOpenChange, onEnviar }: ModalEnviarPdfProps) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setArquivo(null);
      setErro(null);
    }
  }, [open]);

  const escolher = (e: React.ChangeEvent<HTMLInputElement>) => {
    const escolhido = e.target.files?.[0] ?? null;
    setErro(null);
    setArquivo(null);
    if (!escolhido) return;
    const ehPdf = escolhido.type === 'application/pdf' || escolhido.name.toLowerCase().endsWith('.pdf');
    if (!ehPdf) {
      setErro('Escolha um arquivo em PDF.');
      return;
    }
    if (escolhido.size > TAMANHO_MAXIMO_PDF) {
      setErro('O PDF deve ter no máximo 20 MB.');
      return;
    }
    setArquivo(escolhido);
  };

  const enviar = async () => {
    if (!arquivo) return;
    setEnviando(true);
    try {
      await onEnviar(arquivo);
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
      title="Enviar PDF"
      description="Escolha o PDF da legislação. O sistema lê o texto e preenche os dados."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={!arquivo || enviando}>
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
            Enviar
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          onChange={escolher}
          className="block w-full text-sm file:mr-3 file:min-h-[40px] file:rounded-md file:border-0 file:bg-muted file:px-4 file:text-sm file:font-medium"
        />
        <p className="text-xs text-muted-foreground">Somente PDF, com até 20 MB.</p>
        {arquivo && <p className="text-sm">{arquivo.name}</p>}
        {erro && <p className="text-sm text-destructive">{erro}</p>}
      </div>
    </ResponsiveDialog>
  );
}

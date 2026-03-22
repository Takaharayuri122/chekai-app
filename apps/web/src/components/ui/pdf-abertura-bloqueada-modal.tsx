'use client';

import { useEffect, useRef, type ReactElement } from 'react';
import { FormModal } from './form-modal';
import { Download } from 'lucide-react';
import { executarDownloadBlob } from '@/lib/pdf-abertura';

export interface PdfAberturaBloqueadaModalProps {
  open: boolean;
  blobUrl: string;
  nomeArquivo: string;
  onClose: () => void;
}

/**
 * Exibido quando window.open(blob) foi bloqueado: orienta o usuário e oferece download manual.
 */
export function PdfAberturaBloqueadaModal({
  open,
  blobUrl,
  nomeArquivo,
  onClose,
}: PdfAberturaBloqueadaModalProps): ReactElement {
  const baixouRef = useRef(false);

  useEffect(() => {
    if (open) {
      baixouRef.current = false;
    }
  }, [open]);

  const finalizarFechar = (): void => {
    if (!baixouRef.current && blobUrl) {
      URL.revokeObjectURL(blobUrl);
    }
    baixouRef.current = false;
    onClose();
  };

  const handleBaixar = (): void => {
    if (!blobUrl) {
      return;
    }
    executarDownloadBlob(blobUrl, nomeArquivo);
    baixouRef.current = true;
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={finalizarFechar}
      title="O PDF não abriu automaticamente"
      maxWidth="md"
      closeOnBackdrop
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={finalizarFechar}>
            Fechar
          </button>
          <button type="button" className="btn btn-primary btn-sm gap-2" onClick={handleBaixar}>
            <Download className="h-4 w-4" />
            Baixar PDF
          </button>
        </div>
      )}
    >
      <div className="space-y-3 text-sm text-base-content/90">
        <p>
          O navegador pode ter bloqueado a nova aba com o relatório — isso é comum na primeira vez ou
          quando os pop-ups estão desativados para este site.
        </p>
        <p className="font-medium text-base-content">Como permitir a abertura automática</p>
        <ul className="list-inside list-disc space-y-1 text-base-content/80">
          <li>
            Procure o ícone de bloqueio ou de janela na barra de endereços e escolha permitir pop-ups
            para este site.
          </li>
          <li>
            Depois, gere o PDF novamente pelo botão &quot;Exportar PDF&quot; ou &quot;Baixar PDF&quot;.
          </li>
        </ul>
        <p>
          Enquanto isso, você pode salvar o arquivo agora usando o botão <strong>Baixar PDF</strong> abaixo.
        </p>
      </div>
    </FormModal>
  );
}

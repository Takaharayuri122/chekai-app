'use client';

import { useEffect, useMemo, useState } from 'react';
import { FormModal } from '@/components';
import { CheckinRegistro } from '@/lib/services/checkin.service';

interface CheckinEditarModalProps {
  open: boolean;
  checkin: CheckinRegistro | null;
  salvando: boolean;
  onClose: () => void;
  onSalvar: (dados: {
    dataCheckin: string;
    dataCheckout: string | null;
    comentario: string;
  }) => Promise<void>;
}

function isoParaDatetimeLocal(iso?: string | null): string {
  if (!iso) return '';
  const data = new Date(iso);
  const pad = (valor: number) => String(valor).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

function datetimeLocalParaIso(valor: string): string {
  return new Date(valor).toISOString();
}

export function CheckinEditarModal({
  open,
  checkin,
  salvando,
  onClose,
  onSalvar,
}: CheckinEditarModalProps) {
  const [dataCheckin, setDataCheckin] = useState('');
  const [dataCheckout, setDataCheckout] = useState('');
  const [comentario, setComentario] = useState('');

  useEffect(() => {
    if (!open || !checkin) {
      return;
    }
    setDataCheckin(isoParaDatetimeLocal(checkin.dataCheckin));
    setDataCheckout(isoParaDatetimeLocal(checkin.dataCheckout));
    setComentario(checkin.comentario ?? '');
  }, [open, checkin]);

  const isDirty = useMemo(() => {
    if (!checkin) return false;
    return (
      dataCheckin !== isoParaDatetimeLocal(checkin.dataCheckin)
      || dataCheckout !== isoParaDatetimeLocal(checkin.dataCheckout)
      || comentario !== (checkin.comentario ?? '')
    );
  }, [checkin, comentario, dataCheckin, dataCheckout]);

  const handleSalvar = async (): Promise<void> => {
    if (!dataCheckin) {
      return;
    }
    await onSalvar({
      dataCheckin: datetimeLocalParaIso(dataCheckin),
      dataCheckout: dataCheckout ? datetimeLocalParaIso(dataCheckout) : null,
      comentario,
    });
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="Editar check-in"
      maxWidth="lg"
      isDirty={isDirty}
      footer={(
        <>
          <button type="button" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 hover:bg-muted" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => { void handleSalvar(); }}
            disabled={salvando || !dataCheckin}
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <label className="flex flex-col w-full">
          <span className="text-sm font-medium text-foreground">Início</span>
          <input
            type="datetime-local"
            className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3 w-full"
            value={dataCheckin}
            onChange={(evento) => setDataCheckin(evento.target.value)}
          />
        </label>
        <label className="flex flex-col w-full">
          <span className="text-sm font-medium text-foreground">Fim</span>
          <input
            type="datetime-local"
            className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3 w-full"
            value={dataCheckout}
            onChange={(evento) => setDataCheckout(evento.target.value)}
          />
          <span className="text-xs text-muted-foreground">
            Preencha para encerrar um check-in aberto. Não é possível reabrir um check-in fechado.
          </span>
        </label>
        <label className="flex flex-col w-full">
          <span className="text-sm font-medium text-foreground">Comentário</span>
          <textarea
            className="px-3 py-2 rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 min-h-24"
            value={comentario}
            onChange={(evento) => setComentario(evento.target.value)}
            maxLength={2000}
          />
        </label>
      </div>
    </FormModal>
  );
}

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
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={salvando}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { void handleSalvar(); }}
            disabled={salvando || !dataCheckin}
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </>
      )}
    >
      <div className="space-y-4">
        <label className="form-control w-full">
          <span className="label-text">Início</span>
          <input
            type="datetime-local"
            className="input input-bordered w-full"
            value={dataCheckin}
            onChange={(evento) => setDataCheckin(evento.target.value)}
          />
        </label>
        <label className="form-control w-full">
          <span className="label-text">Fim</span>
          <input
            type="datetime-local"
            className="input input-bordered w-full"
            value={dataCheckout}
            onChange={(evento) => setDataCheckout(evento.target.value)}
          />
          <span className="label-text-alt text-base-content/50">
            Preencha para encerrar um check-in aberto. Não é possível reabrir um check-in fechado.
          </span>
        </label>
        <label className="form-control w-full">
          <span className="label-text">Comentário</span>
          <textarea
            className="textarea textarea-bordered min-h-24"
            value={comentario}
            onChange={(evento) => setComentario(evento.target.value)}
            maxLength={2000}
          />
        </label>
      </div>
    </FormModal>
  );
}

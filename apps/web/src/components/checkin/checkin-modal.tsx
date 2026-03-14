'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, MapPin, Navigation } from 'lucide-react';
import { clienteService, Cliente } from '@/lib/api';
import { useGeolocalizacao } from '@/hooks/use-geolocalizacao';
import { toastService } from '@/lib/toast';
import { FormModal } from '@/components/ui/form-modal';

interface PayloadIniciarCheckin {
  clienteId: string;
  unidadeId: string;
  latitude: number;
  longitude: number;
}

interface CheckinModalProps {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: (payload: PayloadIniciarCheckin) => Promise<void>;
}

export function CheckinModal({
  open,
  loading,
  onClose,
  onConfirm,
}: CheckinModalProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregandoClientes, setCarregandoClientes] = useState<boolean>(false);
  const [clienteId, setClienteId] = useState<string>('');
  const [unidadeId, setUnidadeId] = useState<string>('');
  const {
    coordenadas,
    erro,
    carregando,
    capturarLocalizacao,
    limpar,
  } = useGeolocalizacao();

  const clienteSelecionado = useMemo(
    () => clientes.find((cliente) => cliente.id === clienteId) ?? null,
    [clientes, clienteId],
  );
  const unidades = clienteSelecionado?.unidades ?? [];
  const isDirty = Boolean(clienteId || unidadeId || coordenadas);

  useEffect(() => {
    if (!open) return;
    const carregarClientes = async (): Promise<void> => {
      setCarregandoClientes(true);
      try {
        const resultado = await clienteService.listar();
        setClientes(resultado.items ?? []);
      } finally {
        setCarregandoClientes(false);
      }
    };
    carregarClientes();
  }, [open]);

  useEffect(() => {
    setUnidadeId('');
  }, [clienteId]);

  const handleClose = (): void => {
    setClienteId('');
    setUnidadeId('');
    setClientes([]);
    limpar();
    onClose();
  };

  const handleConfirmar = async (): Promise<void> => {
    if (!clienteId || !unidadeId) {
      toastService.warning('Selecione cliente e unidade para iniciar o checkin.');
      return;
    }
    if (!coordenadas) {
      toastService.warning('A geolocalização é obrigatória para iniciar o checkin.');
      return;
    }
    await onConfirm({
      clienteId,
      unidadeId,
      latitude: coordenadas.latitude,
      longitude: coordenadas.longitude,
    });
    handleClose();
  };

  const footerContent = (
    <>
      <button className="btn btn-ghost flex-1" onClick={handleClose} disabled={loading}>
        Cancelar
      </button>
      <button className="btn btn-primary flex-1" onClick={handleConfirmar} disabled={loading || carregando}>
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Salvando...
          </>
        ) : (
          'Confirmar CheckIN'
        )}
      </button>
    </>
  );

  return (
    <FormModal
      open={open}
      onClose={handleClose}
      title="Iniciar CheckIN"
      maxWidth="lg"
      isDirty={isDirty}
      footer={footerContent}
    >
      <p className="text-sm text-base-content/70 mb-4">
        Selecione cliente, unidade e capture sua localização atual.
      </p>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="label">
            <span className="label-text font-medium">Cliente</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={clienteId}
            onChange={(event) => setClienteId(event.target.value)}
            disabled={carregandoClientes || loading}
          >
            <option value="">Selecione um cliente</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nomeFantasia || cliente.razaoSocial}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="label">
            <span className="label-text font-medium">Unidade</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={unidadeId}
            onChange={(event) => setUnidadeId(event.target.value)}
            disabled={!clienteId || loading}
          >
            <option value="">Selecione uma unidade</option>
            {unidades.map((unidade) => (
              <option key={unidade.id} value={unidade.id}>
                {unidade.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="rounded-xl border border-base-300 bg-base-200/70 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Navigation className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Geolocalização</p>
                <p className="text-xs text-base-content/70">
                  {coordenadas
                    ? `Lat: ${coordenadas.latitude.toFixed(5)} | Lng: ${coordenadas.longitude.toFixed(5)}`
                    : 'Ainda não capturada'}
                </p>
              </div>
            </div>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                void capturarLocalizacao();
              }}
              disabled={carregando || loading}
            >
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              {coordenadas ? 'Atualizar' : 'Capturar'}
            </button>
          </div>
          {erro && <p className="mt-2 text-xs text-error">{erro}</p>}
        </div>
        {carregandoClientes && (
          <div className="flex items-center gap-2 text-sm text-base-content/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando clientes...
          </div>
        )}
        {!carregandoClientes && clientes.length === 0 && (
          <div className="alert alert-warning">
            <Building2 className="h-4 w-4" />
            <span>Nenhum cliente disponível para checkin.</span>
          </div>
        )}
      </div>
    </FormModal>
  );
}

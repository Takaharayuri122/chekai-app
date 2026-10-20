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
      <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 hover:bg-muted flex-1" onClick={handleClose} disabled={loading}>
        Cancelar
      </button>
      <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 flex-1" onClick={handleConfirmar} disabled={loading || carregando}>
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
      <p className="text-sm text-muted-foreground mb-4">
        Selecione cliente, unidade e capture sua localização atual.
      </p>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="flex items-center justify-between gap-2 py-1">
            <span className="text-sm font-medium text-foreground">Cliente</span>
          </label>
          <select
            className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3 w-full"
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
          <label className="flex items-center justify-between gap-2 py-1">
            <span className="text-sm font-medium text-foreground">Unidade</span>
          </label>
          <select
            className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3 w-full"
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
        <div className="rounded-xl border border-border bg-muted/70 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <Navigation className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">Geolocalização</p>
                <p className="text-xs text-muted-foreground">
                  {coordenadas
                    ? `Lat: ${coordenadas.latitude.toFixed(5)} | Lng: ${coordenadas.longitude.toFixed(5)}`
                    : 'Ainda não capturada'}
                </p>
              </div>
            </div>
            <button
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 hover:bg-muted"
              onClick={() => {
                void capturarLocalizacao();
              }}
              disabled={carregando || loading}
            >
              {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              {coordenadas ? 'Atualizar' : 'Capturar'}
            </button>
          </div>
          {erro && <p className="mt-2 text-xs text-destructive">{erro}</p>}
        </div>
        {carregandoClientes && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando clientes...
          </div>
        )}
        {!carregandoClientes && clientes.length === 0 && (
          <div className="flex w-full items-start gap-3 rounded-md border p-4 text-sm border-warning/40 bg-warning/15">
            <Building2 className="h-4 w-4" />
            <span>Nenhum cliente disponível para checkin.</span>
          </div>
        )}
      </div>
    </FormModal>
  );
}

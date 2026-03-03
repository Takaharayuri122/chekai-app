'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Building2, CheckCircle2, Loader2, MapPin } from 'lucide-react';
import { AppLayout, PageHeader } from '@/components';
import {
  clienteService,
  type Cliente,
  relatorioTecnicoService,
} from '@/lib/api';
import { toastService } from '@/lib/toast';

export default function NovoRelatorioTecnicoPage() {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [loadingClientes, setLoadingClientes] = useState<boolean>(true);
  const [iniciandoRelatorio, setIniciandoRelatorio] = useState<boolean>(false);
  const [erro, setErro] = useState<string>('');
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<string>('');
  const [unidadeSelecionadaId, setUnidadeSelecionadaId] = useState<string>('');

  useEffect(() => {
    async function carregarClientes(): Promise<void> {
      try {
        const response = await clienteService.listar(1, 200);
        setClientes(response.items || []);
      } finally {
        setLoadingClientes(false);
      }
    }
    void carregarClientes();
  }, []);

  const clienteSelecionado: Cliente | undefined = useMemo(
    () => clientes.find((cliente) => cliente.id === clienteSelecionadoId),
    [clienteSelecionadoId, clientes],
  );

  const unidadeSelecionada = useMemo(
    () => clienteSelecionado?.unidades.find((unidade) => unidade.id === unidadeSelecionadaId),
    [clienteSelecionado, unidadeSelecionadaId],
  );

  const handleIniciarRelatorio = async (): Promise<void> => {
    if (!clienteSelecionadoId || !unidadeSelecionadaId) {
      setErro('Selecione cliente e unidade para continuar.');
      return;
    }
    setErro('');
    setIniciandoRelatorio(true);
    try {
      const relatorio = await relatorioTecnicoService.iniciar({
        clienteId: clienteSelecionadoId,
        unidadeId: unidadeSelecionadaId,
      });
      toastService.success('Relatório técnico iniciado com sucesso!');
      router.push(`/admin/relatorios-tecnicos/${relatorio.id}`);
    } catch {
      // Erro tratado no interceptor
    } finally {
      setIniciandoRelatorio(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Novo Relatório Técnico"
        subtitle="Selecione cliente e unidade para iniciar"
        backHref="/admin/relatorios-tecnicos"
      />
      <div className="px-4 py-4 lg:px-8 space-y-4">
        <ul className="steps steps-horizontal w-full">
          <li className={`step ${step >= 1 ? 'step-primary' : ''}`}>Cliente</li>
          <li className={`step ${step >= 2 ? 'step-primary' : ''}`}>Unidade</li>
          <li className={`step ${step >= 3 ? 'step-primary' : ''}`}>Confirmar</li>
        </ul>
        {erro ? (
          <div className="alert alert-error">
            <AlertCircle className="w-4 h-4" />
            <span>{erro}</span>
          </div>
        ) : null}
        {loadingClientes ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          </div>
        ) : null}
        {!loadingClientes && step === 1 ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Selecione o cliente</h2>
            {clientes.length === 0 ? (
              <div className="card bg-base-100 shadow-sm border border-base-300">
                <div className="card-body items-center text-center py-8">
                  <Building2 className="w-12 h-12 text-base-content/30 mb-2" />
                  <p className="text-base-content/60">Nenhum cliente cadastrado</p>
                </div>
              </div>
            ) : (
              clientes.map((cliente) => (
                <button
                  key={cliente.id}
                  type="button"
                  onClick={() => {
                    setClienteSelecionadoId(cliente.id);
                    setUnidadeSelecionadaId('');
                    setStep(2);
                  }}
                  className="card bg-base-100 shadow-sm border border-base-300 hover:border-primary transition-colors w-full text-left"
                >
                  <div className="card-body p-4 flex-row items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{cliente.nomeFantasia || cliente.razaoSocial}</p>
                      <p className="text-sm text-base-content/60">{cliente.unidades?.length || 0} unidade(s)</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        ) : null}
        {!loadingClientes && step === 2 && clienteSelecionado ? (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">
              Selecione a unidade de {clienteSelecionado.nomeFantasia || clienteSelecionado.razaoSocial}
            </h2>
            {clienteSelecionado.unidades.length === 0 ? (
              <div className="card bg-base-100 shadow-sm border border-base-300">
                <div className="card-body items-center text-center py-8">
                  <MapPin className="w-12 h-12 text-base-content/30 mb-2" />
                  <p className="text-base-content/60">Este cliente não possui unidade cadastrada</p>
                </div>
              </div>
            ) : (
              clienteSelecionado.unidades.map((unidade) => (
                <button
                  key={unidade.id}
                  type="button"
                  onClick={() => {
                    setUnidadeSelecionadaId(unidade.id);
                    setStep(3);
                  }}
                  className="card bg-base-100 shadow-sm border border-base-300 hover:border-primary transition-colors w-full text-left"
                >
                  <div className="card-body p-4 flex-row items-center gap-4">
                    <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-secondary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{unidade.nome}</p>
                      <p className="text-sm text-base-content/60">
                        {unidade.cidade}, {unidade.estado}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
              Voltar
            </button>
          </div>
        ) : null}
        {!loadingClientes && step === 3 ? (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Confirme os dados para iniciar</h2>
            <div className="card bg-base-100 shadow-sm border border-base-300">
              <div className="card-body p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-sm text-base-content/60">Cliente</p>
                    <p className="font-medium">{clienteSelecionado?.nomeFantasia || clienteSelecionado?.razaoSocial}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-secondary" />
                  <div>
                    <p className="text-sm text-base-content/60">Unidade</p>
                    <p className="font-medium">{unidadeSelecionada?.nome || '-'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <p className="text-sm">O relatório será pré-criado para liberar anexos imediatamente.</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" className="btn btn-ghost flex-1" onClick={() => setStep(2)}>
                Voltar
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1"
                onClick={handleIniciarRelatorio}
                disabled={iniciandoRelatorio || !clienteSelecionadoId || !unidadeSelecionadaId}
              >
                {iniciandoRelatorio ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Iniciando...
                  </>
                ) : (
                  'Iniciar Relatório Técnico'
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}

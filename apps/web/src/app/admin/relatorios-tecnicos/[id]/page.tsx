'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle2, Download, Loader2, Save } from 'lucide-react';
import { AppLayout, ConfirmDialog, PageHeader, PageLoadingOverlay, PdfAberturaBloqueadaModal } from '@/components';
import {
  relatorioTecnicoService,
  type CriarRelatorioTecnicoRequest,
} from '@/lib/api';
import { toastService } from '@/lib/toast';
import {
  RelatorioTecnicoForm,
  type RelatorioTecnicoFormData,
} from '@/components/relatorio-tecnico/relatorio-tecnico-form';
import { useAuthStore } from '@/lib/store';

function mapearParaFormulario(data: any): RelatorioTecnicoFormData {
  return {
    clienteId: data.clienteId || '',
    unidadeId: data.unidadeId || '',
    identificacao: data.identificacao || '',
    descricaoOcorrenciaHtml: data.descricaoOcorrenciaHtml || '',
    avaliacaoTecnicaHtml: data.avaliacaoTecnicaHtml || '',
    acoesExecutadas: data.acoesExecutadas || [],
    recomendacoesConsultoraHtml: data.recomendacoesConsultoraHtml || '',
    planoAcaoSugeridoHtml: data.planoAcaoSugeridoHtml || '',
    assinaturaNomeConsultora: data.assinaturaNomeConsultora || '',
    responsavel: data.responsavel || '',
    status: data.status || 'rascunho',
    apoioAnaliticoChekAi: data.apoioAnaliticoChekAi || '',
    fotos: data.fotos || [],
  };
}

export default function RelatorioTecnicoDetalhePage() {
  const params = useParams();
  const { usuario } = useAuthStore();
  const relatorioId = params.id as string;
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [autoSaving, setAutoSaving] = useState<boolean>(false);
  const [baixandoPdf, setBaixandoPdf] = useState<boolean>(false);
  const [pdfAberturaBloqueada, setPdfAberturaBloqueada] = useState<{
    blobUrl: string;
    nomeArquivo: string;
  } | null>(null);
  const [showFinalizarConfirm, setShowFinalizarConfirm] = useState<boolean>(false);
  const [finalizando, setFinalizando] = useState<boolean>(false);
  const [formData, setFormData] = useState<RelatorioTecnicoFormData | null>(null);
  const [consultoraId, setConsultoraId] = useState<string>('');
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<Date | null>(null);
  const snapshotSalvoRef = useRef<string>('');
  const carregandoInicialRef = useRef<boolean>(true);
  const somenteLeitura = Boolean(usuario && consultoraId && usuario.id !== consultoraId);

  const payloadAtualizacao = useMemo(() => {
    if (!formData) {
      return null;
    }
    return {
      clienteId: formData.clienteId,
      unidadeId: formData.unidadeId || undefined,
      identificacao: formData.identificacao,
      descricaoOcorrenciaHtml: formData.descricaoOcorrenciaHtml,
      avaliacaoTecnicaHtml: formData.avaliacaoTecnicaHtml,
      acoesExecutadas: formData.acoesExecutadas,
      recomendacoesConsultoraHtml: formData.recomendacoesConsultoraHtml,
      planoAcaoSugeridoHtml: formData.planoAcaoSugeridoHtml,
      assinaturaNomeConsultora: formData.assinaturaNomeConsultora,
      responsavel: formData.responsavel,
      status: formData.status,
    } as Partial<CriarRelatorioTecnicoRequest>;
  }, [formData]);

  useEffect(() => {
    async function carregar(): Promise<void> {
      try {
        const data = await relatorioTecnicoService.buscarPorId(relatorioId);
        setConsultoraId(data.consultoraId || '');
        const formMapeado = mapearParaFormulario(data);
        setFormData(formMapeado);
        snapshotSalvoRef.current = JSON.stringify({
          clienteId: formMapeado.clienteId,
          unidadeId: formMapeado.unidadeId || '',
          identificacao: formMapeado.identificacao,
          descricaoOcorrenciaHtml: formMapeado.descricaoOcorrenciaHtml,
          avaliacaoTecnicaHtml: formMapeado.avaliacaoTecnicaHtml,
          acoesExecutadas: formMapeado.acoesExecutadas,
          recomendacoesConsultoraHtml: formMapeado.recomendacoesConsultoraHtml,
          planoAcaoSugeridoHtml: formMapeado.planoAcaoSugeridoHtml,
          assinaturaNomeConsultora: formMapeado.assinaturaNomeConsultora,
          responsavel: formMapeado.responsavel,
          status: formMapeado.status,
        });
        carregandoInicialRef.current = false;
      } finally {
        setLoading(false);
      }
    }
    if (relatorioId) {
      void carregar();
    }
  }, [relatorioId]);

  const atualizarSnapshotAposSalvar = useCallback(
    (payload: Partial<CriarRelatorioTecnicoRequest>): void => {
      snapshotSalvoRef.current = JSON.stringify({
        clienteId: payload.clienteId || '',
        unidadeId: payload.unidadeId || '',
        identificacao: payload.identificacao || '',
        descricaoOcorrenciaHtml: payload.descricaoOcorrenciaHtml || '',
        avaliacaoTecnicaHtml: payload.avaliacaoTecnicaHtml || '',
        acoesExecutadas: payload.acoesExecutadas || [],
        recomendacoesConsultoraHtml: payload.recomendacoesConsultoraHtml || '',
        planoAcaoSugeridoHtml: payload.planoAcaoSugeridoHtml || '',
        assinaturaNomeConsultora: payload.assinaturaNomeConsultora || '',
        responsavel: payload.responsavel || '',
        status: payload.status || 'rascunho',
      });
    },
    [],
  );

  const salvarRelatorio = useCallback(async (mostrarToastSucesso: boolean): Promise<boolean> => {
    if (!payloadAtualizacao) {
      return false;
    }
    try {
      await relatorioTecnicoService.atualizar(relatorioId, payloadAtualizacao);
      atualizarSnapshotAposSalvar(payloadAtualizacao);
      setUltimaSincronizacao(new Date());
      if (mostrarToastSucesso) {
        toastService.success('Relatório técnico atualizado com sucesso!');
      }
      return true;
    } catch {
      return false;
    }
  }, [atualizarSnapshotAposSalvar, payloadAtualizacao, relatorioId]);

  const handleSalvar = async (): Promise<void> => {
    if (!payloadAtualizacao) {
      return;
    }
    setSaving(true);
    try {
      await salvarRelatorio(true);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!payloadAtualizacao || carregandoInicialRef.current || somenteLeitura) {
      return;
    }
    const snapshotAtual = JSON.stringify({
      clienteId: payloadAtualizacao.clienteId || '',
      unidadeId: payloadAtualizacao.unidadeId || '',
      identificacao: payloadAtualizacao.identificacao || '',
      descricaoOcorrenciaHtml: payloadAtualizacao.descricaoOcorrenciaHtml || '',
      avaliacaoTecnicaHtml: payloadAtualizacao.avaliacaoTecnicaHtml || '',
      acoesExecutadas: payloadAtualizacao.acoesExecutadas || [],
      recomendacoesConsultoraHtml: payloadAtualizacao.recomendacoesConsultoraHtml || '',
      planoAcaoSugeridoHtml: payloadAtualizacao.planoAcaoSugeridoHtml || '',
      assinaturaNomeConsultora: payloadAtualizacao.assinaturaNomeConsultora || '',
      responsavel: payloadAtualizacao.responsavel || '',
      status: payloadAtualizacao.status || 'rascunho',
    });
    if (snapshotAtual === snapshotSalvoRef.current) {
      return;
    }
    const timer = setTimeout(async () => {
      setAutoSaving(true);
      await salvarRelatorio(false);
      setAutoSaving(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [payloadAtualizacao, salvarRelatorio]);

  const handleBaixarPdf = async (): Promise<void> => {
    setBaixandoPdf(true);
    try {
      const resultado = await relatorioTecnicoService.baixarPdf(relatorioId);
      if (resultado.bloqueado) {
        setPdfAberturaBloqueada({
          blobUrl: resultado.blobUrl,
          nomeArquivo: resultado.nomeArquivo,
        });
        toastService.warning(
          'O navegador pode ter bloqueado a nova aba com o PDF. Siga as instruções na janela ou use Baixar PDF.',
        );
      } else {
        toastService.success('PDF aberto em nova aba.');
      }
    } catch {
      // Erro tratado no interceptor
    } finally {
      setBaixandoPdf(false);
    }
  };

  const handleConfirmarFinalizar = async (): Promise<void> => {
    if (!payloadAtualizacao) {
      return;
    }
    setFinalizando(true);
    try {
      const payloadFinal: Partial<CriarRelatorioTecnicoRequest> = {
        ...payloadAtualizacao,
        status: 'finalizado',
      };
      await relatorioTecnicoService.atualizar(relatorioId, payloadFinal);
      setFormData((prev) => (prev ? { ...prev, status: 'finalizado' } : prev));
      atualizarSnapshotAposSalvar(payloadFinal);
      setUltimaSincronizacao(new Date());
      toastService.success('Relatório finalizado com sucesso.');
      setShowFinalizarConfirm(false);
    } catch {
      // Erro tratado no interceptor
    } finally {
      setFinalizando(false);
    }
  };

  if (loading || !formData) {
    return (
      <AppLayout>
        <PageHeader
          title="Relatório Técnico"
          subtitle="Carregando dados..."
          backHref="/admin/relatorios-tecnicos"
        />
        <div className="px-4 py-8 lg:px-8">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PdfAberturaBloqueadaModal
        open={pdfAberturaBloqueada !== null}
        blobUrl={pdfAberturaBloqueada?.blobUrl ?? ''}
        nomeArquivo={pdfAberturaBloqueada?.nomeArquivo ?? ''}
        onClose={() => setPdfAberturaBloqueada(null)}
      />
      <PageLoadingOverlay
        open={baixandoPdf}
        title="Gerando o relatório"
        subtitle="Aguarde enquanto o PDF é preparado. Isso pode levar alguns instantes."
      />
      <PageHeader
        title="Relatório Técnico"
        subtitle={
          somenteLeitura
            ? 'Visualização do relatório (somente leitura)'
            : autoSaving
              ? 'Salvando alterações automaticamente...'
              : ultimaSincronizacao
                ? `Última sincronização às ${ultimaSincronizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                : 'Edite, gere apoio analítico e baixe o PDF'
        }
        backHref="/admin/relatorios-tecnicos"
        action={(
          <div className="flex flex-wrap items-center justify-end gap-2">
            {formData.status === 'finalizado' && (
              <span className="badge badge-success badge-sm whitespace-nowrap">Finalizado</span>
            )}
            <button
              type="button"
              className="btn btn-outline btn-sm gap-2"
              onClick={handleBaixarPdf}
              disabled={baixandoPdf || finalizando}
            >
              {baixandoPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Gerando…
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </>
              )}
            </button>
            {!somenteLeitura && formData.status === 'rascunho' && (
              <button
                type="button"
                className="btn btn-success btn-sm gap-2"
                onClick={() => setShowFinalizarConfirm(true)}
                disabled={saving || finalizando}
              >
                <CheckCircle2 className="w-4 h-4" />
                Finalizar
              </button>
            )}
            {!somenteLeitura && (
              <button
                type="button"
                className="btn btn-primary btn-sm gap-2"
                onClick={handleSalvar}
                disabled={saving || finalizando}
              >
                <Save className="w-4 h-4" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            )}
          </div>
        )}
      />
      <ConfirmDialog
        open={showFinalizarConfirm}
        onClose={() => setShowFinalizarConfirm(false)}
        onConfirm={handleConfirmarFinalizar}
        title="Finalizar relatório técnico"
        message="O relatório será marcado como finalizado. Você poderá continuar editando o conteúdo depois, se precisar."
        confirmLabel="Finalizar"
        cancelLabel="Cancelar"
        variant="info"
        loading={finalizando}
      />
      <div className="px-4 py-4 lg:px-8">
        <RelatorioTecnicoForm
          relatorioId={relatorioId}
          valor={formData}
          onChange={setFormData}
          somenteLeitura={somenteLeitura}
          nomeConsultoraLogada={usuario?.nome || ''}
          onAntesGerarApoioAnalitico={somenteLeitura ? undefined : async () => salvarRelatorio(false)}
          onApoioAnaliticoGerado={somenteLeitura ? undefined : (texto) => {
            setFormData((prev) => (prev ? { ...prev, apoioAnaliticoChekAi: texto } : prev));
          }}
        />
      </div>
    </AppLayout>
  );
}

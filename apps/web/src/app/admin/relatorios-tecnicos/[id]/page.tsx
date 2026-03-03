'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, Save } from 'lucide-react';
import { AppLayout, PageHeader } from '@/components';
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
  const [formData, setFormData] = useState<RelatorioTecnicoFormData | null>(null);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<Date | null>(null);
  const snapshotSalvoRef = useRef<string>('');
  const carregandoInicialRef = useRef<boolean>(true);

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
      status: formData.status,
    } as Partial<CriarRelatorioTecnicoRequest>;
  }, [formData]);

  useEffect(() => {
    async function carregar(): Promise<void> {
      try {
        const data = await relatorioTecnicoService.buscarPorId(relatorioId);
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

  const salvarRelatorio = useCallback(async (mostrarToastSucesso: boolean): Promise<boolean> => {
    if (!payloadAtualizacao) {
      return false;
    }
    try {
      await relatorioTecnicoService.atualizar(relatorioId, payloadAtualizacao);
      snapshotSalvoRef.current = JSON.stringify({
        clienteId: payloadAtualizacao.clienteId || '',
        unidadeId: payloadAtualizacao.unidadeId || '',
        identificacao: payloadAtualizacao.identificacao || '',
        descricaoOcorrenciaHtml: payloadAtualizacao.descricaoOcorrenciaHtml || '',
        avaliacaoTecnicaHtml: payloadAtualizacao.avaliacaoTecnicaHtml || '',
        acoesExecutadas: payloadAtualizacao.acoesExecutadas || [],
        recomendacoesConsultoraHtml: payloadAtualizacao.recomendacoesConsultoraHtml || '',
        planoAcaoSugeridoHtml: payloadAtualizacao.planoAcaoSugeridoHtml || '',
        assinaturaNomeConsultora: payloadAtualizacao.assinaturaNomeConsultora || '',
        status: payloadAtualizacao.status || 'rascunho',
      });
      setUltimaSincronizacao(new Date());
      if (mostrarToastSucesso) {
        toastService.success('Relatório técnico atualizado com sucesso!');
      }
      return true;
    } catch {
      return false;
    }
  }, [payloadAtualizacao, relatorioId]);

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
    if (!payloadAtualizacao || carregandoInicialRef.current) {
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
      await relatorioTecnicoService.baixarPdf(relatorioId);
      toastService.success('PDF gerado e baixado com sucesso!');
    } catch {
      // Erro tratado no interceptor
    } finally {
      setBaixandoPdf(false);
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
      <PageHeader
        title="Relatório Técnico"
        subtitle={
          autoSaving
            ? 'Salvando alterações automaticamente...'
            : ultimaSincronizacao
              ? `Última sincronização às ${ultimaSincronizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Edite, gere apoio analítico e baixe o PDF'
        }
        backHref="/admin/relatorios-tecnicos"
        action={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm gap-2"
              onClick={handleBaixarPdf}
              disabled={baixandoPdf}
            >
              <Download className="w-4 h-4" />
              {baixandoPdf ? 'Gerando PDF...' : 'Baixar PDF'}
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm gap-2"
              onClick={handleSalvar}
              disabled={saving}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        )}
      />
      <div className="px-4 py-4 lg:px-8">
        <RelatorioTecnicoForm
          relatorioId={relatorioId}
          valor={formData}
          onChange={setFormData}
          nomeConsultoraLogada={usuario?.nome || ''}
          onAntesGerarApoioAnalitico={async () => salvarRelatorio(false)}
          onApoioAnaliticoGerado={(texto) => {
            setFormData((prev) => (prev ? { ...prev, apoioAnaliticoChekAi: texto } : prev));
          }}
        />
      </div>
    </AppLayout>
  );
}

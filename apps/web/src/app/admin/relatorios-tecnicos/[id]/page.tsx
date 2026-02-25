'use client';

import { useEffect, useState } from 'react';
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
  const relatorioId = params.id as string;
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [baixandoPdf, setBaixandoPdf] = useState<boolean>(false);
  const [formData, setFormData] = useState<RelatorioTecnicoFormData | null>(null);

  useEffect(() => {
    async function carregar(): Promise<void> {
      try {
        const data = await relatorioTecnicoService.buscarPorId(relatorioId);
        setFormData(mapearParaFormulario(data));
      } finally {
        setLoading(false);
      }
    }
    if (relatorioId) {
      void carregar();
    }
  }, [relatorioId]);

  const handleSalvar = async (): Promise<void> => {
    if (!formData) {
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<CriarRelatorioTecnicoRequest> = {
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
      };
      await relatorioTecnicoService.atualizar(relatorioId, payload);
      toastService.success('Relatório técnico atualizado com sucesso!');
    } catch {
      // Erro tratado no interceptor
    } finally {
      setSaving(false);
    }
  };

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
        subtitle="Edite, gere apoio analítico e baixe o PDF"
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
          onApoioAnaliticoGerado={(texto) => {
            setFormData((prev) => (prev ? { ...prev, apoioAnaliticoChekAi: texto } : prev));
          }}
        />
      </div>
    </AppLayout>
  );
}

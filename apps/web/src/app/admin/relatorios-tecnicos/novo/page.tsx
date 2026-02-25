'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
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

function criarEstadoInicial(): RelatorioTecnicoFormData {
  return {
    clienteId: '',
    unidadeId: '',
    identificacao: '',
    descricaoOcorrenciaHtml: '',
    avaliacaoTecnicaHtml: '',
    acoesExecutadas: [],
    recomendacoesConsultoraHtml: '',
    planoAcaoSugeridoHtml: '',
    assinaturaNomeConsultora: '',
    status: 'rascunho',
    apoioAnaliticoChekAi: '',
  };
}

export default function NovoRelatorioTecnicoPage() {
  const router = useRouter();
  const [saving, setSaving] = useState<boolean>(false);
  const [formData, setFormData] = useState<RelatorioTecnicoFormData>(criarEstadoInicial());

  const handleSalvar = async (): Promise<void> => {
    if (!formData.clienteId || !formData.identificacao.trim()) {
      toastService.warning('Preencha cliente e identificação antes de salvar.');
      return;
    }
    setSaving(true);
    try {
      const payload: CriarRelatorioTecnicoRequest = {
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
      const relatorio = await relatorioTecnicoService.criar(payload);
      toastService.success('Relatório técnico criado com sucesso!');
      router.push(`/admin/relatorios-tecnicos/${relatorio.id}`);
    } catch {
      // Erro tratado no interceptor
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Novo Relatório Técnico"
        subtitle="Preencha os campos técnicos do cliente"
        backHref="/admin/relatorios-tecnicos"
        action={(
          <button
            type="button"
            className="btn btn-primary btn-sm gap-2"
            onClick={handleSalvar}
            disabled={saving}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        )}
      />
      <div className="px-4 py-4 lg:px-8">
        <RelatorioTecnicoForm valor={formData} onChange={setFormData} />
      </div>
    </AppLayout>
  );
}

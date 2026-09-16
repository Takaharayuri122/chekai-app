'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, FileText, Filter } from 'lucide-react';
import {
  AppLayout,
  CrudFiltros,
  CrudTable,
  EmptyState,
  PageHeader,
  PageLoadingOverlay,
  PdfAberturaBloqueadaModal,
  type ColunaTabela,
} from '@/components';
import { PerfilUsuario } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';
import {
  AgruparHorasCheckin,
  checkinService,
  ItemRelatorioHorasCheckin,
  RelatorioHorasCheckin,
} from '@/lib/services/checkin.service';

interface FiltrosRelatorio {
  agruparPor: string;
  auditorId: string;
  clienteId: string;
  dataInicio: string;
  dataFim: string;
}

function primeiroDiaMesAtual(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-01`;
}

function hojeIso(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

function formatarMinutos(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${horas}h ${resto}min`;
}

function exportarCsv(relatorio: RelatorioHorasCheckin): void {
  const cabecalho = 'Nome,Check-ins,Minutos fechados,Minutos em andamento,Total minutos,Total formatado';
  const linhas = relatorio.itens.map((item) => [
    `"${item.nome.replace(/"/g, '""')}"`,
    item.quantidade,
    item.minutosFechados,
    item.minutosAbertos,
    item.minutosTotal,
    formatarMinutos(item.minutosTotal),
  ].join(','));
  const csv = `\uFEFF${cabecalho}\n${linhas.join('\n')}\nTotal geral,,,,${relatorio.totalGeralMinutos},${formatarMinutos(relatorio.totalGeralMinutos)}\n`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'relatorio-horas-checkin.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const FILTROS_INICIAIS: FiltrosRelatorio = {
  agruparPor: 'cliente',
  auditorId: '',
  clienteId: '',
  dataInicio: primeiroDiaMesAtual(),
  dataFim: hojeIso(),
};

export default function RelatorioHorasCheckinPage() {
  const { usuario } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [relatorio, setRelatorio] = useState<RelatorioHorasCheckin | null>(null);
  const [filtrosAtuais, setFiltrosAtuais] = useState<FiltrosRelatorio>(FILTROS_INICIAIS);
  const [auditoresOpcoes, setAuditoresOpcoes] = useState<Array<{ value: string; label: string }>>([]);
  const [clientesOpcoes, setClientesOpcoes] = useState<Array<{ value: string; label: string }>>([]);
  const [pdfBloqueado, setPdfBloqueado] = useState<{ blobUrl: string; nomeArquivo: string } | null>(null);

  const podeVisualizar = useMemo(
    () => usuario?.perfil === PerfilUsuario.GESTOR || usuario?.perfil === PerfilUsuario.MASTER,
    [usuario?.perfil],
  );

  useEffect(() => {
    if (!podeVisualizar) return;
    const carregarOpcoes = async (): Promise<void> => {
      const filtros = await checkinService.buscarFiltros();
      setAuditoresOpcoes(
        filtros.auditores.map((auditor) => ({ value: auditor.id, label: auditor.nome })),
      );
      setClientesOpcoes(
        filtros.clientes.map((cliente) => ({
          value: cliente.id,
          label: cliente.nome,
        })),
      );
    };
    carregarOpcoes().catch(() => undefined);
  }, [podeVisualizar]);

  const carregarRelatorio = async (filtros: FiltrosRelatorio): Promise<void> => {
    if (!filtros.dataInicio || !filtros.dataFim) {
      toastService.warning('Informe o período do relatório.');
      return;
    }
    setLoading(true);
    setFiltrosAtuais(filtros);
    try {
      const dados = await checkinService.relatorioHoras({
        agruparPor: (filtros.agruparPor || 'cliente') as AgruparHorasCheckin,
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
        auditorId: filtros.auditorId || undefined,
        clienteId: filtros.clienteId || undefined,
      });
      setRelatorio(dados);
    } finally {
      setLoading(false);
    }
  };

  const handlePdf = async (): Promise<void> => {
    if (!filtrosAtuais.dataInicio || !filtrosAtuais.dataFim) {
      toastService.warning('Informe o período do relatório.');
      return;
    }
    setGerandoPdf(true);
    try {
      const resultado = await checkinService.baixarPdfRelatorioHoras({
        agruparPor: (filtrosAtuais.agruparPor || 'cliente') as AgruparHorasCheckin,
        dataInicio: filtrosAtuais.dataInicio,
        dataFim: filtrosAtuais.dataFim,
        auditorId: filtrosAtuais.auditorId || undefined,
        clienteId: filtrosAtuais.clienteId || undefined,
      });
      if (resultado.bloqueado) {
        setPdfBloqueado({
          blobUrl: resultado.blobUrl,
          nomeArquivo: resultado.nomeArquivo,
        });
      }
    } catch {
      toastService.error('Não foi possível gerar o PDF.');
    } finally {
      setGerandoPdf(false);
    }
  };

  const colunas: ColunaTabela<ItemRelatorioHorasCheckin>[] = [
    {
      label: filtrosAtuais.agruparPor === 'usuario' ? 'Usuário' : 'Cliente',
      render: (item) => <span className="font-medium">{item.nome}</span>,
    },
    {
      label: 'Check-ins',
      render: (item) => <span className="tabular-nums">{item.quantidade}</span>,
    },
    {
      label: 'Fechadas',
      render: (item) => <span className="tabular-nums">{formatarMinutos(item.minutosFechados)}</span>,
    },
    {
      label: 'Em andamento',
      render: (item) => <span className="tabular-nums">{formatarMinutos(item.minutosAbertos)}</span>,
    },
    {
      label: 'Total',
      render: (item) => <span className="tabular-nums font-medium">{formatarMinutos(item.minutosTotal)}</span>,
    },
  ];

  if (!podeVisualizar) {
    return (
      <AppLayout>
        <PageHeader title="Relatório de horas" backHref="/admin/checkins" />
        <div className="px-4 py-4 lg:px-8">
          <EmptyState
            icon={Filter}
            title="Sem permissão"
            description="Esta funcionalidade está disponível apenas para Gestor e Administrador."
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Relatório de horas"
        subtitle="Total de horas de check-in por cliente ou usuário"
        backHref="/admin/checkins"
        action={(
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm gap-2"
              onClick={() => relatorio && exportarCsv(relatorio)}
              disabled={!relatorio}
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm gap-2"
              onClick={() => { void handlePdf(); }}
              disabled={!relatorio}
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        )}
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        <CrudFiltros
          campos={[
            {
              key: 'agruparPor',
              label: 'Agrupar por',
              tipo: 'select',
              opcoes: [
                { value: 'cliente', label: 'Cliente' },
                { value: 'usuario', label: 'Usuário' },
              ],
            },
            { key: 'auditorId', label: 'Auditor', tipo: 'select', opcoes: auditoresOpcoes },
            { key: 'clienteId', label: 'Cliente', tipo: 'select', opcoes: clientesOpcoes },
            { key: 'dataInicio', label: 'Data início', tipo: 'date' },
            { key: 'dataFim', label: 'Data fim', tipo: 'date' },
          ]}
          valoresIniciais={FILTROS_INICIAIS}
          onPesquisar={(filtros) => {
            void carregarRelatorio(filtros);
          }}
          onLimpar={() => {
            void carregarRelatorio(FILTROS_INICIAIS);
          }}
        />

        {relatorio ? (
          <>
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body py-4">
                <p className="text-sm text-base-content/70">
                  Período {relatorio.dataInicio} a {relatorio.dataFim}
                </p>
                <p className="text-2xl font-bold font-display">
                  {formatarMinutos(relatorio.totalGeralMinutos)}
                </p>
              </div>
            </div>
            <CrudTable
              colunas={colunas}
              dados={relatorio.itens}
              keyExtractor={(item) => item.id}
              loading={loading}
              emptyState={{
                icon: BarChart3,
                title: 'Nenhum check-in no período',
                description: 'Ajuste os filtros para calcular as horas.',
              }}
            />
          </>
        ) : loading ? (
          <CrudTable
            colunas={colunas}
            dados={[]}
            keyExtractor={(item) => item.id}
            loading
            emptyState={{
              icon: BarChart3,
              title: 'Nenhum check-in no período',
              description: 'Ajuste os filtros para calcular as horas.',
            }}
          />
        ) : null}
      </div>

      <PageLoadingOverlay
        open={gerandoPdf}
        title="Gerando PDF"
        subtitle="Aguarde enquanto preparamos o relatório de horas."
      />
      <PdfAberturaBloqueadaModal
        open={Boolean(pdfBloqueado)}
        onClose={() => setPdfBloqueado(null)}
        blobUrl={pdfBloqueado?.blobUrl ?? ''}
        nomeArquivo={pdfBloqueado?.nomeArquivo ?? 'relatorio-horas-checkin.pdf'}
      />
    </AppLayout>
  );
}

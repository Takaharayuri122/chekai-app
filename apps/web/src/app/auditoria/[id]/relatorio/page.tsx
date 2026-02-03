'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  FileText,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  User,
  Calendar,
  Download,
  ArrowLeft,
  Sparkles,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { AppLayout, PageHeader } from '@/components';
import { GraficoAproveitamentoGrupos } from '@/components/relatorio/grafico-aproveitamento-grupos';
import { GraficoDistribuicaoPontos } from '@/components/relatorio/grafico-distribuicao-pontos';
import { HistoricoEvolucao } from '@/components/relatorio/historico-evolucao';
import {
  auditoriaService,
  type Auditoria,
  type AuditoriaItem,
  type AuditoriaHistoricoItem,
} from '@/lib/api';
import { toastService } from '@/lib/toast';

const RespostaItem = {
  CONFORME: 'conforme',
  NAO_CONFORME: 'nao_conforme',
  NAO_APLICAVEL: 'nao_aplicavel',
  NAO_AVALIADO: 'nao_avaliado',
} as const;

interface GrupoMetricas {
  grupoId: string;
  nome: string;
  pontuacaoPossivel: number;
  pontuacaoObtida: number;
  naoConformidades: number;
  naoAplicaveis: number;
  naoRespondidas: number;
  aproveitamento: number;
  itens: AuditoriaItem[];
}

interface ResumoExecutivo {
  resumo: string;
  pontosFortes: string[];
  pontosFracos: string[];
  recomendacoesPrioritarias: string[];
  riscoGeral: 'baixo' | 'medio' | 'alto' | 'critico';
  tendencias: string[];
}

export default function RelatorioPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPdfMode = searchParams.get('pdf') === 'true';
  const id = params.id as string;

  const [auditoria, setAuditoria] = useState<Auditoria | null>(null);
  const [loading, setLoading] = useState(true);
  const [resumoExecutivo, setResumoExecutivo] = useState<ResumoExecutivo | null>(null);
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const [gruposMetricas, setGruposMetricas] = useState<GrupoMetricas[]>([]);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const [metricasGerais, setMetricasGerais] = useState({
    aproveitamento: 0,
    pontosPossiveis: 0,
    pontosRealizados: 0,
    naoAplicaveis: 0,
    naoConformidades: 0,
    naoRespondidas: 0,
  });
  const [fotoModal, setFotoModal] = useState<{ url: string; exif?: Record<string, unknown> | null } | null>(null);
  const [historicoEvolucao, setHistoricoEvolucao] = useState<AuditoriaHistoricoItem[]>([]);

  const carregarAuditoria = async () => {
    try {
      const data = await auditoriaService.buscarPorId(id);
      if (data.status !== 'finalizada') {
        toastService.warning('Esta auditoria ainda não foi finalizada');
        router.push(`/auditoria/${id}`);
        return;
      }
      setAuditoria(data);
      calcularMetricas(data);
      if (data.resumoExecutivo) {
        setResumoExecutivo(data.resumoExecutivo);
      } else {
        setResumoExecutivo(null);
      }
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getPontuacaoMaximaItem = (
    templateItem: { opcoesRespostaConfig?: Array<{ pontuacao?: number }>; peso?: number } | null | undefined,
  ): number => {
    if (!templateItem) return 0;
    const configs = templateItem.opcoesRespostaConfig || [];
    const peso = templateItem.peso ?? 1;
    const todasComPontuacao =
      configs.length > 0 &&
      configs.every((c) => c.pontuacao != null && c.pontuacao !== undefined);
    if (todasComPontuacao) {
      return Math.max(0, ...configs.map((c) => Number(c.pontuacao)));
    }
    return Math.max(0, peso);
  };

  const calcularMetricas = (aud: Auditoria) => {
    const itensPorGrupo = new Map<string, AuditoriaItem[]>();
    aud.itens.forEach((item) => {
      const grupoId = item.templateItem?.grupoId || 'sem-grupo';
      if (!itensPorGrupo.has(grupoId)) {
        itensPorGrupo.set(grupoId, []);
      }
      itensPorGrupo.get(grupoId)!.push(item);
    });

    const grupos: GrupoMetricas[] = Array.from(itensPorGrupo.entries()).map(([grupoId, itens]) => {
      const primeiroItem = itens[0];
      const grupoNome = primeiroItem.templateItem?.grupo?.nome || 'Sem Grupo';
      const pontuacaoPossivel = itens.reduce(
        (acc, item) => acc + getPontuacaoMaximaItem(item.templateItem),
        0,
      );
      const pontuacaoObtida = itens.reduce((acc, item) => acc + Number(item.pontuacao || 0), 0);
      const naoConformidades = itens.filter(
        (item) => item.resposta === RespostaItem.NAO_CONFORME,
      ).length;
      const naoAplicaveis = itens.filter(
        (item) => item.resposta === RespostaItem.NAO_APLICAVEL,
      ).length;
      const naoRespondidas = itens.filter(
        (item) => item.resposta === RespostaItem.NAO_AVALIADO,
      ).length;
      const aproveitamentoCalculado = pontuacaoPossivel > 0 
        ? (pontuacaoObtida / pontuacaoPossivel) * 100 
        : 0;
      const aproveitamento = isNaN(aproveitamentoCalculado) || !isFinite(aproveitamentoCalculado) 
        ? 0 
        : Number(aproveitamentoCalculado);

      return {
        grupoId,
        nome: grupoNome,
        pontuacaoPossivel,
        pontuacaoObtida,
        naoConformidades,
        naoAplicaveis,
        naoRespondidas,
        aproveitamento,
        itens,
      };
    });

    grupos.sort((a, b) => {
      const ordemA = a.itens[0]?.templateItem?.grupo?.ordem || 0;
      const ordemB = b.itens[0]?.templateItem?.grupo?.ordem || 0;
      return ordemA - ordemB;
    });

    setGruposMetricas(grupos);

    const pontuacaoTotal = typeof aud.pontuacaoTotal === 'string' 
      ? parseFloat(aud.pontuacaoTotal) 
      : Number(aud.pontuacaoTotal) || 0;
    
    const aproveitamentoFinal = isNaN(pontuacaoTotal) || !isFinite(pontuacaoTotal) ? 0 : Number(pontuacaoTotal);
    
    const metricas = {
      aproveitamento: aproveitamentoFinal,
      pontosPossiveis: Number(grupos.reduce((acc, g) => acc + g.pontuacaoPossivel, 0)),
      pontosRealizados: Number(grupos.reduce((acc, g) => acc + g.pontuacaoObtida, 0)),
      naoAplicaveis: Number(grupos.reduce((acc, g) => acc + g.naoAplicaveis, 0)),
      naoConformidades: Number(grupos.reduce((acc, g) => acc + g.naoConformidades, 0)),
      naoRespondidas: Number(grupos.reduce((acc, g) => acc + g.naoRespondidas, 0)),
    };
    setMetricasGerais(metricas);
  };

  const gerarResumoExecutivo = async () => {
    if (!auditoria) return;
    try {
      setGerandoResumo(true);
      const resumo = await auditoriaService.gerarResumoExecutivo(auditoria.id);
      setResumoExecutivo(resumo);
      if (auditoria) {
        setAuditoria({ ...auditoria, resumoExecutivo: resumo });
      }
      toastService.success('Resumo executivo gerado e salvo com sucesso!');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro ao gerar resumo';
      toastService.error(`Erro ao gerar resumo executivo: ${errorMessage}`);
    } finally {
      setGerandoResumo(false);
    }
  };

  const handleBaixarPdf = async () => {
    if (!auditoria) return;
    try {
      setBaixandoPdf(true);
      await auditoriaService.baixarPdf(auditoria.id);
      toastService.success('PDF baixado com sucesso!');
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro ao baixar PDF';
      toastService.error(`Erro ao baixar PDF: ${errorMessage}`);
    } finally {
      setBaixandoPdf(false);
    }
  };

  useEffect(() => {
    carregarAuditoria();
  }, [id]);

  useEffect(() => {
    if (!auditoria?.unidade?.id) return;
    auditoriaService
      .listarHistoricoUnidade(auditoria.unidade.id)
      .then(setHistoricoEvolucao)
      .catch(() => setHistoricoEvolucao([]));
  }, [auditoria?.unidade?.id]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getClassificacao = (aproveitamento: number): string => {
    if (aproveitamento < 0) return 'Abaixo do mínimo';
    if (aproveitamento >= 90) return 'Com Excelência';
    if (aproveitamento >= 80) return 'Bom';
    if (aproveitamento >= 70) return 'Regular';
    if (aproveitamento >= 60) return 'Atenção Necessária';
    return 'Crítico';
  };

  const getRiscoColor = (risco: string) => {
    switch (risco) {
      case 'baixo':
        return 'text-success';
      case 'medio':
        return 'text-warning';
      case 'alto':
        return 'text-error';
      case 'critico':
        return 'text-error';
      default:
        return 'text-base-content';
    }
  };

  const getRiscoLabel = (risco: string) => {
    switch (risco) {
      case 'baixo':
        return 'Baixo';
      case 'medio':
        return 'Médio';
      case 'alto':
        return 'Alto';
      case 'critico':
        return 'Crítico';
      default:
        return risco;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      </AppLayout>
    );
  }

  if (!auditoria) {
    return null;
  }

  const aproveitamentoSeguro = typeof metricasGerais.aproveitamento === 'number'
    ? metricasGerais.aproveitamento
    : Number(metricasGerais.aproveitamento) || 0;
  const resumoDesatualizado = Boolean(
    auditoria?.resumoExecutivoGeradoEm
    && auditoria?.atualizadoEm
    && new Date(auditoria.atualizadoEm) > new Date(auditoria.resumoExecutivoGeradoEm),
  );
  const mostrarBotaoGerarResumo = !resumoExecutivo || resumoDesatualizado;

  if (isPdfMode) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Cabeçalho */}
          <div className="border-b pb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {auditoria.unidade?.nome || 'Unidade'}
            </h1>
            <p className="text-gray-600 mt-1">
              {auditoria.unidade?.cliente?.nomeFantasia ||
                auditoria.unidade?.cliente?.razaoSocial ||
                'Cliente'}
            </p>
            <div className="flex gap-4 mt-4 text-sm text-gray-600">
              <span>Auditor: {auditoria.consultor?.nome || 'Não informado'}</span>
              <span>
                Data: {formatDate(auditoria.dataInicio)} -{' '}
                {formatDate(auditoria.dataFim || '')}
              </span>
            </div>
          </div>

          {/* Métricas Gerais */}
          <div className="border rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Métricas Gerais</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Aproveitamento</div>
                <div className="text-3xl font-bold text-blue-600">
                  {aproveitamentoSeguro.toFixed(2)}%
                </div>
                <div className="text-sm text-gray-500">
                  {getClassificacao(aproveitamentoSeguro)}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Pontos Realizados</div>
                <div className="text-3xl font-bold text-green-600">
                  {metricasGerais.pontosRealizados}
                </div>
                <div className="text-sm text-gray-500">
                  de {metricasGerais.pontosPossiveis} possíveis
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600">Não Conformidades</div>
                <div className="text-3xl font-bold text-red-600">
                  {metricasGerais.naoConformidades}
                </div>
              </div>
            </div>

            {/* Tabela de Métricas por Grupo */}
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="border p-2 text-left">GRUPO</th>
                  <th className="border p-2 text-center">AP</th>
                  <th className="border p-2 text-center">PP</th>
                  <th className="border p-2 text-center">PR</th>
                  <th className="border p-2 text-center">NA</th>
                  <th className="border p-2 text-center">NC</th>
                  <th className="border p-2 text-center">NR</th>
                </tr>
              </thead>
              <tbody>
                {gruposMetricas.map((grupo) => (
                  <tr key={grupo.grupoId} className="border-b">
                    <td className="border p-2 font-medium">{grupo.nome}</td>
                    <td className="border p-2 text-center font-semibold">
                      {Number(grupo.aproveitamento || 0).toFixed(2)}%
                    </td>
                    <td className="border p-2 text-center">
                      {grupo.pontuacaoPossivel}
                    </td>
                    <td className="border p-2 text-center">
                      {grupo.pontuacaoObtida}
                    </td>
                    <td className="border p-2 text-center">
                      {grupo.naoAplicaveis}
                    </td>
                    <td className="border p-2 text-center">
                      {grupo.naoConformidades > 0 ? (
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                          {grupo.naoConformidades}
                        </span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="border p-2 text-center">
                      {grupo.naoRespondidas}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold">
                  <td className="border p-2">GERAL</td>
                  <td className="border p-2 text-center">
                    {aproveitamentoSeguro.toFixed(2)}%
                  </td>
                  <td className="border p-2 text-center">
                    {metricasGerais.pontosPossiveis}
                  </td>
                  <td className="border p-2 text-center">
                    {metricasGerais.pontosRealizados}
                  </td>
                  <td className="border p-2 text-center">
                    {metricasGerais.naoAplicaveis}
                  </td>
                  <td className="border p-2 text-center">
                    {metricasGerais.naoConformidades}
                  </td>
                  <td className="border p-2 text-center">
                    {metricasGerais.naoRespondidas}
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <h3 className="text-base font-bold mb-3 text-gray-900">% de aproveitamento por grupo do formulário</h3>
              <div className="h-[320px] w-full">
                <GraficoAproveitamentoGrupos
                  grupos={gruposMetricas.map((g) => ({
                    grupoId: g.grupoId,
                    nome: g.nome,
                    aproveitamento: Number(g.aproveitamento ?? 0),
                  }))}
                  aproveitamentoGeral={aproveitamentoSeguro}
                />
              </div>
              <div className="flex flex-wrap justify-center gap-4 mt-3 pt-3 border-t border-gray-200">
                <span className="text-xs font-medium text-gray-600">Legenda (faixa de aproveitamento):</span>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm bg-green-500 shrink-0" aria-hidden />
                  <span className="text-xs text-gray-700">≥70% (Bom)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm bg-yellow-500 shrink-0" aria-hidden />
                  <span className="text-xs text-gray-700">60–70% (Atenção)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-3 h-3 rounded-sm bg-red-500 shrink-0" aria-hidden />
                  <span className="text-xs text-gray-700">&lt;60% (Crítico)</span>
                </div>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-base font-bold mb-3 text-gray-900">Distribuição de pontos</h3>
                <div className="h-[280px] w-full">
                  <GraficoDistribuicaoPontos
                    pontosPossiveis={metricasGerais.pontosPossiveis}
                    pontosRealizados={metricasGerais.pontosRealizados}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Histórico de evolução (PDF) */}
          <div className="border rounded-lg p-6">
            <HistoricoEvolucao
              historico={historicoEvolucao}
              auditoriaAtualId={id}
              linkBase="/auditoria"
            />
          </div>

          {/* Detalhamento por Grupo */}
          <div className="space-y-4">
            {gruposMetricas.map((grupo) => (
              <div key={grupo.grupoId} className="border rounded-lg p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">{grupo.nome}</h3>
                  <div className="text-sm text-gray-600">
                    Aproveitamento: <strong>{Number(grupo.aproveitamento || 0).toFixed(2)}%</strong> | Pontos: {grupo.pontuacaoObtida}/{grupo.pontuacaoPossivel}
                  </div>
                </div>
                <div className="space-y-4">
                  {grupo.itens.map((item) => {
                    const resposta = item.resposta;
                    const isConforme = resposta === RespostaItem.CONFORME;
                    const isNaoConforme = resposta === RespostaItem.NAO_CONFORME;

                    return (
                      <div
                        key={item.id}
                        className={`p-4 rounded-lg border ${
                          isNaoConforme
                            ? 'bg-red-50 border-red-200'
                            : isConforme
                              ? 'bg-green-50 border-green-200'
                              : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {isConforme ? (
                              <span className="text-green-600 text-xl">✓</span>
                            ) : isNaoConforme ? (
                              <span className="text-red-600 text-xl">✗</span>
                            ) : (
                              <span className="text-yellow-600 text-xl">⚠</span>
                            )}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 mb-2">
                              {item.templateItem?.pergunta || 'Pergunta não encontrada'}
                            </p>
                            <div className="space-y-1 text-sm">
                              <div>
                                <span className="font-medium text-gray-700">Resposta: </span>
                                <span>
                                  {resposta === RespostaItem.CONFORME
                                    ? 'Conforme'
                                    : resposta === RespostaItem.NAO_CONFORME
                                      ? 'Não Conforme'
                                      : resposta === RespostaItem.NAO_APLICAVEL
                                        ? 'Não Aplicável'
                                        : resposta}
                                </span>
                              </div>
                              {item.observacao && (
                                <div>
                                  <span className="font-medium text-gray-700">Observação: </span>
                                  <span>{item.observacao}</span>
                                </div>
                              )}
                              {item.descricaoNaoConformidade && (
                                <div>
                                  <span className="font-medium text-red-700">Justificativa: </span>
                                  <span>{item.descricaoNaoConformidade}</span>
                                </div>
                              )}
                              {item.descricaoIa && (
                                <div>
                                  <span className="font-medium text-gray-700">Análise IA: </span>
                                  <span>{item.descricaoIa}</span>
                                </div>
                              )}
                              {item.fotos && item.fotos.length > 0 && (
                                <div className="mt-2">
                                  <span className="font-medium text-gray-700">Fotos: </span>
                                  <span>{item.fotos.length} anexada(s)</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Resumo Executivo */}
          {resumoExecutivo && (
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-bold mb-4">Resumo Executivo</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Resumo</h3>
                  <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                    {resumoExecutivo.resumo}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2 text-green-700">Pontos Fortes</h3>
                    <ul className="space-y-1">
                      {resumoExecutivo.pontosFortes.map((ponto, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-green-600">✓</span>
                          <span>{ponto}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2 text-red-700">Pontos Fracos</h3>
                    <ul className="space-y-1">
                      {resumoExecutivo.pontosFracos.map((ponto, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-red-600">✗</span>
                          <span>{ponto}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Recomendações Prioritárias</h3>
                  <ul className="space-y-2">
                    {resumoExecutivo.recomendacoesPrioritarias.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 p-2 bg-gray-50 rounded">
                        <span className="font-semibold text-blue-600">{idx + 1}.</span>
                        <span className="text-sm">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">Risco Geral</h3>
                    <span
                      className={`px-3 py-1 rounded text-sm font-semibold ${
                        resumoExecutivo.riscoGeral === 'baixo'
                          ? 'bg-green-100 text-green-800'
                          : resumoExecutivo.riscoGeral === 'medio'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {getRiscoLabel(resumoExecutivo.riscoGeral)}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Tendências Identificadas</h3>
                    <ul className="space-y-1">
                      {resumoExecutivo.tendencias.map((tendencia, idx) => (
                        <li key={idx} className="text-sm flex items-start gap-2">
                          <span className="text-blue-600">→</span>
                          <span>{tendencia}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <PageHeader title="Relatório de Auditoria" />
      <div className="px-4 py-4 lg:px-8 space-y-4">
        {/* Cabeçalho */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-4 sm:p-6">
            <div className="flex items-center justify-between gap-4 mb-4 pb-4 border-b border-base-300">
              <button
                onClick={() => router.push('/auditorias')}
                className="btn btn-ghost btn-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Voltar
              </button>
              <button
                onClick={handleBaixarPdf}
                disabled={baixandoPdf}
                className="btn btn-primary btn-sm"
              >
                {baixandoPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Exportar PDF
                  </>
                )}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-base-content truncate">
                    {auditoria.unidade?.nome || 'Unidade'}
                  </h1>
                  <p className="text-base-content/60 flex items-center gap-1 mt-0.5 text-xs sm:text-sm truncate">
                    <Building2 className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    {auditoria.unidade?.cliente?.nomeFantasia ||
                      auditoria.unidade?.cliente?.razaoSocial ||
                      'Cliente'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-base-content/70">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium">Auditor:</span>
                  <span className="truncate">{auditoria.consultor?.nome || 'Não informado'}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium">Data:</span>
                  <span className="truncate">
                    {formatDate(auditoria.dataInicio)} – {formatDate(auditoria.dataFim || '')}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium">Duração:</span>
                  <span>
                    {auditoria.dataInicio && auditoria.dataFim
                      ? `${Math.round(
                          (new Date(auditoria.dataFim).getTime() -
                            new Date(auditoria.dataInicio).getTime()) /
                            (1000 * 60 * 60 * 24),
                        )} dias`
                      : 'N/A'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Métricas Gerais */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Métricas Gerais</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="stat bg-base-200 rounded-lg p-3 sm:p-4">
                <div className="stat-title text-xs sm:text-sm">Aproveitamento</div>
                <div className="stat-value text-primary text-2xl sm:text-3xl">
                  {aproveitamentoSeguro.toFixed(2)}%
                </div>
                <div className="stat-desc text-xs sm:text-sm">{getClassificacao(aproveitamentoSeguro)}</div>
              </div>
              <div className="stat bg-base-200 rounded-lg p-3 sm:p-4">
                <div className="stat-title text-xs sm:text-sm">Pontos Realizados</div>
                <div className="stat-value text-success text-2xl sm:text-3xl">
                  {metricasGerais.pontosRealizados}
                </div>
                <div className="stat-desc text-xs sm:text-sm">de {metricasGerais.pontosPossiveis} possíveis</div>
              </div>
              <div className="stat bg-base-200 rounded-lg p-3 sm:p-4">
                <div className="stat-title text-xs sm:text-sm">Não Conformidades</div>
                <div className="stat-value text-error text-2xl sm:text-3xl">
                  {metricasGerais.naoConformidades}
                </div>
                <div className="stat-desc text-xs sm:text-sm">
                  {metricasGerais.naoAplicaveis > 0 && `${metricasGerais.naoAplicaveis} não aplicáveis`}
                </div>
              </div>
            </div>

            {/* Tabela de Métricas por Grupo - Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>GRUPO</th>
                    <th className="text-center">AP</th>
                    <th className="text-center">PP</th>
                    <th className="text-center">PR</th>
                    <th className="text-center">NA</th>
                    <th className="text-center">NC</th>
                    <th className="text-center">NR</th>
                  </tr>
                </thead>
                <tbody>
                  {gruposMetricas.map((grupo) => (
                    <tr key={grupo.grupoId}>
                      <td className="font-medium">{grupo.nome}</td>
                      <td className="text-center font-semibold">
                        {Number(grupo.aproveitamento || 0).toFixed(2)}%
                      </td>
                      <td className="text-center">{grupo.pontuacaoPossivel}</td>
                      <td className="text-center">{grupo.pontuacaoObtida}</td>
                      <td className="text-center">{grupo.naoAplicaveis}</td>
                      <td className="text-center">
                        {grupo.naoConformidades > 0 ? (
                          <span className="badge badge-error badge-sm">{grupo.naoConformidades}</span>
                        ) : (
                          <span className="text-base-content/40">0</span>
                        )}
                      </td>
                      <td className="text-center">{grupo.naoRespondidas}</td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-base-200">
                    <td>GERAL</td>
                    <td className="text-center">{aproveitamentoSeguro.toFixed(2)}%</td>
                    <td className="text-center">{metricasGerais.pontosPossiveis}</td>
                    <td className="text-center">{metricasGerais.pontosRealizados}</td>
                    <td className="text-center">{metricasGerais.naoAplicaveis}</td>
                    <td className="text-center">{metricasGerais.naoConformidades}</td>
                    <td className="text-center">{metricasGerais.naoRespondidas}</td>
                  </tr>
                </tbody>
              </table>
              <div className="text-xs text-base-content/60 mt-2">
                <p>
                  <strong>AP:</strong> Aproveitamento | <strong>PP:</strong> Pontos Possíveis |{' '}
                  <strong>PR:</strong> Pontos Realizados | <strong>NA:</strong> Não Aplicáveis |{' '}
                  <strong>NC:</strong> Não Conformidades | <strong>NR:</strong> Não Respondidas
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-base-300">
              <h3 className="text-base font-bold mb-4">% de aproveitamento por grupo do formulário</h3>
              <GraficoAproveitamentoGrupos
                grupos={gruposMetricas.map((g) => ({
                  grupoId: g.grupoId,
                  nome: g.nome,
                  aproveitamento: Number(g.aproveitamento ?? 0),
                }))}
                aproveitamentoGeral={aproveitamentoSeguro}
              />
            </div>
            <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h3 className="text-base font-bold mb-4">Distribuição de pontos</h3>
                <GraficoDistribuicaoPontos
                  pontosPossiveis={metricasGerais.pontosPossiveis}
                  pontosRealizados={metricasGerais.pontosRealizados}
                />
              </div>
            </div>

            {/* Cards de Métricas por Grupo - Mobile */}
            <div className="sm:hidden space-y-3">
              {gruposMetricas.map((grupo) => (
                <div key={grupo.grupoId} className="bg-base-200 rounded-lg p-3 border border-base-300">
                  <div className="font-semibold text-sm mb-2">{grupo.nome}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-base-content/60">AP:</span>{' '}
                      <span className="font-semibold">{Number(grupo.aproveitamento || 0).toFixed(2)}%</span>
                    </div>
                    <div>
                      <span className="text-base-content/60">PP:</span>{' '}
                      <span>{grupo.pontuacaoPossivel}</span>
                    </div>
                    <div>
                      <span className="text-base-content/60">PR:</span>{' '}
                      <span>{grupo.pontuacaoObtida}</span>
                    </div>
                    <div>
                      <span className="text-base-content/60">NA:</span>{' '}
                      <span>{grupo.naoAplicaveis}</span>
                    </div>
                    <div>
                      <span className="text-base-content/60">NC:</span>{' '}
                      {grupo.naoConformidades > 0 ? (
                        <span className="badge badge-error badge-xs">{grupo.naoConformidades}</span>
                      ) : (
                        <span>0</span>
                      )}
                    </div>
                    <div>
                      <span className="text-base-content/60">NR:</span>{' '}
                      <span>{grupo.naoRespondidas}</span>
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-primary/10 rounded-lg p-3 border-2 border-primary">
                <div className="font-bold text-sm mb-2">GERAL</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-base-content/60">AP:</span>{' '}
                    <span className="font-semibold">{aproveitamentoSeguro.toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="text-base-content/60">PP:</span>{' '}
                    <span>{metricasGerais.pontosPossiveis}</span>
                  </div>
                  <div>
                    <span className="text-base-content/60">PR:</span>{' '}
                    <span>{metricasGerais.pontosRealizados}</span>
                  </div>
                  <div>
                    <span className="text-base-content/60">NA:</span>{' '}
                    <span>{metricasGerais.naoAplicaveis}</span>
                  </div>
                  <div>
                    <span className="text-base-content/60">NC:</span>{' '}
                    <span>{metricasGerais.naoConformidades}</span>
                  </div>
                  <div>
                    <span className="text-base-content/60">NR:</span>{' '}
                    <span>{metricasGerais.naoRespondidas}</span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-base-content/60 mt-2">
                <p>
                  <strong>AP:</strong> Aproveitamento | <strong>PP:</strong> Pontos Possíveis |{' '}
                  <strong>PR:</strong> Pontos Realizados | <strong>NA:</strong> Não Aplicáveis |{' '}
                  <strong>NC:</strong> Não Conformidades | <strong>NR:</strong> Não Respondidas
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Histórico de evolução */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-4 sm:p-6">
            <HistoricoEvolucao
              historico={historicoEvolucao}
              auditoriaAtualId={id}
              linkBase="/auditoria"
            />
          </div>
        </div>

        {/* Detalhamento por Grupo */}
        <div className="space-y-4">
          {gruposMetricas.map((grupo, grupoIndex) => (
            <motion.div
              key={grupo.grupoId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: grupoIndex * 0.1 }}
              className="card bg-base-100 shadow-sm border border-base-300"
            >
              <div className="card-body p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 mb-4">
                  <h3 className="text-base sm:text-lg font-bold">{grupo.nome}</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="text-xs sm:text-sm text-base-content/60">
                      Aproveitamento: <strong>{Number(grupo.aproveitamento || 0).toFixed(2)}%</strong>
                    </span>
                    <div className="badge badge-outline badge-sm">
                      {grupo.pontuacaoObtida}/{grupo.pontuacaoPossivel} pontos
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {grupo.itens.map((item, itemIndex) => {
                    const resposta = item.resposta;
                    const isConforme = resposta === RespostaItem.CONFORME;
                    const isNaoConforme = resposta === RespostaItem.NAO_CONFORME;
                    const isNaoAplicavel = resposta === RespostaItem.NAO_APLICAVEL;

                    return (
                      <div
                        key={item.id}
                        className={`p-3 sm:p-4 rounded-lg border ${
                          isNaoConforme
                            ? 'bg-error/5 border-error/20'
                            : isConforme
                              ? 'bg-success/5 border-success/20'
                              : 'bg-base-200 border-base-300'
                        }`}
                      >
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="flex-shrink-0 mt-0.5 sm:mt-1">
                            {isConforme ? (
                              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-success" />
                            ) : isNaoConforme ? (
                              <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-error" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-warning" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm sm:text-base text-base-content mb-2">
                              {item.templateItem?.pergunta || 'Pergunta não encontrada'}
                            </p>
                            <div className="space-y-1.5 sm:space-y-2">
                              <div>
                                <span className="text-xs sm:text-sm font-medium text-base-content/70">
                                  Resposta:
                                </span>{' '}
                                <span className="text-xs sm:text-sm">
                                  {resposta === RespostaItem.CONFORME
                                    ? 'Sim'
                                    : resposta === RespostaItem.NAO_CONFORME
                                      ? 'Não'
                                      : resposta === RespostaItem.NAO_APLICAVEL
                                        ? 'Não Aplicável'
                                        : resposta}
                                </span>
                              </div>
                              {item.observacao && (
                                <div>
                                  <span className="text-xs sm:text-sm font-medium text-base-content/70">
                                    Observação:
                                  </span>{' '}
                                  <span className="text-xs sm:text-sm">{item.observacao}</span>
                                </div>
                              )}
                              {item.descricaoNaoConformidade && (
                                <div>
                                  <span className="text-xs sm:text-sm font-medium text-error">
                                    Justificativa:
                                  </span>{' '}
                                  <span className="text-xs sm:text-sm">{item.descricaoNaoConformidade}</span>
                                </div>
                              )}
                              {item.descricaoIa && (
                                <div>
                                  <span className="text-xs sm:text-sm font-medium text-base-content/70">
                                    Análise IA:
                                  </span>{' '}
                                  <span className="text-xs sm:text-sm">{item.descricaoIa}</span>
                                </div>
                              )}
                              {item.fotos && item.fotos.length > 0 && (
                                <div className="mt-2">
                                  <div className="flex flex-wrap gap-2">
                                    {item.fotos.map((foto) => (
                                      <button
                                        key={foto.id}
                                        type="button"
                                        onClick={() => setFotoModal({ url: foto.url, exif: foto.exif ?? undefined })}
                                        className="rounded border border-base-300 overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary"
                                      >
                                        <img
                                          src={foto.url}
                                          alt="Foto do item"
                                          className="w-16 h-16 sm:w-20 sm:h-20 object-cover hover:opacity-90"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Resumo Executivo */}
        <div className="card bg-base-100 shadow-sm border border-base-300">
          <div className="card-body p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h2 className="text-lg sm:text-xl font-bold">Resumo Executivo</h2>
              </div>
              {(mostrarBotaoGerarResumo ? (
                <button
                  onClick={gerarResumoExecutivo}
                  disabled={gerandoResumo}
                  className="btn btn-primary btn-sm w-full sm:w-auto"
                >
                  {gerandoResumo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Gerar Resumo
                    </>
                  )}
                </button>
              ) : null)}
            </div>

            {resumoExecutivo ? (
              <div className="space-y-4 sm:space-y-6">
                {resumoDesatualizado && (
                  <div className="alert alert-warning">
                    <AlertTriangle className="w-5 h-5" />
                    <span>A auditoria foi alterada após a geração deste resumo. Gere um novo resumo para refletir as alterações.</span>
                  </div>
                )}
                <div>
                  <h3 className="font-semibold mb-2 text-sm sm:text-base">Resumo</h3>
                  <p className="text-xs sm:text-sm text-base-content/80 leading-relaxed whitespace-pre-line">
                    {resumoExecutivo.resumo}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2 text-success text-sm sm:text-base">Pontos Fortes</h3>
                    <ul className="space-y-1.5">
                      {resumoExecutivo.pontosFortes.map((ponto, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-success flex-shrink-0 mt-0.5" />
                          <span>{ponto}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2 text-error text-sm sm:text-base">Pontos Fracos</h3>
                    <ul className="space-y-1.5">
                      {resumoExecutivo.pontosFracos.map((ponto, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm">
                          <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-error flex-shrink-0 mt-0.5" />
                          <span>{ponto}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 text-sm sm:text-base">Recomendações Prioritárias</h3>
                  <ul className="space-y-2">
                    {resumoExecutivo.recomendacoesPrioritarias.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2 p-2 sm:p-3 bg-base-200 rounded">
                        <span className="font-semibold text-primary text-xs sm:text-sm">{idx + 1}.</span>
                        <span className="text-xs sm:text-sm flex-1">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2 text-sm sm:text-base">Risco Geral</h3>
                    <div className={`badge badge-md sm:badge-lg ${getRiscoColor(resumoExecutivo.riscoGeral)}`}>
                      {getRiscoLabel(resumoExecutivo.riscoGeral)}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2 text-sm sm:text-base">Tendências Identificadas</h3>
                    <ul className="space-y-1.5">
                      {resumoExecutivo.tendencias.map((tendencia, idx) => (
                        <li key={idx} className="text-xs sm:text-sm flex items-start gap-2">
                          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0 mt-0.5" />
                          <span>{tendencia}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-base-content/60">
                <Sparkles className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Gere o resumo executivo para ver a análise (consome créditos).</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {fotoModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="modal modal-open flex items-center justify-center p-4"
            style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
          >
            <button
              type="button"
              className="bg-black/60"
              style={{ position: 'absolute', inset: 0 }}
              onClick={() => setFotoModal(null)}
              aria-label="Fechar"
            />
            <div
              className="modal-box max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col p-0 bg-base-100 relative z-10"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Foto em tamanho maior"
            >
              <div className="flex justify-end p-2 border-b border-base-300">
                <button
                  type="button"
                  onClick={() => setFotoModal(null)}
                  className="btn btn-ghost btn-sm btn-circle"
                  aria-label="Fechar"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <img
                  src={fotoModal.url}
                  alt="Foto em tamanho maior"
                  className="w-full h-auto max-h-[70vh] object-contain mx-auto rounded"
                />
                {fotoModal.exif && Object.keys(fotoModal.exif).length > 0 && (
                  <div className="mt-4 border-t border-base-300 pt-4">
                    <h4 className="text-sm font-semibold text-base-content/80 mb-2">Metadados EXIF (auditoria)</h4>
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      {Object.entries(fotoModal.exif).map(([key, value]) => {
                        if (value === null || value === undefined) return null;
                        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
                        const display = typeof value === 'object' ? JSON.stringify(value) : String(value);
                        return (
                          <div key={key} className="flex gap-2">
                            <dt className="text-base-content/60 shrink-0">{label}:</dt>
                            <dd className="break-all">{display}</dd>
                          </div>
                        );
                      })}
                    </dl>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </AppLayout>
  );
}

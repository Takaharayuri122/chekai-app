import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Building2, MapPin, Sparkles, FileDown, TrendingUp,
  CheckCircle2, XCircle, AlertTriangle, CloudOff,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AuditoriaRepo, type AuditoriaCompleta, type AuditoriaHistoricoLocal,
} from '../../../../src/db/repositories/auditoria.repo';
import { AuditoriaItemRepo, type AuditoriaItemCompleto } from '../../../../src/db/repositories/auditoria-item.repo';
import { SyncService } from '../../../../src/sync/SyncService';
import {
  getResumoExecutivo, getHistoricoUnidade, baixarPdfAuditoria,
  type ResumoExecutivo, type RiscoGeral, type HistoricoUnidadeItem,
} from '../../../../src/api/auditoria.api';

const repo = new AuditoriaRepo();
const itemRepo = new AuditoriaItemRepo();

const RISCO_LABELS: Record<RiscoGeral, string> = {
  baixo: 'Baixo',
  medio: 'Médio',
  alto: 'Alto',
  critico: 'Crítico',
};

function corRisco(risco: RiscoGeral): string {
  if (risco === 'baixo') return '#059669';
  if (risco === 'medio') return '#d97706';
  return '#dc2626';
}

function parseResumo(raw: string | null): ResumoExecutivo | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ResumoExecutivo;
  } catch {
    return null;
  }
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

interface HistoricoView {
  id: string;
  dataFim: string | null;
  pontuacaoTotal: number | null;
  origem: 'remoto' | 'local';
}

function normalizarPontuacao(valor: number | string | null | undefined): number | null {
  if (valor == null) return null;
  const num = typeof valor === 'string' ? parseFloat(valor) : valor;
  return Number.isNaN(num) ? null : num;
}

export default function RelatorioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [auditoria, setAuditoria] = useState<AuditoriaCompleta | null>(null);
  const [itens, setItens] = useState<AuditoriaItemCompleto[]>([]);
  const [resumo, setResumo] = useState<ResumoExecutivo | null>(null);
  const [gerandoResumo, setGerandoResumo] = useState(false);
  const [resumoErro, setResumoErro] = useState<string | null>(null);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const [pdfErro, setPdfErro] = useState<string | null>(null);
  const [historico, setHistorico] = useState<HistoricoView[]>([]);
  const [historicoOffline, setHistoricoOffline] = useState(false);

  const carregar = useCallback(() => {
    if (!id) return;
    const aud = repo.findById(id);
    setAuditoria(aud);
    setItens(itemRepo.findByAuditoria(id));
    setResumo(parseResumo(aud?.resumoExecutivo ?? null));
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const carregarHistorico = useCallback(async () => {
    if (!auditoria) return;
    const fallbackLocal = (): void => {
      const local: AuditoriaHistoricoLocal[] = repo.findHistoricoLocalByUnidade(auditoria.unidadeId);
      setHistorico(
        local.map(h => ({
          id: h.id,
          dataFim: h.dataFim ?? h.dataInicio,
          pontuacaoTotal: h.pontuacaoTotal,
          origem: 'local' as const,
        })),
      );
      setHistoricoOffline(true);
    };
    const online = await SyncService.isOnline();
    if (!online || !auditoria.remoteId) {
      fallbackLocal();
      return;
    }
    try {
      const remoto: HistoricoUnidadeItem[] = await getHistoricoUnidade(auditoria.unidadeId);
      setHistorico(
        remoto.map(h => ({
          id: h.id,
          dataFim: h.dataFim ?? h.dataInicio ?? null,
          pontuacaoTotal: normalizarPontuacao(h.pontuacaoTotal),
          origem: 'remoto' as const,
        })),
      );
      setHistoricoOffline(false);
    } catch {
      fallbackLocal();
    }
  }, [auditoria]);

  useEffect(() => {
    void carregarHistorico();
  }, [carregarHistorico]);

  const metricas = useMemo(() => {
    const pontuacaoTotal = itens.reduce((s, i) => s + i.pontuacao, 0);
    const pontuacaoMaxima = itens.reduce((s, i) => s + i.pontuacaoMaxima, 0);
    const pct = pontuacaoMaxima > 0 ? Math.round((pontuacaoTotal / pontuacaoMaxima) * 100) : 0;
    const ncs = itens.filter(i => i.resposta === 'nao_conforme').length;
    return { pontuacaoTotal, pontuacaoMaxima, pct, ncs };
  }, [itens]);

  const handleGerarResumo = async (): Promise<void> => {
    if (!auditoria?.remoteId) return;
    setGerandoResumo(true);
    setResumoErro(null);
    try {
      const online = await SyncService.isOnline();
      if (!online) {
        setResumoErro('É necessário estar online para gerar o resumo executivo.');
        return;
      }
      const gerado = await getResumoExecutivo(auditoria.remoteId);
      repo.updateResumoExecutivo(auditoria.id, JSON.stringify(gerado));
      setResumo(gerado);
    } catch (e) {
      setResumoErro(e instanceof Error ? e.message : 'Erro ao gerar resumo executivo.');
    } finally {
      setGerandoResumo(false);
    }
  };

  const abrirArquivo = async (uri: string): Promise<void> => {
    const disponivel = await Sharing.isAvailableAsync();
    if (!disponivel) {
      setPdfErro('Não há um visualizador de PDF disponível neste dispositivo.');
      return;
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Relatório da auditoria',
    });
  };

  const handleAbrirPdf = async (): Promise<void> => {
    if (!auditoria?.remoteId) return;
    setBaixandoPdf(true);
    setPdfErro(null);
    try {
      if (auditoria.pdfLocalPath) {
        const info = await FileSystem.getInfoAsync(auditoria.pdfLocalPath);
        if (info.exists) {
          await abrirArquivo(auditoria.pdfLocalPath);
          return;
        }
      }
      const online = await SyncService.isOnline();
      if (!online) {
        setPdfErro('É necessário estar online para baixar o PDF na primeira vez.');
        return;
      }
      const destino = `${FileSystem.documentDirectory}relatorio-auditoria-${auditoria.remoteId}.pdf`;
      const uri = await baixarPdfAuditoria(auditoria.remoteId, destino);
      repo.updatePdfLocalPath(auditoria.id, uri);
      setAuditoria(prev => (prev ? { ...prev, pdfLocalPath: uri } : prev));
      await abrirArquivo(uri);
    } catch (e) {
      setPdfErro(e instanceof Error ? e.message : 'Erro ao abrir o PDF.');
    } finally {
      setBaixandoPdf(false);
    }
  };

  if (!auditoria) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200">
        <ActivityIndicator color="#00B8A9" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-base-200">
      <View className="bg-neutral px-4 py-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft color="white" size={22} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white font-semibold text-base">Relatório da auditoria</Text>
            <View className="mt-1 gap-0.5">
              <View className="flex-row items-center gap-1.5">
                <Building2 size={12} color="#d1d5db" />
                <Text className="text-gray-300 text-xs flex-1" numberOfLines={1}>
                  {auditoria.clienteNome}
                </Text>
              </View>
              <View className="flex-row items-center gap-1.5">
                <MapPin size={12} color="#d1d5db" />
                <Text className="text-gray-300 text-xs flex-1" numberOfLines={1}>
                  {auditoria.unidadeNome}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <View className="items-center">
            <View className="w-28 h-28 rounded-full border-8 border-primary/20 items-center justify-center mb-3">
              <Text className="text-4xl font-bold text-primary">{metricas.pct}%</Text>
            </View>
            <Text className="text-lg font-semibold text-neutral">Pontuação geral</Text>
            <Text className="text-gray-500 mt-1">
              {auditoria.pontuacaoTotal ?? metricas.pontuacaoTotal} / {metricas.pontuacaoMaxima} pontos
            </Text>
          </View>
          <View className="flex-row mt-5 pt-4 border-t border-gray-100">
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-neutral">{itens.length}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">Itens</Text>
            </View>
            <View className="w-px bg-gray-200" />
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-red-600">{metricas.ncs}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">Não conformes</Text>
            </View>
          </View>
        </View>

        <View className="bg-white rounded-2xl p-4 border border-gray-100">
          <View className="flex-row items-center gap-2 mb-2">
            <FileDown size={18} color="#374151" />
            <Text className="font-semibold text-neutral flex-1">Relatório em PDF</Text>
          </View>
          <Text className="text-xs text-gray-500 mb-3">
            Baixe o relatório completo da auditoria. Após baixado, pode ser aberto offline.
          </Text>
          {pdfErro && (
            <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
              <Text className="text-red-700 text-sm">{pdfErro}</Text>
            </View>
          )}
          <TouchableOpacity
            onPress={handleAbrirPdf}
            disabled={baixandoPdf}
            className={`rounded-xl py-3.5 flex-row items-center justify-center gap-2 ${baixandoPdf ? 'bg-gray-400' : 'bg-primary'}`}
            activeOpacity={0.85}
          >
            {baixandoPdf ? (
              <>
                <ActivityIndicator color="white" size="small" />
                <Text className="text-white font-semibold">Preparando PDF...</Text>
              </>
            ) : (
              <>
                <FileDown size={18} color="white" />
                <Text className="text-white font-bold">
                  {auditoria.pdfLocalPath ? 'Abrir PDF' : 'Baixar e abrir PDF'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-2xl p-4 border border-gray-100">
          <View className="flex-row items-center gap-2 mb-2">
            <Sparkles size={18} color="#0f766e" />
            <Text className="font-semibold text-neutral flex-1">Resumo executivo (IA)</Text>
          </View>
          {resumoErro && (
            <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
              <Text className="text-red-700 text-sm">{resumoErro}</Text>
            </View>
          )}
          {resumo ? (
            <View className="gap-4">
              <View>
                <Text className="text-sm text-gray-700 leading-5">{resumo.resumo}</Text>
              </View>
              {resumo.pontosFortes.length > 0 && (
                <View>
                  <Text className="font-semibold text-emerald-700 text-sm mb-1.5">Pontos fortes</Text>
                  {resumo.pontosFortes.map((p, idx) => (
                    <View key={`pf-${idx}`} className="flex-row items-start gap-2 mb-1">
                      <CheckCircle2 size={14} color="#059669" style={{ marginTop: 2 }} />
                      <Text className="text-sm text-gray-700 flex-1">{p}</Text>
                    </View>
                  ))}
                </View>
              )}
              {resumo.pontosFracos.length > 0 && (
                <View>
                  <Text className="font-semibold text-red-700 text-sm mb-1.5">Pontos fracos</Text>
                  {resumo.pontosFracos.map((p, idx) => (
                    <View key={`pfr-${idx}`} className="flex-row items-start gap-2 mb-1">
                      <XCircle size={14} color="#dc2626" style={{ marginTop: 2 }} />
                      <Text className="text-sm text-gray-700 flex-1">{p}</Text>
                    </View>
                  ))}
                </View>
              )}
              {resumo.recomendacoesPrioritarias.length > 0 && (
                <View>
                  <Text className="font-semibold text-neutral text-sm mb-1.5">Recomendações prioritárias</Text>
                  {resumo.recomendacoesPrioritarias.map((r, idx) => (
                    <View key={`rec-${idx}`} className="flex-row items-start gap-2 mb-1">
                      <Text className="text-primary font-bold text-sm">{idx + 1}.</Text>
                      <Text className="text-sm text-gray-700 flex-1">{r}</Text>
                    </View>
                  ))}
                </View>
              )}
              <View className="flex-row items-center gap-2">
                <Text className="font-semibold text-neutral text-sm">Risco geral:</Text>
                <View
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: `${corRisco(resumo.riscoGeral)}1A` }}
                >
                  <Text className="text-sm font-semibold" style={{ color: corRisco(resumo.riscoGeral) }}>
                    {RISCO_LABELS[resumo.riscoGeral] ?? resumo.riscoGeral}
                  </Text>
                </View>
              </View>
              {resumo.tendencias.length > 0 && (
                <View>
                  <Text className="font-semibold text-neutral text-sm mb-1.5">Tendências</Text>
                  {resumo.tendencias.map((t, idx) => (
                    <View key={`tend-${idx}`} className="flex-row items-start gap-2 mb-1">
                      <TrendingUp size={14} color="#00B8A9" style={{ marginTop: 2 }} />
                      <Text className="text-sm text-gray-700 flex-1">{t}</Text>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity
                onPress={handleGerarResumo}
                disabled={gerandoResumo}
                className="border border-primary rounded-xl py-2.5 items-center mt-1"
                activeOpacity={0.85}
              >
                {gerandoResumo ? (
                  <ActivityIndicator color="#00B8A9" size="small" />
                ) : (
                  <Text className="text-primary font-semibold text-sm">Gerar novamente</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View className="items-center py-4">
              <Text className="text-sm text-gray-500 text-center mb-3">
                Gere o resumo executivo por IA. Requer conexão e consome créditos do gestor.
              </Text>
              <TouchableOpacity
                onPress={handleGerarResumo}
                disabled={gerandoResumo}
                className={`rounded-xl py-3 px-6 flex-row items-center justify-center gap-2 ${gerandoResumo ? 'bg-gray-400' : 'bg-teal-700'}`}
                activeOpacity={0.85}
              >
                {gerandoResumo ? (
                  <>
                    <ActivityIndicator color="white" size="small" />
                    <Text className="text-white font-semibold">Gerando...</Text>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} color="white" />
                    <Text className="text-white font-bold">Gerar resumo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View className="bg-white rounded-2xl p-4 border border-gray-100">
          <View className="flex-row items-center gap-2 mb-3">
            <TrendingUp size={18} color="#374151" />
            <Text className="font-semibold text-neutral flex-1">Histórico da unidade</Text>
            {historicoOffline && (
              <View className="flex-row items-center gap-1">
                <CloudOff size={12} color="#d97706" />
                <Text className="text-xs text-amber-600">offline</Text>
              </View>
            )}
          </View>
          {historico.length === 0 ? (
            <Text className="text-sm text-gray-400 py-2">Sem auditorias finalizadas anteriores.</Text>
          ) : (
            historico.map((h) => {
              const atual = h.id === auditoria.id || h.id === auditoria.remoteId;
              return (
                <View
                  key={h.id}
                  className={`flex-row items-center justify-between py-2.5 border-b border-gray-100 last:border-b-0 ${atual ? 'bg-primary/5 -mx-2 px-2 rounded-lg' : ''}`}
                >
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm text-gray-700">{formatarData(h.dataFim)}</Text>
                    {atual && (
                      <View className="bg-primary/10 px-2 py-0.5 rounded-full">
                        <Text className="text-xs text-primary font-medium">atual</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-sm font-bold text-primary">
                    {h.pontuacaoTotal != null ? `${h.pontuacaoTotal} pts` : '—'}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

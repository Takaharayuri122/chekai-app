import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useMemo, useEffect } from 'react';
import {
  ArrowLeft, Building2, MapPin, CheckCircle2, CloudOff, AlertTriangle,
  FileText, Sparkles, Send,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuditoriaStore } from '../../../../src/store/auditoria';
import { pushAuditoria, enqueuePush, type PushEtapa } from '../../../../src/sync/push';
import { SyncService } from '../../../../src/sync/SyncService';
import { getDatabase } from '../../../../src/db/client';

function calcularProgressoSync(etapa: PushEtapa | null, detalhe: string | null): number {
  if (!etapa) return 0;
  if (etapa === 'concluido') return 100;
  if (etapa === 'criando') return 12;
  if (etapa === 'finalizando') return 94;
  if (etapa === 'itens') {
    const m = detalhe?.match(/(\d+)\/(\d+)\s*respostas/);
    if (m && parseInt(m[2], 10) > 0) {
      return 12 + (parseInt(m[1], 10) / parseInt(m[2], 10)) * 28;
    }
    return 18;
  }
  if (etapa === 'fotos') {
    const m = detalhe?.match(/(\d+)\/(\d+)\s*fotos/);
    if (m) {
      const cur = parseInt(m[1], 10);
      const tot = parseInt(m[2], 10);
      if (tot === 0) return 88;
      return 40 + (cur / tot) * 48;
    }
    return 45;
  }
  return 5;
}

function textoEtapaSync(etapa: PushEtapa | null, detalhe: string | null): string {
  if (!etapa) return 'Preparando envio...';
  switch (etapa) {
    case 'criando':
      return 'Criando auditoria no servidor...';
    case 'itens':
      return detalhe ? `Enviando respostas (${detalhe})` : 'Enviando respostas...';
    case 'fotos':
      if (detalhe === '0/0 fotos') return 'Sem fotos para enviar';
      return detalhe ? `Enviando fotos (${detalhe})` : 'Enviando fotos...';
    case 'finalizando':
      return 'Finalizando e gerando relatório...';
    case 'concluido':
      return 'Sincronização concluída!';
    default:
      return 'Sincronizando...';
  }
}

export default function ResumoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auditoria, itens, recarregar } = useAuditoriaStore();
  const insets = useSafeAreaInsets();

  const [assinatura, setAssinatura] = useState(auditoria?.assinaturaNome ?? '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(auditoria?.syncStatus === 'synced');
  const [envioOnline, setEnvioOnline] = useState<boolean | null>(
    auditoria?.syncStatus === 'synced' ? true : null,
  );
  const [sendError, setSendError] = useState<string | null>(null);
  const [etapaAtual, setEtapaAtual] = useState<PushEtapa | null>(null);
  const [detalheSync, setDetalheSync] = useState<string | null>(null);

  useEffect(() => {
    if (auditoria?.syncStatus === 'synced') {
      setSent(true);
      setEnvioOnline(true);
    }
  }, [auditoria?.syncStatus]);

  useEffect(() => {
    if (auditoria?.assinaturaNome && !assinatura) {
      setAssinatura(auditoria.assinaturaNome);
    }
  }, [auditoria?.assinaturaNome, assinatura]);

  const progressoSync = useMemo(
    () => calcularProgressoSync(etapaAtual, detalheSync),
    [etapaAtual, detalheSync],
  );

  const ncs = useMemo(() => itens.filter(i => i.resposta === 'nao_conforme'), [itens]);
  const pontuacaoTotal = useMemo(() => itens.reduce((s, i) => s + i.pontuacao, 0), [itens]);
  const pontuacaoMaxima = useMemo(() => itens.reduce((s, i) => s + i.pontuacaoMaxima, 0), [itens]);
  const pct = pontuacaoMaxima > 0 ? Math.round((pontuacaoTotal / pontuacaoMaxima) * 100) : 0;
  const respondidos = useMemo(() => itens.filter(i => i.resposta !== 'nao_avaliado').length, [itens]);

  const categorias = useMemo(() => {
    const map: Record<string, { respondidos: number; total: number }> = {};
    for (const i of itens) {
      const cat = i.categoria ?? 'Geral';
      if (!map[cat]) map[cat] = { respondidos: 0, total: 0 };
      map[cat].total++;
      if (i.resposta !== 'nao_avaliado') map[cat].respondidos++;
    }
    return Object.entries(map);
  }, [itens]);

  const onProgressSync = (etapa: PushEtapa, detalhe?: string) => {
    setEtapaAtual(etapa);
    setDetalheSync(detalhe ?? null);
  };

  const handleEnviar = async () => {
    setSending(true);
    setSendError(null);
    setEtapaAtual(null);
    setDetalheSync(null);
    try {
      if (assinatura.trim()) {
        getDatabase().runSync(
          'UPDATE auditorias SET assinatura_nome = ?, updated_at = ? WHERE id = ?',
          [assinatura.trim(), new Date().toISOString(), id!],
        );
      }
      const isOnline = await SyncService.isOnline();
      if (isOnline) {
        await pushAuditoria(id!, onProgressSync);
        recarregar();
        setSent(true);
        setEnvioOnline(true);
        setEtapaAtual('concluido');
        setDetalheSync(null);
      } else {
        enqueuePush(id!);
        setSent(true);
        setEnvioOnline(false);
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Erro ao enviar.');
    } finally {
      setSending(false);
    }
  };

  const voltarLista = () => {
    router.replace('/(app)/auditorias');
  };

  return (
    <View className="flex-1 bg-base-200">
      <View className="bg-neutral px-4 py-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft color="white" size={22} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white font-semibold text-base">Resumo da auditoria</Text>
            {auditoria && (
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
            )}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 24 + insets.bottom,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <View className="items-center">
            <View className="w-28 h-28 rounded-full border-8 border-primary/20 items-center justify-center mb-3">
              <Text className="text-4xl font-bold text-primary">{pct}%</Text>
            </View>
            <Text className="text-lg font-semibold text-neutral">Pontuação geral</Text>
            <Text className="text-gray-500 mt-1">
              {pontuacaoTotal} / {pontuacaoMaxima} pontos
            </Text>
          </View>
          <View className="flex-row mt-5 pt-4 border-t border-gray-100">
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-neutral">{respondidos}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">Respondidos</Text>
            </View>
            <View className="w-px bg-gray-200" />
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-red-600">{ncs.length}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">Não conformes</Text>
            </View>
            <View className="w-px bg-gray-200" />
            <View className="flex-1 items-center">
              <Text className="text-2xl font-bold text-neutral">{itens.length}</Text>
              <Text className="text-xs text-gray-500 mt-0.5">Itens</Text>
            </View>
          </View>
        </View>

        <View className="bg-white rounded-2xl p-4 border border-gray-100">
          <View className="flex-row items-center gap-2 mb-3">
            <FileText size={18} color="#374151" />
            <Text className="font-semibold text-neutral">Por categoria</Text>
          </View>
          {categorias.map(([cat, { respondidos: r, total }]) => {
            const catPct = total > 0 ? (r / total) * 100 : 0;
            return (
              <View key={cat} className="mb-3 last:mb-0">
                <View className="flex-row justify-between mb-1.5">
                  <Text className="text-sm text-gray-700 font-medium">{cat}</Text>
                  <Text className="text-sm text-gray-400">{r}/{total}</Text>
                </View>
                <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <View
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${catPct}%` }}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {ncs.length > 0 && (
          <View className="bg-white rounded-2xl p-4 border border-red-100">
            <View className="flex-row items-center gap-2 mb-3">
              <AlertTriangle size={18} color="#dc2626" />
              <Text className="font-semibold text-red-700">
                Não conformidades ({ncs.length})
              </Text>
            </View>
            {ncs.map(nc => (
              <View key={nc.id} className="border-l-4 border-red-400 pl-3 py-2 mb-2 last:mb-0 bg-red-50/50 rounded-r-lg">
                <Text className="text-sm text-neutral leading-5">{nc.descricao}</Text>
                {nc.criticidade && (
                  <Text className="text-xs text-red-600/80 mt-1 capitalize font-medium">
                    {nc.criticidade}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {auditoria?.analiseIa && (
          <View className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
            <View className="flex-row items-center gap-2 mb-2">
              <Sparkles size={18} color="#0f766e" />
              <Text className="font-semibold text-teal-900">Análise IA</Text>
            </View>
            <Text className="text-sm text-teal-800 leading-5">{auditoria.analiseIa}</Text>
          </View>
        )}

        {!sent && (
          <View className="bg-white rounded-2xl p-4 border border-gray-100">
            <Text className="text-sm font-medium text-gray-700 mb-2">Assinatura do responsável</Text>
            <TextInput
              className="border border-gray-200 rounded-xl px-4 py-3 text-base text-neutral bg-gray-50/50"
              style={{ lineHeight: 22 }}
              placeholder="Nome completo (opcional)"
              placeholderTextColor="#9CA3AF"
              value={assinatura}
              onChangeText={setAssinatura}
            />
          </View>
        )}

        {sending && (
          <View className="bg-white rounded-2xl p-4 border border-primary/20">
            <Text className="text-sm font-semibold text-neutral mb-1">
              {textoEtapaSync(etapaAtual, detalheSync)}
            </Text>
            <Text className="text-xs text-gray-500 mb-3">Não feche o aplicativo durante o envio.</Text>
            <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <View
                className="h-full bg-primary rounded-full"
                style={{ width: `${progressoSync}%` }}
              />
            </View>
            <Text className="text-xs text-gray-400 text-right mt-2">{Math.round(progressoSync)}%</Text>
          </View>
        )}

        {!sent ? (
          <View>
            {sendError && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3">
                <Text className="text-red-700 text-sm">{sendError}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={handleEnviar}
              disabled={sending}
              className={`rounded-2xl py-4 flex-row items-center justify-center gap-2 ${sending ? 'bg-gray-400' : 'bg-primary'}`}
              activeOpacity={0.85}
            >
              {sending ? (
                <>
                  <ActivityIndicator color="white" size="small" />
                  <Text className="text-white font-semibold">Sincronizando...</Text>
                </>
              ) : (
                <>
                  <Send size={20} color="white" />
                  <Text className="text-white font-bold text-base">Enviar e sincronizar</Text>
                </>
              )}
            </TouchableOpacity>
            <Text className="text-xs text-center text-gray-500 mt-3 px-2">
              Envia respostas, fotos e finaliza a auditoria no servidor. Offline, o envio fica na fila.
            </Text>
          </View>
        ) : (
          <View className="gap-3">
            {envioOnline && (
              <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                <View className="items-center">
                  <View className="w-14 h-14 rounded-full bg-emerald-100 items-center justify-center mb-3">
                    <CheckCircle2 size={32} color="#059669" />
                  </View>
                  <Text className="text-emerald-900 font-bold text-lg text-center">
                    Auditoria sincronizada
                  </Text>
                  <Text className="text-emerald-800/90 text-sm text-center mt-2 leading-5">
                    Respostas e fotos foram enviadas ao servidor com sucesso.
                  </Text>
                </View>
                <View className="mt-4 h-2.5 bg-emerald-200/80 rounded-full overflow-hidden">
                  <View className="h-full w-full bg-emerald-600 rounded-full" />
                </View>
              </View>
            )}
            {envioOnline === false && (
              <View className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <View className="items-center">
                  <View className="w-14 h-14 rounded-full bg-amber-100 items-center justify-center mb-3">
                    <CloudOff size={30} color="#d97706" />
                  </View>
                  <Text className="text-amber-900 font-bold text-lg text-center">
                    Guardado para envio
                  </Text>
                  <Text className="text-amber-900/85 text-sm text-center mt-2 leading-5">
                    Sem conexão no momento. A auditoria entrou na fila e será enviada automaticamente quando houver internet.
                  </Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              onPress={voltarLista}
              className="bg-white border-2 border-primary rounded-2xl py-4 items-center"
            >
              <Text className="text-primary font-bold text-base">Voltar para auditorias</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

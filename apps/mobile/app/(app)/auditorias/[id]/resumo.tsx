import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useAuditoriaStore } from '../../../../src/store/auditoria';
import { pushAuditoria, enqueuePush } from '../../../../src/sync/push';
import { SyncService } from '../../../../src/sync/SyncService';
import { getDatabase } from '../../../../src/db/client';

export default function ResumoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auditoria, itens } = useAuditoriaStore();

  const [assinatura, setAssinatura] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const ncs = useMemo(() => itens.filter(i => i.resposta === 'nao_conforme'), [itens]);
  const pontuacaoTotal = useMemo(() => itens.reduce((s, i) => s + i.pontuacao, 0), [itens]);
  const pontuacaoMaxima = useMemo(() => itens.reduce((s, i) => s + i.pontuacaoMaxima, 0), [itens]);
  const pct = pontuacaoMaxima > 0 ? Math.round((pontuacaoTotal / pontuacaoMaxima) * 100) : 0;

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

  const handleEnviar = async () => {
    setSending(true);
    setSendError(null);
    try {
      // Persist signature to local DB
      if (assinatura.trim()) {
        getDatabase().runSync(
          'UPDATE auditorias SET assinatura_nome = ?, updated_at = ? WHERE id = ?',
          [assinatura.trim(), new Date().toISOString(), id!]
        );
      }
      const isOnline = await SyncService.isOnline();
      if (isOnline) {
        await pushAuditoria(id!);
        setSent(true);
      } else {
        enqueuePush(id!);
        setSent(true); // optimistic: will sync when online
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Erro ao enviar.');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-base-200" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="bg-neutral px-4 py-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <Text className="text-white font-semibold">Resumo da Auditoria</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Score */}
        <View className="bg-white rounded-2xl p-6 items-center">
          <Text className="text-5xl font-bold text-primary">{pct}%</Text>
          <Text className="text-gray-500 mt-1">{pontuacaoTotal} / {pontuacaoMaxima} pontos</Text>
        </View>

        {/* Categorias */}
        <View className="bg-white rounded-2xl p-4 gap-3">
          <Text className="font-semibold text-neutral">Por categoria</Text>
          {categorias.map(([cat, { respondidos, total }]) => {
            const catPct = total > 0 ? (respondidos / total) * 100 : 0;
            return (
              <View key={cat}>
                <View className="flex-row justify-between mb-1">
                  <Text className="text-sm text-gray-600">{cat}</Text>
                  <Text className="text-sm text-gray-400">{respondidos}/{total}</Text>
                </View>
                <View className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <View className="h-full bg-primary rounded-full" style={{ width: `${catPct}%` }} />
                </View>
              </View>
            );
          })}
        </View>

        {/* NCs */}
        {ncs.length > 0 && (
          <View className="bg-white rounded-2xl p-4 gap-2">
            <Text className="font-semibold text-neutral text-red-600">
              Não Conformidades ({ncs.length})
            </Text>
            {ncs.map(nc => (
              <View key={nc.id} className="border-l-2 border-red-400 pl-3 py-1">
                <Text className="text-sm text-neutral">{nc.descricao}</Text>
                {nc.criticidade && (
                  <Text className="text-xs text-gray-400 mt-0.5 capitalize">{nc.criticidade}</Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* IA Analysis */}
        {auditoria?.analiseIa && (
          <View className="bg-teal-50 border border-teal-200 rounded-2xl p-4">
            <Text className="font-semibold text-teal-800 mb-2">🤖 Análise IA</Text>
            <Text className="text-sm text-teal-700">{auditoria.analiseIa}</Text>
          </View>
        )}

        {/* Assinatura */}
        <View className="bg-white rounded-2xl p-4">
          <Text className="text-sm font-medium text-gray-600 mb-2">Assinatura do responsável</Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-base text-neutral"
            style={{ lineHeight: 22 }}
            placeholder="Nome do responsável"
            placeholderTextColor="#9CA3AF"
            value={assinatura}
            onChangeText={setAssinatura}
          />
        </View>

        {/* Enviar */}
        {!sent ? (
          <View>
            {sendError && (
              <Text className="text-red-600 text-sm text-center mb-2">{sendError}</Text>
            )}
            <TouchableOpacity
              onPress={handleEnviar}
              disabled={sending}
              className={`rounded-xl py-4 items-center ${sending ? 'bg-gray-400' : 'bg-primary'}`}
            >
              {sending
                ? <ActivityIndicator color="white" />
                : <Text className="text-white font-bold text-base">Enviar Relatório</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View className="bg-green-50 border border-green-200 rounded-2xl p-4 items-center">
            <Text className="text-green-700 font-semibold">✓ Auditoria enviada com sucesso</Text>
            <TouchableOpacity
              onPress={() => router.replace('/(app)/auditorias')}
              className="mt-3"
            >
              <Text className="text-primary font-medium">Voltar para lista</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

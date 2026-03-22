import { View, Text, SectionList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { useAuditoriaStore } from '../../../../src/store/auditoria';
import { ChecklistProgress } from '../../../../src/components/auditoria/ChecklistProgress';
import { AuditoriaStatusBadge } from '../../../../src/components/auditoria/AuditoriaStatusBadge';
import type { AuditoriaItemCompleto } from '../../../../src/db/repositories/auditoria-item.repo';

const RESPOSTA_DOT: Record<string, string> = {
  conforme: '#16a34a',
  nao_conforme: '#dc2626',
  na: '#94a3b8',
  nao_avaliado: '#cbd5e1',
};

const RESPOSTA_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  conforme:     { label: 'C',   bg: '#dcfce7', text: '#16a34a' },
  nao_conforme: { label: 'NC',  bg: '#fee2e2', text: '#dc2626' },
  na:           { label: 'N/A', bg: '#f1f5f9', text: '#94a3b8' },
  nao_avaliado: { label: '—',   bg: '#f1f5f9', text: '#94a3b8' },
};

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { auditoria, itens, isLoading, error, iniciar, finalizar, limpar } = useAuditoriaStore();

  useEffect(() => {
    if (id) iniciar(id);
    return () => limpar();
  }, [id]);

  const respondidos = useMemo(() => itens.filter(i => i.resposta !== 'nao_avaliado').length, [itens]);

  const sections = useMemo(() => {
    const byCategoria: Record<string, AuditoriaItemCompleto[]> = {};
    for (const item of itens) {
      const cat = item.categoria ?? 'Geral';
      (byCategoria[cat] ??= []).push(item);
    }
    return Object.entries(byCategoria).map(([title, data]) => ({ title, data }));
  }, [itens]);

  const handleFinalizar = useCallback(() => {
    const pendentes = itens.filter(i => i.resposta === 'nao_avaliado').length;
    const doFinalize = () => {
      finalizar();
      router.replace({ pathname: '/(app)/auditorias/[id]/resumo', params: { id: id! } });
    };
    if (pendentes > 0) {
      Alert.alert(
        'Itens pendentes',
        `${pendentes} item(s) ainda não foram respondidos. Deseja finalizar assim mesmo?`,
        [{ text: 'Continuar', style: 'cancel' }, { text: 'Finalizar', onPress: doFinalize }]
      );
    } else {
      doFinalize();
    }
  }, [itens, finalizar, id]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200">
        <ActivityIndicator color="#00B8A9" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200 px-8">
        <Text className="text-red-600 text-base text-center mb-4">{error}</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-primary px-6 py-3 rounded-xl">
          <Text className="text-white font-semibold">Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-base-200" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="bg-neutral px-4 py-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white font-semibold text-sm" numberOfLines={1}>
            {auditoria?.clienteNome ?? '...'}
          </Text>
          <Text className="text-gray-400 text-xs" numberOfLines={1}>
            {auditoria?.unidadeNome ?? ''}
          </Text>
        </View>
        <AuditoriaStatusBadge status={auditoria?.status ?? 'rascunho'} />
      </View>

      <ChecklistProgress respondidos={respondidos} total={itens.length} />

      <SectionList
        sections={sections}
        keyExtractor={i => i.id}
        stickySectionHeadersEnabled
        renderSectionHeader={({ section: { title, data } }) => {
          const secRespondidos = data.filter(i => i.resposta !== 'nao_avaliado').length;
          return (
            <View className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex-row justify-between">
              <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</Text>
              <Text className="text-xs text-gray-400">{secRespondidos}/{data.length}</Text>
            </View>
          );
        }}
        renderItem={({ item }) => {
          const badge = RESPOSTA_BADGE[item.resposta] ?? RESPOSTA_BADGE.nao_avaliado;
          const dot = RESPOSTA_DOT[item.resposta] ?? RESPOSTA_DOT.nao_avaliado;
          return (
            <TouchableOpacity
              onPress={() => router.push({
                pathname: '/(app)/auditorias/[id]/item/[itemId]',
                params: { id: id!, itemId: item.id },
              })}
              className="bg-white px-4 py-3 border-b border-gray-50 flex-row items-center gap-3"
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, flexShrink: 0 }} />
              <Text className="flex-1 text-sm text-neutral" numberOfLines={2}>{item.descricao}</Text>
              <View style={{ backgroundColor: badge.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: badge.text, fontSize: 10, fontWeight: '700' }}>{badge.label}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      {/* Footer */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4">
        <TouchableOpacity
          onPress={handleFinalizar}
          className="bg-primary rounded-xl py-4 items-center"
        >
          <Text className="text-white font-bold text-base">Finalizar Auditoria</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

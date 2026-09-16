import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Plus, FileText } from 'lucide-react-native';
import { RelatorioTecnicoRepo, type RelatorioTecnicoListItem } from '../../../src/db/repositories/relatorio-tecnico.repo';
import { SyncService } from '../../../src/sync/SyncService';

const repo = new RelatorioTecnicoRepo();

type Filtro = 'todos' | 'rascunho' | 'finalizado';

function rotuloStatus(item: RelatorioTecnicoListItem): { texto: string; classe: string } {
  if (item.syncStatus === 'pending') {
    return { texto: 'Não sincronizado', classe: 'bg-amber-100 text-amber-700' };
  }
  if (item.status === 'finalizado') {
    return { texto: 'Finalizado', classe: 'bg-emerald-100 text-emerald-700' };
  }
  return { texto: 'Rascunho', classe: 'bg-gray-100 text-gray-600' };
}

export default function RelatoriosListScreen() {
  const [relatorios, setRelatorios] = useState<RelatorioTecnicoListItem[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    setRelatorios(repo.findAll());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await SyncService.sync(); } finally {
      load();
      setRefreshing(false);
    }
  };

  const filtrados = relatorios.filter((r) =>
    filtro === 'todos' ? true : r.status === filtro,
  );

  return (
    <View className="flex-1 bg-base-200">
      <View className="bg-white">
        <View className="px-4 pb-3 border-b border-gray-100">
          <Text className="text-xl font-bold text-neutral" style={{ fontFamily: 'Montserrat_700Bold' }}>
            Relatórios técnicos
          </Text>
        </View>
        <View className="flex-row border-b border-gray-100 px-4 gap-4">
          {(['todos', 'rascunho', 'finalizado'] as Filtro[]).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFiltro(f)}
              className={`py-3 border-b-2 ${filtro === f ? 'border-primary' : 'border-transparent'}`}
            >
              <Text className={`text-sm font-medium ${filtro === f ? 'text-primary' : 'text-gray-500'}`}>
                {f === 'todos' ? 'Todos' : f === 'rascunho' ? 'Rascunhos' : 'Finalizados'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={(r) => r.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00B8A9" />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          <View className="items-center py-16">
            <FileText color="#D1D5DB" size={48} />
            <Text className="text-gray-400 text-base mt-3">Nenhum relatório técnico</Text>
          </View>
        }
        renderItem={({ item: r }) => {
          const badge = rotuloStatus(r);
          return (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/(app)/relatorios/[id]', params: { id: r.id } })}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
            >
              <View className="flex-row justify-between items-start mb-1">
                <Text className="text-base font-semibold text-neutral flex-1 mr-2">{r.clienteNome}</Text>
                <View className={`rounded-full px-2.5 py-1 ${badge.classe.split(' ')[0]}`}>
                  <Text className={`text-[11px] font-semibold ${badge.classe.split(' ')[1]}`}>{badge.texto}</Text>
                </View>
              </View>
              {r.unidadeNome ? <Text className="text-sm text-gray-500">{r.unidadeNome}</Text> : null}
              {r.identificacao ? (
                <Text className="text-xs text-gray-400 mt-1" numberOfLines={1}>{r.identificacao}</Text>
              ) : null}
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        onPress={() => router.push('/(app)/relatorios/novo')}
        className="absolute bottom-6 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg"
      >
        <Plus color="white" size={24} />
      </TouchableOpacity>
    </View>
  );
}

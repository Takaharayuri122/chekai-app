import { View, Text, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Plus } from 'lucide-react-native';
import { AuditoriaRepo, type AuditoriaListItem } from '../../../src/db/repositories/auditoria.repo';
import { AuditoriaStatusBadge } from '../../../src/components/auditoria/AuditoriaStatusBadge';
import { SyncService } from '../../../src/sync/SyncService';

const repo = new AuditoriaRepo();

type Filtro = 'todas' | 'em_andamento' | 'concluida';

export default function AuditoriasListScreen() {
  const [auditorias, setAuditorias] = useState<AuditoriaListItem[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    const items = repo.findAll();
    console.log(`[AuditoriasScreen] Carregadas ${items.length} auditorias do banco local`);
    if (items.length > 0) {
      console.log(`[AuditoriasScreen] Primeira: id=${items[0].id}, status=${items[0].status}, sync=${items[0].syncStatus}`);
    }
    setAuditorias(items);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = async () => {
    setRefreshing(true);
    try { await SyncService.sync(); } finally {
      load();
      setRefreshing(false);
    }
  };

  const filtered = auditorias.filter(a =>
    filtro === 'todas' ? true : a.status === filtro
  );

  const effectiveStatus = (a: AuditoriaListItem): string =>
    a.syncStatus === 'pending' && a.status === 'concluida' ? 'pending_sync' : a.status;

  return (
    <View className="flex-1 bg-base-200">
      <View className="bg-white">
        <View className="px-4 pb-3 border-b border-gray-100">
          <Text className="text-xl font-bold text-neutral" style={{ fontFamily: 'Montserrat_700Bold' }}>
            Auditorias
          </Text>
        </View>
        <View className="flex-row border-b border-gray-100 px-4 gap-4">
        {(['todas', 'em_andamento', 'concluida'] as Filtro[]).map(f => (
          <TouchableOpacity
            key={f}
            onPress={() => setFiltro(f)}
            className={`py-3 border-b-2 ${filtro === f ? 'border-primary' : 'border-transparent'}`}
          >
            <Text className={`text-sm font-medium ${filtro === f ? 'text-primary' : 'text-gray-500'}`}>
              {f === 'todas' ? 'Todas' : f === 'em_andamento' ? 'Em andamento' : 'Concluídas'}
            </Text>
          </TouchableOpacity>
        ))}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={a => a.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00B8A9" />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-gray-400 text-base">Nenhuma auditoria encontrada</Text>
          </View>
        }
        renderItem={({ item: a }) => (
          <TouchableOpacity
            onPress={() => {
              const isSynced = a.status === 'concluida' && a.syncStatus === 'synced';
              router.push({
                pathname: '/(app)/auditorias/[id]/checklist',
                params: { id: a.id, ...(isSynced ? { readonly: '1' } : {}) },
              });
            }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100"
          >
            <View className="flex-row justify-between items-start mb-1">
              <Text className="text-base font-semibold text-neutral flex-1 mr-2">{a.clienteNome}</Text>
              <AuditoriaStatusBadge status={effectiveStatus(a)} />
            </View>
            <Text className="text-sm text-gray-500 mb-2">{a.unidadeNome}</Text>
            <View className="flex-row justify-between items-center">
              <Text className="text-xs text-gray-400">
                {a.dataInicio ? new Date(a.dataInicio).toLocaleDateString('pt-BR') : '—'}
              </Text>
              {a.pontuacaoTotal !== null && (
                <Text className="text-sm font-bold text-primary">{a.pontuacaoTotal} pts</Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push('/(app)/auditorias/nova')}
        className="absolute bottom-6 right-6 w-14 h-14 bg-primary rounded-full items-center justify-center shadow-lg"
      >
        <Plus color="white" size={24} />
      </TouchableOpacity>
    </View>
  );
}

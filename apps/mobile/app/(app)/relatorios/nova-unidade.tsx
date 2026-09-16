import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin } from 'lucide-react-native';
import { getDatabase } from '../../../src/db/client';
import { RelatorioTecnicoRepo } from '../../../src/db/repositories/relatorio-tecnico.repo';
import { gerarUUID } from '../../../src/utils/uuid';

interface UnidadeRow {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
}

function carregarUnidades(clienteId: string): UnidadeRow[] {
  const db = getDatabase();
  return db.getAllSync<UnidadeRow>(
    `SELECT id, nome, cidade, estado FROM unidades WHERE cliente_id = ? ORDER BY nome`,
    [clienteId],
  );
}

const repo = new RelatorioTecnicoRepo();

export default function NovaUnidadeRelatorioScreen() {
  const { clienteId } = useLocalSearchParams<{ clienteId: string }>();
  const unidades = useMemo(() => carregarUnidades(clienteId!), [clienteId]);

  const criarRascunho = (unidadeId: string): void => {
    const id = gerarUUID();
    repo.create({ id, clienteId: clienteId!, unidadeId });
    router.replace({ pathname: '/(app)/relatorios/[id]', params: { id } });
  };

  return (
    <SafeAreaView className="flex-1 bg-base-200" edges={['bottom']}>
      <FlatList
        data={unidades}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          <View className="items-center py-12 px-8">
            <MapPin color="#D1D5DB" size={48} />
            <Text className="text-base text-gray-400 text-center mt-3">
              Nenhuma unidade cadastrada para este cliente
            </Text>
          </View>
        }
        renderItem={({ item: u }) => (
          <TouchableOpacity
            onPress={() => criarRascunho(u.id)}
            className="bg-white rounded-xl p-4 border border-gray-100"
          >
            <Text className="font-semibold text-neutral">{u.nome}</Text>
            {(u.cidade || u.estado) ? (
              <Text className="text-xs text-gray-400 mt-0.5">
                {[u.cidade, u.estado].filter(Boolean).join(', ')}
              </Text>
            ) : null}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

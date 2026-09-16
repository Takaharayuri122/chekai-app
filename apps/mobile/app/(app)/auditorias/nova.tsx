import { View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Building2 } from 'lucide-react-native';
import { getDatabase } from '../../../src/db/client';

interface ClienteRow {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  totalUnidades: number;
}

function carregarClientes(): ClienteRow[] {
  const db = getDatabase();
  return db.getAllSync<ClienteRow>(
    `SELECT c.id, c.razao_social, c.nome_fantasia,
            COUNT(u.id) AS totalUnidades
     FROM clientes c
     LEFT JOIN unidades u ON u.cliente_id = c.id
     GROUP BY c.id
     ORDER BY c.razao_social`
  );
}

export default function NovaAuditoriaScreen() {
  const [busca, setBusca] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const clientes = useMemo(() => {
    try {
      return carregarClientes();
    } catch {
      setLoadError('Erro ao carregar clientes.');
      return [];
    }
  }, []);

  const filtrados = useMemo(
    () => clientes.filter(c => {
      const termo = busca.toLowerCase();
      return c.razao_social.toLowerCase().includes(termo) ||
        (c.nome_fantasia?.toLowerCase().includes(termo) ?? false);
    }),
    [clientes, busca]
  );

  if (loadError) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-red-600 text-center">{loadError}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-base-200" edges={['bottom']}>
      <View className="px-4 py-3 bg-white border-b border-gray-100">
        <TextInput
          className="bg-gray-100 rounded-xl px-4 py-2.5 text-base text-neutral"
          style={{ paddingVertical: 16, paddingHorizontal: 16, lineHeight: 0, fontFamily: 'Inter_400Regular' }}
          placeholder="Buscar cliente..."
          placeholderTextColor="#9CA3AF"
          value={busca}
          onChangeText={setBusca}
          autoFocus
        />
      </View>

      <FlatList
        data={filtrados}
        keyExtractor={c => c.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          <View className="items-center py-12 px-8">
            <Building2 color="#D1D5DB" size={48} />
            <Text className="text-base text-gray-400 text-center mt-3">
              Nenhum cliente encontrado
            </Text>
          </View>
        }
        renderItem={({ item: c }) => (
          <TouchableOpacity
            onPress={() => router.push({
              pathname: '/(app)/auditorias/nova-unidade',
              params: { clienteId: c.id },
            })}
            className="bg-white rounded-xl p-4 border border-gray-100"
          >
            <Text className="font-semibold text-neutral">
              {c.nome_fantasia || c.razao_social}
            </Text>
            {c.nome_fantasia && (
              <Text className="text-sm text-gray-500">{c.razao_social}</Text>
            )}
            <Text className="text-xs text-gray-400 mt-1">
              {c.totalUnidades} {c.totalUnidades === 1 ? 'unidade' : 'unidades'}
            </Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

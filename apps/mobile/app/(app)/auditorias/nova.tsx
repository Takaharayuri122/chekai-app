import { View, Text, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDatabase } from '../../../src/db/client';

interface UnidadeRow {
  id: string;
  nome: string;
  cliente_id: string;
  razao_social: string;
  cidade: string | null;
  estado: string | null;
}

function loadUnidades(): UnidadeRow[] {
  const db = getDatabase();
  return db.getAllSync<UnidadeRow>(
    `SELECT u.id, u.nome, u.cliente_id, c.razao_social, u.cidade, u.estado
     FROM unidades u
     JOIN clientes c ON c.id = u.cliente_id
     ORDER BY c.razao_social, u.nome`
  );
}

export default function NovaAuditoriaScreen() {
  const [busca, setBusca] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const unidades = useMemo(() => {
    try {
      return loadUnidades();
    } catch {
      setLoadError('Erro ao carregar estabelecimentos.');
      return [];
    }
  }, []);

  const filtradas = useMemo(
    () => unidades.filter(u =>
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.razao_social.toLowerCase().includes(busca.toLowerCase())
    ),
    [unidades, busca]
  );

  if (loadError) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-red-600 text-center">{loadError}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 pt-4 bg-base-200" edges={['bottom']}>
      <View className="px-4 py-3 bg-white border-b border-gray-100">
        <TextInput
          className="bg-gray-100 rounded-xl px-4 py-2.5 text-base text-neutral"
          style={{ paddingVertical: 16, paddingHorizontal: 16, lineHeight: 0, fontFamily: 'Inter_400Regular' }}
          placeholder="Buscar estabelecimento..."
          placeholderTextColor="#9CA3AF"
          value={busca}
          onChangeText={setBusca}
          autoFocus
        />
      </View>

      <FlatList
        data={filtradas}
        keyExtractor={u => u.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item: u }) => (
          <TouchableOpacity
            onPress={() => router.push({
              pathname: '/(app)/auditorias/nova-template',
              params: { unidadeId: u.id, clienteId: u.cliente_id },
            })}
            className="bg-white rounded-xl p-4 border border-gray-100"
          >
            <Text className="font-semibold text-neutral">{u.razao_social}</Text>
            <Text className="text-sm text-gray-500">{u.nome}</Text>
            {(u.cidade || u.estado) && (
              <Text className="text-xs text-gray-400 mt-0.5">
                {[u.cidade, u.estado].filter(Boolean).join(', ')}
              </Text>
            )}
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

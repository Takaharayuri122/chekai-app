import { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, Pressable, ScrollView, ActivityIndicator,
} from 'react-native';
import { MapPin, Navigation, Check, X, Building2 } from 'lucide-react-native';
import { getDatabase } from '../../db/client';
import { useGeolocalizacao } from '../../hooks/use-geolocalizacao';

interface PayloadIniciarCheckin {
  clienteId: string;
  unidadeId: string;
  latitude: number;
  longitude: number;
}

interface CheckinModalProps {
  visivel: boolean;
  carregando: boolean;
  onFechar: () => void;
  onConfirmar: (payload: PayloadIniciarCheckin) => Promise<void>;
}

interface ClienteOpcao {
  id: string;
  nome: string;
}

interface UnidadeOpcao {
  id: string;
  nome: string;
  clienteId: string;
}

function carregarClientesLocais(): ClienteOpcao[] {
  const db = getDatabase();
  return db.getAllSync<ClienteOpcao>(
    `SELECT id, COALESCE(NULLIF(nome_fantasia, ''), razao_social) AS nome
     FROM clientes ORDER BY nome`,
  );
}

function carregarUnidadesLocais(clienteId: string): UnidadeOpcao[] {
  const db = getDatabase();
  return db.getAllSync<UnidadeOpcao>(
    `SELECT id, nome, cliente_id AS clienteId FROM unidades WHERE cliente_id = ? ORDER BY nome`,
    [clienteId],
  );
}

/**
 * Modal de início de check-in: seleção de cliente e unidade (a partir do cache
 * local) e captura de geolocalização nativa (RN-CKI-007). A confirmação dispara o
 * check-in online; validações de unidade/gestor/"1 aberto" ocorrem no servidor.
 */
export function CheckinModal({ visivel, carregando, onFechar, onConfirmar }: CheckinModalProps) {
  const [clientes, setClientes] = useState<ClienteOpcao[]>([]);
  const [clienteId, setClienteId] = useState<string>('');
  const [unidadeId, setUnidadeId] = useState<string>('');
  const { coordenadas, erro, carregando: capturando, capturarLocalizacao, limpar } = useGeolocalizacao();

  useEffect(() => {
    if (!visivel) return;
    setClientes(carregarClientesLocais());
  }, [visivel]);

  const unidades = useMemo(
    () => (clienteId ? carregarUnidadesLocais(clienteId) : []),
    [clienteId],
  );

  const fechar = (): void => {
    setClienteId('');
    setUnidadeId('');
    limpar();
    onFechar();
  };

  const confirmar = async (): Promise<void> => {
    if (!clienteId || !unidadeId || !coordenadas) return;
    await onConfirmar({
      clienteId,
      unidadeId,
      latitude: coordenadas.latitude,
      longitude: coordenadas.longitude,
    });
    fechar();
  };

  const podeConfirmar = Boolean(clienteId && unidadeId && coordenadas && !carregando && !capturando);

  return (
    <Modal visible={visivel} transparent animationType="slide" onRequestClose={fechar}>
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl max-h-[88%]">
          <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
            <Text className="text-lg font-bold text-neutral" style={{ fontFamily: 'Montserrat_700Bold' }}>
              Iniciar Check-in
            </Text>
            <Pressable onPress={fechar} hitSlop={8}>
              <X size={22} color="#6B7280" />
            </Pressable>
          </View>

          <ScrollView className="px-5" contentContainerStyle={{ paddingVertical: 16, gap: 16 }}>
            <View className="gap-2">
              <Text className="text-sm font-sans-semibold text-neutral">Cliente</Text>
              {clientes.length === 0 ? (
                <View className="flex-row items-center gap-2 bg-amber-50 rounded-xl p-3">
                  <Building2 size={16} color="#B45309" />
                  <Text className="text-amber-700 text-sm flex-1">
                    Nenhum cliente disponível. Sincronize seus dados primeiro.
                  </Text>
                </View>
              ) : (
                <View className="gap-2">
                  {clientes.map((cliente) => (
                    <Pressable
                      key={cliente.id}
                      onPress={() => { setClienteId(cliente.id); setUnidadeId(''); }}
                      className={`flex-row items-center justify-between rounded-xl border px-4 py-3 ${
                        clienteId === cliente.id ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'
                      }`}
                    >
                      <Text className={`text-sm flex-1 mr-2 ${clienteId === cliente.id ? 'text-primary font-sans-semibold' : 'text-neutral'}`}>
                        {cliente.nome}
                      </Text>
                      {clienteId === cliente.id && <Check size={18} color="#00B8A9" />}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {clienteId ? (
              <View className="gap-2">
                <Text className="text-sm font-sans-semibold text-neutral">Unidade</Text>
                {unidades.length === 0 ? (
                  <Text className="text-sm text-gray-400">Nenhuma unidade para este cliente.</Text>
                ) : (
                  <View className="gap-2">
                    {unidades.map((unidade) => (
                      <Pressable
                        key={unidade.id}
                        onPress={() => setUnidadeId(unidade.id)}
                        className={`flex-row items-center justify-between rounded-xl border px-4 py-3 ${
                          unidadeId === unidade.id ? 'border-primary bg-primary/5' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <Text className={`text-sm flex-1 mr-2 ${unidadeId === unidade.id ? 'text-primary font-sans-semibold' : 'text-neutral'}`}>
                          {unidade.nome}
                        </Text>
                        {unidadeId === unidade.id && <Check size={18} color="#00B8A9" />}
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            <View className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1 mr-3">
                  <View className="rounded-full bg-primary/10 p-2">
                    <Navigation size={16} color="#00B8A9" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-sans-medium text-neutral">Geolocalização</Text>
                    <Text className="text-xs text-gray-500" numberOfLines={1}>
                      {coordenadas
                        ? `Lat ${coordenadas.latitude.toFixed(5)} · Lng ${coordenadas.longitude.toFixed(5)}`
                        : 'Ainda não capturada'}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => { void capturarLocalizacao(); }}
                  disabled={capturando || carregando}
                  className="flex-row items-center gap-1.5 rounded-lg bg-white border border-gray-200 px-3 py-2"
                >
                  {capturando
                    ? <ActivityIndicator size="small" color="#00B8A9" />
                    : <MapPin size={15} color="#00B8A9" />}
                  <Text className="text-xs font-sans-medium text-primary">
                    {coordenadas ? 'Atualizar' : 'Capturar'}
                  </Text>
                </Pressable>
              </View>
              {erro ? <Text className="mt-2 text-xs text-red-500">{erro}</Text> : null}
            </View>
          </ScrollView>

          <View className="flex-row gap-3 px-5 pt-3 pb-6 border-t border-gray-100">
            <Pressable
              onPress={fechar}
              disabled={carregando}
              className="flex-1 items-center justify-center rounded-xl border border-gray-200 py-3.5"
            >
              <Text className="text-sm font-sans-semibold text-gray-600">Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={() => { void confirmar(); }}
              disabled={!podeConfirmar}
              className={`flex-1 items-center justify-center rounded-xl py-3.5 ${podeConfirmar ? 'bg-primary' : 'bg-gray-300'}`}
            >
              {carregando
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text className="text-sm font-sans-semibold text-white">Confirmar Check-in</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

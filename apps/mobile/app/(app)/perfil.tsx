import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/store/auth';
import { AuthService } from '../../src/auth/AuthService';
import { TokenStorage } from '../../src/auth/TokenStorage';
import { buscarUsuario, atualizarPerfil } from '../../src/api/usuario.api';

const INPUT_STYLE = {
  paddingVertical: 14,
  paddingHorizontal: 16,
  lineHeight: 0,
  fontFamily: 'Inter_400Regular',
} as const;

export default function PerfilScreen() {
  const { user, setUser, logout } = useAuthStore();
  const [nome, setNome] = useState(user?.nome ?? '');
  const [telefone, setTelefone] = useState(user?.telefone ?? '');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOnline(!!state.isConnected);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    let ativo = true;
    setCarregando(true);
    buscarUsuario(user.id)
      .then((atual) => {
        if (!ativo) return;
        setNome(atual.nome ?? '');
        setTelefone(atual.telefone ?? '');
      })
      .catch(() => {
        // Sem conexão: mantém os dados já presentes no store local.
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [user?.id]);

  async function handleSalvar() {
    if (!user?.id) return;
    const nomeTratado = nome.trim();
    if (!nomeTratado) {
      Alert.alert('Nome obrigatório', 'Informe seu nome para salvar.');
      return;
    }
    if (!online) {
      Alert.alert('Sem conexão', 'A edição de perfil requer conexão com a internet.');
      return;
    }
    setSalvando(true);
    try {
      const atualizado = await atualizarPerfil(user.id, {
        nome: nomeTratado,
        telefone: telefone.trim(),
      });
      setUser(atualizado);
      await TokenStorage.setUser(atualizado);
      Alert.alert('Perfil atualizado', 'Seus dados foram salvos com sucesso.');
    } catch (error) {
      Alert.alert(
        'Não foi possível salvar',
        error instanceof Error ? error.message : 'Tente novamente mais tarde.',
      );
    } finally {
      setSalvando(false);
    }
  }

  async function handleLogout() {
    try {
      await AuthService.logout();
    } finally {
      logout();
      router.replace('/(auth)/login');
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView contentContainerStyle={{ padding: 24, gap: 24 }} keyboardShouldPersistTaps="handled">
        <View className="items-center gap-1">
          <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-2">
            <Text className="text-white font-sans-semibold text-3xl">
              {(nome || user?.nome || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="font-sans-semibold text-neutral text-lg">{nome || user?.nome}</Text>
          <Text className="font-sans text-gray-500">{user?.email}</Text>
        </View>

        <View className="gap-4">
          <Text className="font-sans-semibold text-neutral text-base">Meus dados</Text>

          <View className="gap-1.5">
            <Text className="font-sans-medium text-neutral text-sm">Nome</Text>
            <TextInput
              className="border border-gray-300 rounded-xl text-neutral text-base"
              style={INPUT_STYLE}
              placeholder="Seu nome"
              placeholderTextColor="#9CA3AF"
              value={nome}
              onChangeText={setNome}
              editable={!salvando}
            />
          </View>

          <View className="gap-1.5">
            <Text className="font-sans-medium text-neutral text-sm">Telefone</Text>
            <TextInput
              className="border border-gray-300 rounded-xl text-neutral text-base"
              style={INPUT_STYLE}
              placeholder="(11) 99999-8888"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              value={telefone}
              onChangeText={setTelefone}
              editable={!salvando}
            />
          </View>

          <View className="gap-1.5">
            <Text className="font-sans-medium text-neutral text-sm">E-mail</Text>
            <View className="border border-gray-200 rounded-xl bg-gray-50" style={INPUT_STYLE}>
              <Text className="font-sans text-gray-500 text-base">{user?.email}</Text>
            </View>
            <Text className="font-sans text-gray-400 text-xs">O e-mail não pode ser alterado.</Text>
          </View>

          {!online && (
            <Text className="font-sans text-error text-sm">
              Você está offline. Conecte-se para salvar alterações.
            </Text>
          )}

          <Pressable
            onPress={handleSalvar}
            disabled={salvando || carregando || !online}
            className="bg-primary rounded-xl py-4 items-center disabled:opacity-50"
          >
            {salvando ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-sans-semibold text-base">Salvar alterações</Text>
            )}
          </Pressable>
        </View>

        <Pressable
          onPress={handleLogout}
          className="border border-error rounded-xl py-4 items-center"
        >
          <Text className="text-error font-sans-semibold text-base">Sair da conta</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

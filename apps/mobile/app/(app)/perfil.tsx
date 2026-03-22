import { View, Text, Pressable } from 'react-native';
import { useAuthStore } from '../../src/store/auth';
import { AuthService } from '../../src/auth/AuthService';
import { router } from 'expo-router';

export default function PerfilScreen() {
  const { user, logout } = useAuthStore();

  async function handleLogout() {
    try {
      await AuthService.logout();
    } finally {
      logout();
      router.replace('/(auth)/login');
    }
  }

  return (
    <View className="flex-1 items-center justify-center gap-4">
      <Text className="font-sans-semibold text-neutral">{user?.nome ?? 'Usuário'}</Text>
      <Pressable onPress={handleLogout} className="bg-error px-6 py-3 rounded-lg">
        <Text className="text-white font-sans-medium">Sair</Text>
      </Pressable>
    </View>
  );
}

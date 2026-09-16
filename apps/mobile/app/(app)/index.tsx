import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Package, ChevronRight } from 'lucide-react-native';
import { useAuthStore } from '../../src/store/auth';
import { CheckinCard } from '../../src/components/checkin/CheckinCard';

export default function DashboardScreen() {
  const user = useAuthStore((s) => s.user);
  const podeVerPlanos = user?.perfil === 'gestor' || user?.perfil === 'master';
  return (
    <View className="flex-1 bg-base-200">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="font-display text-2xl text-neutral">chekAI</Text>
        <Text className="font-sans text-gray-500 mt-2">Dashboard — em breve</Text>
        <View className="w-full mt-8">
          <CheckinCard />
        </View>
        {podeVerPlanos && (
          <Pressable
            onPress={() => router.push('/(app)/planos')}
            className="mt-8 w-full flex-row items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4"
          >
            <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
              <Package color="#00B8A9" size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-sans-semibold text-neutral text-base">Plano e créditos</Text>
              <Text className="font-sans text-gray-500 text-sm">
                Limites, uso e saldo de IA
              </Text>
            </View>
            <ChevronRight color="#9CA3AF" size={20} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

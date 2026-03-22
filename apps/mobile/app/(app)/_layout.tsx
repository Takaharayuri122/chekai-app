import { Redirect, Tabs } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/store/auth';
import { Home, ClipboardList, FileText, User } from 'lucide-react-native';
import { OfflineBanner } from '../../src/components/OfflineBanner';

export default function AppLayout() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  // Aguardar hidratação do store antes de redirecionar
  // (evita race condition no primeiro acesso)
  if (!hasHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200">
        <ActivityIndicator color="#00B8A9" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <OfflineBanner />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#00B8A9',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#E5E7EB' },
          tabBarLabelStyle: { fontFamily: 'Inter_500Medium', fontSize: 11 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Dashboard',
            tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="auditorias"
          options={{
            title: 'Auditorias',
            tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="relatorios"
          options={{
            title: 'Relatórios',
            tabBarIcon: ({ color, size }) => <FileText color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="perfil"
          options={{
            title: 'Perfil',
            tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
          }}
        />
        {/* Onboarding: ocultar da tab bar e renderizar sem header */}
        <Tabs.Screen
          name="onboarding"
          options={{
            href: null,
            tabBarStyle: { display: 'none' },
            headerShown: false,
          }}
        />
        <Tabs.Screen name="auditorias/nova" options={{ href: null }} />
        <Tabs.Screen name="auditorias/nova-template" options={{ href: null }} />
        <Tabs.Screen name="auditorias/[id]" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}

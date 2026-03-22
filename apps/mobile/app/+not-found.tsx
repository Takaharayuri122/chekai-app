import { Link, Stack } from 'expo-router';
import { View, Text } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Página não encontrada' }} />
      <View className="flex-1 items-center justify-center">
        <Text className="font-display text-xl text-neutral">Tela não encontrada</Text>
        <Link href="/(app)" className="mt-4">
          <Text className="text-primary font-sans-medium">Voltar ao início</Text>
        </Link>
      </View>
    </>
  );
}

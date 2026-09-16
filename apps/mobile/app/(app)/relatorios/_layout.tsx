import { Stack } from 'expo-router';

export default function RelatoriosLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="novo"
        options={{ headerShown: true, title: 'Selecionar Cliente', headerBackTitle: '' }}
      />
      <Stack.Screen
        name="nova-unidade"
        options={{ headerShown: true, title: 'Selecionar Unidade', headerBackTitle: '' }}
      />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

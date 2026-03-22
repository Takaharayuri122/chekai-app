import { Stack } from 'expo-router';

export default function AuditoriaDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="checklist" />
      <Stack.Screen name="item/[itemId]" />
      <Stack.Screen name="resumo" />
    </Stack>
  );
}

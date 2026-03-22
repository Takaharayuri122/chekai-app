import { Stack } from 'expo-router';

export default function AuditoriasLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="nova"
        options={{ headerShown: true, title: 'Nova Auditoria', headerBackTitle: '' }}
      />
      <Stack.Screen
        name="nova-template"
        options={{ headerShown: true, title: 'Selecionar Template', headerBackTitle: '' }}
      />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

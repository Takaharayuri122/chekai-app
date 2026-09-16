import { Stack } from 'expo-router';

export default function AuditoriasLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="nova"
        options={{ headerShown: true, title: 'Selecionar Cliente', headerBackTitle: '' }}
      />
      <Stack.Screen
        name="nova-unidade"
        options={{ headerShown: true, title: 'Selecionar Unidade', headerBackTitle: '' }}
      />
      <Stack.Screen
        name="nova-template"
        options={{ headerShown: true, title: 'Selecionar Checklist', headerBackTitle: '' }}
      />
      <Stack.Screen name="[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

import { View, Text } from 'react-native';

type Status = 'rascunho' | 'em_andamento' | 'concluida' | 'pending_sync';

const CONFIG: Record<Status, { label: string; bg: string; text: string }> = {
  rascunho:     { label: 'Rascunho',      bg: 'bg-gray-100',   text: 'text-gray-600' },
  em_andamento: { label: 'Em andamento',  bg: 'bg-amber-100',  text: 'text-amber-700' },
  concluida:    { label: 'Concluída',     bg: 'bg-green-100',  text: 'text-green-700' },
  pending_sync: { label: 'Pendente sync', bg: 'bg-orange-100', text: 'text-orange-700' },
};

export function AuditoriaStatusBadge({ status }: { status: string }) {
  const cfg = CONFIG[status as Status] ?? CONFIG.rascunho;
  return (
    <View className={`px-2 py-0.5 rounded-full ${cfg.bg}`}>
      <Text className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</Text>
    </View>
  );
}

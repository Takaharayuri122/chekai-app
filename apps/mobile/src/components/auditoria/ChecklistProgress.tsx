import { View, Text } from 'react-native';

interface Props { respondidos: number; total: number; }

export function ChecklistProgress({ respondidos, total }: Props) {
  const pct = total === 0 ? 0 : Math.round((respondidos / total) * 100);
  return (
    <View className="px-4 py-2 bg-white border-b border-gray-100">
      <View className="h-1.5 bg-gray-200 rounded-full overflow-hidden mb-1">
        <View className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </View>
      <Text className="text-xs text-gray-500">
        {respondidos}/{total} respondidos · {pct}%
      </Text>
    </View>
  );
}

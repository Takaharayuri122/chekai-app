import { View, Text, Pressable } from 'react-native';
import { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  description: string;
  benefit: string;
  onAllow: () => void;
  onSkip?: () => void;
  allowLabel?: string;
}

export function PermissionStep({
  icon,
  title,
  description,
  benefit,
  onAllow,
  onSkip,
  allowLabel = 'Permitir',
}: Props) {
  return (
    <View className="flex-1 px-8 justify-center gap-6">
      <View className="items-center">{icon}</View>
      <View className="gap-2">
        <Text className="font-display text-2xl text-neutral text-center">{title}</Text>
        <Text className="font-sans text-gray-500 text-center leading-6">{description}</Text>
        <View className="bg-primary/10 rounded-xl p-4 mt-2">
          <Text className="font-sans-medium text-primary text-center text-sm">{benefit}</Text>
        </View>
      </View>
      <View className="gap-3 mt-4">
        <Pressable onPress={onAllow} className="bg-primary rounded-xl py-4 items-center">
          <Text className="text-white font-sans-semibold text-base">{allowLabel}</Text>
        </Pressable>
        {onSkip && (
          <Pressable onPress={onSkip} className="items-center py-2">
            <Text className="text-gray-400 font-sans text-sm">Agora não</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

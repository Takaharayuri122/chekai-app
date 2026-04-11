import { View, Text, Image, TouchableOpacity } from 'react-native';
import type { Foto } from '../../db/repositories/foto.repo';

interface Props {
  fotos: Foto[];
  onAdd?: () => void;
  onRemove?: (id: string) => void;
  obrigatoria?: boolean;
  maxFotos?: number;
}

export function FotoGrid({ fotos, onAdd, onRemove, obrigatoria = false, maxFotos = 10 }: Props) {
  const canAdd = !!onAdd && fotos.length < maxFotos;

  return (
    <View>
      {obrigatoria && fotos.length === 0 && (
        <Text className="text-xs text-red-600 mb-2">Foto obrigatoria para este item</Text>
      )}
      <View className="flex-row flex-wrap gap-2">
        {fotos.map((f) => (
          <View key={f.id} className="relative">
            <Image
              source={{ uri: f.filePath ?? f.url ?? undefined }}
              className="w-20 h-20 rounded-lg bg-gray-200"
            />
            {onRemove && (
              <TouchableOpacity
                onPress={() => onRemove(f.id)}
                className="absolute top-1 right-1 bg-black/50 rounded-full w-5 h-5 items-center justify-center"
              >
                <Text className="text-white text-xs">x</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
        {canAdd && (
          <TouchableOpacity
            onPress={onAdd}
            className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 items-center justify-center bg-gray-50"
          >
            <Text className="text-2xl text-gray-400">+</Text>
            <Text className="text-xs text-gray-400">Foto</Text>
          </TouchableOpacity>
        )}
      </View>
      {!onAdd && fotos.length === 0 && (
        <Text className="text-xs text-gray-400">Nenhuma foto registrada</Text>
      )}
    </View>
  );
}

import { useState } from 'react';
import {
  Modal, View, Text, Image, TouchableOpacity, Dimensions, FlatList,
  type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { X, Trash2 } from 'lucide-react-native';
import type { Foto } from '../../db/repositories/foto.repo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  fotos: Foto[];
  indiceInicial: number;
  visivel: boolean;
  onFechar: () => void;
  onRemover?: (id: string) => void;
}

export function FotoPreviewModal({ fotos, indiceInicial, visivel, onFechar, onRemover }: Props) {
  const [indiceAtual, setIndiceAtual] = useState(indiceInicial);

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const novoIndice = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setIndiceAtual(novoIndice);
  };

  const handleRemover = () => {
    const foto = fotos[indiceAtual];
    if (!foto || !onRemover) return;
    onRemover(foto.id);
    if (fotos.length <= 1) {
      onFechar();
    } else if (indiceAtual >= fotos.length - 1) {
      setIndiceAtual(Math.max(0, indiceAtual - 1));
    }
  };

  return (
    <Modal visible={visivel} animationType="fade" transparent statusBarTranslucent>
      <View className="flex-1 bg-black">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-14 pb-3">
          <TouchableOpacity onPress={onFechar} hitSlop={12}>
            <X color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white font-semibold text-sm">
            {fotos.length > 0 ? `${indiceAtual + 1} / ${fotos.length}` : ''}
          </Text>
          {onRemover ? (
            <TouchableOpacity onPress={handleRemover} hitSlop={12}>
              <Trash2 color="#ef4444" size={22} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 22 }} />
          )}
        </View>

        {/* Imagens */}
        <FlatList
          data={fotos}
          keyExtractor={(f) => f.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={indiceInicial}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          onMomentumScrollEnd={handleScroll}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_WIDTH }} className="flex-1 items-center justify-center px-2">
              <Image
                source={{ uri: item.filePath ?? item.url ?? undefined }}
                style={{ width: SCREEN_WIDTH - 16, height: '80%' }}
                resizeMode="contain"
              />
            </View>
          )}
        />

        {/* Indicadores */}
        {fotos.length > 1 && (
          <View className="flex-row items-center justify-center gap-1.5 pb-10">
            {fotos.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === indiceAtual ? 8 : 6,
                  height: i === indiceAtual ? 8 : 6,
                  borderRadius: 4,
                  backgroundColor: i === indiceAtual ? 'white' : 'rgba(255,255,255,0.4)',
                }}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

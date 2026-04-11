import { View, Text, TextInput, TouchableOpacity, ScrollView, useWindowDimensions } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Camera, AlertTriangle, FileText } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { FotoGrid } from './FotoGrid';
import { ItemCamposNc } from './ItemCamposNc';
import { FotoRepo } from '../../db/repositories/foto.repo';
import { getSugestaoIa } from '../../api/auditoria.api';
import type { AuditoriaItemCompleto } from '../../db/repositories/auditoria-item.repo';
import type { Foto } from '../../db/repositories/foto.repo';

const SWIPE_THRESHOLD = 120;
const SPRING_CONFIG = { damping: 18, stiffness: 200 };
const fotoRepo = new FotoRepo();

const CRITICIDADE_COR: Record<string, string> = {
  alta: '#dc2626',
  media: '#f59e0b',
  baixa: '#3b82f6',
};

export interface CardFormData {
  resposta: string;
  observacao: string;
  descricaoNc: string;
  planoAcao: string;
  descricaoIa?: string;
  planoAcaoSugerido?: string;
}

interface Props {
  item: AuditoriaItemCompleto;
  indice: number;
  total: number;
  onSalvarEAvancar: (dados: CardFormData) => void;
  isActive: boolean;
}

export function SwipeCard({ item, indice, total, onSalvarEAvancar, isActive }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const translateX = useSharedValue(0);

  const [resposta, setResposta] = useState(item.resposta ?? 'nao_avaliado');
  const [observacao, setObservacao] = useState(item.observacao ?? '');
  const [descricaoNc, setDescricaoNc] = useState(item.descricaoNaoConformidade ?? '');
  const [planoAcao, setPlanoAcao] = useState(item.planoAcaoFinal ?? '');
  const [fotos, setFotos] = useState<Foto[]>(() => fotoRepo.findByItem(item.id));
  const [loadingIa, setLoadingIa] = useState(false);
  const [descricaoIa, setDescricaoIa] = useState(item.descricaoIa ?? undefined);
  const [planoIa, setPlanoIa] = useState(item.planoAcaoSugerido ?? undefined);

  const isNc = resposta === 'nao_conforme';
  const criticidadeCor = item.criticidade ? CRITICIDADE_COR[item.criticidade] : undefined;

  useEffect(() => {
    if (resposta === 'nao_conforme' && !descricaoNc && !loadingIa && !descricaoIa) {
      setLoadingIa(true);
      getSugestaoIa(item.id, item.descricao)
        .then(({ descricao, planoAcao: pa }) => {
          setDescricaoIa(descricao);
          setPlanoIa(pa);
          if (!descricaoNc) setDescricaoNc(descricao);
          if (!planoAcao) setPlanoAcao(pa);
        })
        .catch(() => {})
        .finally(() => setLoadingIa(false));
    }
  }, [resposta]);

  const buildFormData = useCallback((respostaOverride?: string): CardFormData => ({
    resposta: respostaOverride ?? resposta,
    observacao,
    descricaoNc,
    planoAcao,
    descricaoIa,
    planoAcaoSugerido: planoIa,
  }), [resposta, observacao, descricaoNc, planoAcao, descricaoIa, planoIa]);

  const confirmarSwipe = useCallback((direcao: 'direita' | 'esquerda') => {
    const respostaSwipe = direcao === 'direita' ? 'conforme' : 'nao_conforme';
    onSalvarEAvancar(buildFormData(respostaSwipe));
  }, [buildFormData, onSalvarEAvancar]);

  const panGesture = Gesture.Pan()
    .enabled(isActive)
    .activeOffsetX([-20, 20])
    .failOffsetY([-10, 10])
    .onUpdate((e) => { translateX.value = e.translationX; })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(screenWidth + 100, { duration: 250 }, () => {
          runOnJS(confirmarSwipe)('direita');
        });
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-screenWidth - 100, { duration: 250 }, () => {
          runOnJS(confirmarSwipe)('esquerda');
        });
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value, [-screenWidth, 0, screenWidth], [-12, 0, 12], Extrapolation.CLAMP,
    );
    return { transform: [{ translateX: translateX.value }, { rotate: `${rotate}deg` }] };
  });

  const conformeOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const ncOverlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP),
  }));

  const handleSelectResposta = (v: string) => {
    setResposta(v);
  };

  const handleConfirmar = () => {
    onSalvarEAvancar(buildFormData());
  };

  const handleAddFoto = useCallback(async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (!result.canceled && result.assets[0]) {
      fotoRepo.add(item.id, result.assets[0].uri);
      setFotos(fotoRepo.findByItem(item.id));
    }
  }, [item.id]);

  const handleRemoveFoto = useCallback((fotoId: string) => {
    fotoRepo.remove(fotoId);
    setFotos(fotoRepo.findByItem(item.id));
  }, [item.id]);

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[cardStyle, { flex: 1 }]} className="px-4">
        <View className="flex-1 bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Overlays de swipe */}
          <Animated.View
            style={conformeOverlayStyle}
            className="absolute inset-0 z-10 items-center justify-center"
            pointerEvents="none"
          >
            <View className="absolute inset-0 bg-green-500/10 rounded-3xl" />
            <View className="border-4 border-green-500 rounded-2xl px-6 py-3 -rotate-12">
              <Text className="text-green-500 text-3xl font-black">CONFORME</Text>
            </View>
          </Animated.View>
          <Animated.View
            style={ncOverlayStyle}
            className="absolute inset-0 z-10 items-center justify-center"
            pointerEvents="none"
          >
            <View className="absolute inset-0 bg-red-500/10 rounded-3xl" />
            <View className="border-4 border-red-500 rounded-2xl px-6 py-3 rotate-12">
              <Text className="text-red-500 text-3xl font-black">NC</Text>
            </View>
          </Animated.View>

          <ScrollView
            className="flex-1"
            contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {/* Header: categoria + contador */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                {item.categoria && (
                  <View className="bg-primary/10 px-2.5 py-1 rounded-full">
                    <Text className="text-[10px] font-bold text-primary uppercase">{item.categoria}</Text>
                  </View>
                )}
                {criticidadeCor && (
                  <View className="flex-row items-center gap-1">
                    <AlertTriangle size={12} color={criticidadeCor} />
                    <Text style={{ color: criticidadeCor, fontSize: 10, fontWeight: '700' }}>
                      {item.criticidade}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-xs text-gray-400 font-medium">{indice + 1}/{total}</Text>
            </View>

            {/* Pergunta */}
            <Text className="text-lg font-semibold text-neutral leading-6">
              {item.descricao}
            </Text>

            {/* Indicadores de obrigatoriedade */}
            {(item.fotoObrigatoria || item.observacaoObrigatoria) && (
              <View className="flex-row gap-2">
                {item.fotoObrigatoria && (
                  <View className="flex-row items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg">
                    <Camera size={12} color="#d97706" />
                    <Text className="text-[10px] text-amber-700 font-medium">Foto obrigatória</Text>
                  </View>
                )}
                {item.observacaoObrigatoria && (
                  <View className="flex-row items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg">
                    <FileText size={12} color="#2563eb" />
                    <Text className="text-[10px] text-blue-700 font-medium">Obs. obrigatória</Text>
                  </View>
                )}
              </View>
            )}

            {/* Botões de resposta */}
            <View className="flex-row gap-2">
              {[
                { v: 'conforme',     label: '✓ Conforme',  activeBg: '#dcfce7', activeBorder: '#16a34a', activeText: '#16a34a' },
                { v: 'nao_conforme', label: '✗ NC',         activeBg: '#fee2e2', activeBorder: '#dc2626', activeText: '#dc2626' },
                { v: 'na',           label: 'N/A',          activeBg: '#f1f5f9', activeBorder: '#94a3b8', activeText: '#64748b' },
              ].map(({ v, label, activeBg, activeBorder, activeText }) => {
                const isSelected = resposta === v;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => handleSelectResposta(v)}
                    style={isSelected ? { backgroundColor: activeBg, borderColor: activeBorder, borderWidth: 2 } : { borderColor: '#e5e7eb', borderWidth: 2 }}
                    className="flex-1 py-3 rounded-xl items-center justify-center"
                  >
                    <Text
                      style={isSelected ? { color: activeText } : { color: '#9CA3AF' }}
                      className="text-sm font-bold"
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Campos NC inline */}
            {isNc && (
              <ItemCamposNc
                descricaoIa={descricaoIa}
                planoAcaoIa={planoIa}
                loadingIa={loadingIa}
                descricao={descricaoNc}
                planoAcao={planoAcao}
                onChange={(d, p) => { setDescricaoNc(d); setPlanoAcao(p); }}
              />
            )}

            {/* Observação */}
            <View>
              <Text className="text-sm font-medium text-gray-600 mb-1.5">
                Observação{item.observacaoObrigatoria ? ' *' : ''}
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-neutral min-h-[56px]"
                style={{ lineHeight: 20, textAlignVertical: 'top' }}
                multiline
                value={observacao}
                onChangeText={setObservacao}
                placeholder="Adicione uma observação..."
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {/* Fotos */}
            <View>
              <Text className="text-sm font-medium text-gray-600 mb-1.5">Fotos</Text>
              <FotoGrid
                fotos={fotos}
                onAdd={handleAddFoto}
                onRemove={handleRemoveFoto}
                obrigatoria={item.fotoObrigatoria}
              />
            </View>
          </ScrollView>

          {/* Footer com dicas de swipe + botão confirmar */}
          <View className="border-t border-gray-100 bg-white px-4 py-3 gap-2">
            {resposta !== 'nao_avaliado' && (
              <TouchableOpacity onPress={handleConfirmar} className="bg-primary rounded-xl py-3 items-center">
                <Text className="text-white font-bold text-sm">Confirmar e Avançar</Text>
              </TouchableOpacity>
            )}
            <View className="flex-row justify-between px-2">
              <Text className="text-[10px] text-red-400 font-semibold">← Deslize: NC</Text>
              <Text className="text-[10px] text-green-500 font-semibold">Deslize: Conforme →</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

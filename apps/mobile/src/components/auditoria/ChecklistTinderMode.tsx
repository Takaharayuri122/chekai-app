import { View, Text, TouchableOpacity } from 'react-native';
import { useState, useCallback, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { SwipeCard, type CardFormData } from './SwipeCard';
import type { AuditoriaItemCompleto } from '../../db/repositories/auditoria-item.repo';

interface Props {
  itens: AuditoriaItemCompleto[];
  onResponder: (itemId: string, resposta: string, extras?: {
    observacao?: string;
    descricaoNaoConformidade?: string;
    planoAcaoFinal?: string;
    descricaoIa?: string;
    planoAcaoSugerido?: string;
  }) => void;
  onFinalizar: () => void;
}

export function ChecklistTinderMode({ itens, onResponder, onFinalizar }: Props) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const primeiroPendente = itens.findIndex(i => i.resposta === 'nao_avaliado');
    return primeiroPendente >= 0 ? primeiroPendente : 0;
  });

  const currentItem = itens[currentIndex];
  const isLastItem = currentIndex >= itens.length - 1;
  const respondidos = useMemo(() => itens.filter(i => i.resposta !== 'nao_avaliado').length, [itens]);

  const avancar = useCallback(() => {
    if (!isLastItem) setCurrentIndex(prev => prev + 1);
  }, [isLastItem]);

  const voltar = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  }, [currentIndex]);

  const handleSalvarEAvancar = useCallback((dados: CardFormData) => {
    if (!currentItem) return;
    onResponder(currentItem.id, dados.resposta, {
      observacao: dados.observacao || undefined,
      descricaoNaoConformidade: dados.resposta === 'nao_conforme' ? (dados.descricaoNc || undefined) : undefined,
      planoAcaoFinal: dados.resposta === 'nao_conforme' ? (dados.planoAcao || undefined) : undefined,
      descricaoIa: dados.descricaoIa,
      planoAcaoSugerido: dados.planoAcaoSugerido,
    });
    if (!isLastItem) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentItem, isLastItem, onResponder]);

  if (!currentItem) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-gray-400 text-center">Nenhum item disponível</Text>
      </View>
    );
  }

  if (isLastItem && currentItem.resposta !== 'nao_avaliado' && respondidos === itens.length) {
    return (
      <View className="flex-1 items-center justify-center px-8 gap-6">
        <View className="bg-green-50 rounded-3xl p-8 items-center gap-3">
          <Text className="text-5xl">🎉</Text>
          <Text className="text-xl font-bold text-neutral text-center">Todos os itens respondidos!</Text>
          <Text className="text-sm text-gray-500 text-center">
            {respondidos}/{itens.length} itens concluídos
          </Text>
        </View>
        <TouchableOpacity onPress={onFinalizar} className="bg-primary rounded-xl py-4 px-8">
          <Text className="text-white font-bold text-base">Finalizar Auditoria</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View className="flex-1">
        {/* Progresso */}
        <View className="px-5 pt-3 pb-2">
          <View className="flex-row items-center justify-between mb-1.5">
            <Text className="text-xs text-gray-500 font-medium">
              {respondidos}/{itens.length} respondidos
            </Text>
            <Text className="text-xs text-gray-400">
              Item {currentIndex + 1} de {itens.length}
            </Text>
          </View>
          <View className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-full bg-primary rounded-full"
              style={{ width: `${itens.length === 0 ? 0 : (respondidos / itens.length) * 100}%` }}
            />
          </View>
        </View>

        {/* Card principal */}
        <SwipeCard
          key={currentItem.id}
          item={currentItem}
          indice={currentIndex}
          total={itens.length}
          onSalvarEAvancar={handleSalvarEAvancar}
          isActive
        />

        {/* Navegação prev/next */}
        <View className="px-5 pb-4 pt-2 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={voltar}
            disabled={currentIndex <= 0}
            className={`w-11 h-11 rounded-full items-center justify-center border-2
              ${currentIndex <= 0 ? 'border-gray-200 bg-gray-50' : 'border-gray-300 bg-white'}`}
          >
            <ChevronLeft size={18} color={currentIndex <= 0 ? '#D1D5DB' : '#6B7280'} />
          </TouchableOpacity>

          <Text className="text-xs text-gray-400">
            {currentItem.resposta !== 'nao_avaliado' ? 'Já respondido' : 'Pendente'}
          </Text>

          <TouchableOpacity
            onPress={avancar}
            disabled={isLastItem}
            className={`w-11 h-11 rounded-full items-center justify-center border-2
              ${isLastItem ? 'border-gray-200 bg-gray-50' : 'border-gray-300 bg-white'}`}
          >
            <ChevronRight size={18} color={isLastItem ? '#D1D5DB' : '#6B7280'} />
          </TouchableOpacity>
        </View>
      </View>
    </GestureHandlerRootView>
  );
}

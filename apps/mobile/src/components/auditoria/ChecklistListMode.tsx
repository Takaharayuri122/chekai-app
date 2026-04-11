import { View, Text, SectionList, TouchableOpacity } from 'react-native';
import { useState, useMemo, useCallback } from 'react';
import { router } from 'expo-router';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { Camera, FileText, AlertTriangle } from 'lucide-react-native';
import type { AuditoriaItemCompleto } from '../../db/repositories/auditoria-item.repo';
import type { FiltroChecklist } from './ChecklistFilterBar';

const RESPOSTA_DOT: Record<string, string> = {
  conforme: '#16a34a',
  nao_conforme: '#dc2626',
  na: '#94a3b8',
  nao_avaliado: '#cbd5e1',
};

const RESPOSTA_BADGE: Record<string, { label: string; bg: string; text: string }> = {
  conforme:     { label: 'C',   bg: '#dcfce7', text: '#16a34a' },
  nao_conforme: { label: 'NC',  bg: '#fee2e2', text: '#dc2626' },
  na:           { label: 'N/A', bg: '#f1f5f9', text: '#94a3b8' },
  nao_avaliado: { label: '—',   bg: '#f1f5f9', text: '#94a3b8' },
};

const CRITICIDADE_COR: Record<string, string> = {
  alta: '#dc2626',
  media: '#f59e0b',
  baixa: '#3b82f6',
};

interface Props {
  auditoriaId: string;
  itens: AuditoriaItemCompleto[];
  filtro: FiltroChecklist;
  isReadonly: boolean;
  onResponder: (itemId: string, resposta: string, pontuacao?: number) => void;
}

function requerDetalhes(item: AuditoriaItemCompleto, resposta: string): boolean {
  if (resposta === 'nao_conforme') return true;
  if (item.fotoObrigatoria) return true;
  if (item.observacaoObrigatoria) return true;
  if (item.tipoResposta !== 'padrao') return true;
  return false;
}

export function ChecklistListMode({ auditoriaId, itens, filtro, isReadonly, onResponder }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredItens = useMemo(() => {
    if (filtro === 'pendentes') return itens.filter(i => i.resposta === 'nao_avaliado');
    if (filtro === 'nao_conformes') return itens.filter(i => i.resposta === 'nao_conforme');
    return itens;
  }, [itens, filtro]);

  const sections = useMemo(() => {
    const byCategoria: Record<string, AuditoriaItemCompleto[]> = {};
    for (const item of filteredItens) {
      const cat = item.categoria ?? 'Geral';
      (byCategoria[cat] ??= []).push(item);
    }
    return Object.entries(byCategoria).map(([title, data]) => ({ title, data }));
  }, [filteredItens]);

  const handleTapItem = useCallback((item: AuditoriaItemCompleto) => {
    if (isReadonly || item.tipoResposta !== 'padrao') {
      router.push({
        pathname: '/(app)/auditorias/[id]/item/[itemId]',
        params: { id: auditoriaId, itemId: item.id, ...(isReadonly ? { readonly: '1' } : {}) },
      });
      return;
    }
    setExpandedId(prev => prev === item.id ? null : item.id);
  }, [auditoriaId, isReadonly]);

  const handleRespostaRapida = useCallback((item: AuditoriaItemCompleto, resposta: string) => {
    if (requerDetalhes(item, resposta)) {
      onResponder(item.id, resposta);
      router.push({
        pathname: '/(app)/auditorias/[id]/item/[itemId]',
        params: { id: auditoriaId, itemId: item.id },
      });
    } else {
      onResponder(item.id, resposta);
    }
    setExpandedId(null);
  }, [auditoriaId, onResponder]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={i => i.id}
      stickySectionHeadersEnabled
      renderSectionHeader={({ section: { title, data } }) => {
        const secRespondidos = data.filter(i => i.resposta !== 'nao_avaliado').length;
        return (
          <View className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex-row justify-between">
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide">{title}</Text>
            <Text className="text-xs text-gray-400">{secRespondidos}/{data.length}</Text>
          </View>
        );
      }}
      renderItem={({ item }) => {
        const badge = RESPOSTA_BADGE[item.resposta] ?? RESPOSTA_BADGE.nao_avaliado;
        const dot = RESPOSTA_DOT[item.resposta] ?? RESPOSTA_DOT.nao_avaliado;
        const isExpanded = expandedId === item.id;
        const criticidadeCor = item.criticidade ? CRITICIDADE_COR[item.criticidade] : undefined;

        return (
          <Animated.View layout={LinearTransition.duration(200)}>
            <TouchableOpacity
              onPress={() => handleTapItem(item)}
              className="bg-white px-4 py-3 border-b border-gray-50"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center gap-3">
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot, flexShrink: 0 }} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm text-neutral" numberOfLines={isExpanded ? undefined : 2}>
                    {item.descricao}
                  </Text>
                  <View className="flex-row items-center gap-2 mt-0.5">
                    {criticidadeCor && (
                      <View className="flex-row items-center gap-0.5">
                        <AlertTriangle size={10} color={criticidadeCor} />
                        <Text style={{ color: criticidadeCor, fontSize: 10, fontWeight: '600' }}>
                          {item.criticidade}
                        </Text>
                      </View>
                    )}
                    {item.fotoObrigatoria && <Camera size={10} color="#9CA3AF" />}
                    {item.observacaoObrigatoria && <FileText size={10} color="#9CA3AF" />}
                  </View>
                </View>
                <View style={{ backgroundColor: badge.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: badge.text, fontSize: 10, fontWeight: '700' }}>{badge.label}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {isExpanded && !isReadonly && (
              <Animated.View
                entering={FadeIn.duration(150)}
                exiting={FadeOut.duration(100)}
                className="bg-gray-50 px-4 py-3 flex-row gap-2 border-b border-gray-100"
              >
                {[
                  { v: 'conforme',     label: '✓ Conforme',   activeBg: 'bg-green-500', activeText: 'text-white' },
                  { v: 'nao_conforme', label: '✗ NC',          activeBg: 'bg-red-500',   activeText: 'text-white' },
                  { v: 'na',           label: 'N/A',           activeBg: 'bg-gray-500',  activeText: 'text-white' },
                ].map(({ v, label, activeBg, activeText }) => {
                  const isSelected = item.resposta === v;
                  return (
                    <TouchableOpacity
                      key={v}
                      onPress={() => handleRespostaRapida(item, v)}
                      className={`flex-1 py-2.5 rounded-xl items-center justify-center
                        ${isSelected ? activeBg : 'bg-white border border-gray-200'}`}
                    >
                      <Text className={`text-xs font-bold ${isSelected ? activeText : 'text-gray-500'}`}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity
                  onPress={() => {
                    setExpandedId(null);
                    router.push({
                      pathname: '/(app)/auditorias/[id]/item/[itemId]',
                      params: { id: auditoriaId, itemId: item.id },
                    });
                  }}
                  className="py-2.5 px-3 rounded-xl bg-white border border-gray-200 items-center justify-center"
                >
                  <Text className="text-xs font-bold text-primary">+</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>
        );
      }}
      contentContainerStyle={{ paddingBottom: 100 }}
      ListEmptyComponent={
        <View className="items-center py-16">
          <Text className="text-gray-400 text-base">Nenhum item encontrado</Text>
        </View>
      }
    />
  );
}

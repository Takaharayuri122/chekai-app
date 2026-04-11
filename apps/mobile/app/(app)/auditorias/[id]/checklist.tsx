import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useCallback, useState } from 'react';
import { ArrowLeft, List, Layers } from 'lucide-react-native';
import { MMKV } from 'react-native-mmkv';
import { useAuditoriaStore } from '../../../../src/store/auditoria';
import { ChecklistProgress } from '../../../../src/components/auditoria/ChecklistProgress';
import { AuditoriaStatusBadge } from '../../../../src/components/auditoria/AuditoriaStatusBadge';
import { ChecklistFilterBar, type FiltroChecklist } from '../../../../src/components/auditoria/ChecklistFilterBar';
import { ChecklistListMode } from '../../../../src/components/auditoria/ChecklistListMode';
import { ChecklistTinderMode } from '../../../../src/components/auditoria/ChecklistTinderMode';

type ModoChecklist = 'lista' | 'cards';

const storage = new MMKV({ id: 'checklist-prefs' });
const MODO_KEY = 'checklist-modo';

function getModoSalvo(): ModoChecklist {
  const salvo = storage.getString(MODO_KEY);
  return salvo === 'cards' ? 'cards' : 'lista';
}

export default function ChecklistScreen() {
  const { id, readonly: readonlyParam } = useLocalSearchParams<{ id: string; readonly?: string }>();
  const { auditoria, itens, isLoading, error, iniciar, carregar, finalizar, salvarResposta, limpar } = useAuditoriaStore();

  const isReadonly = readonlyParam === '1' || (auditoria?.status === 'concluida' && auditoria?.syncStatus === 'synced');

  const [modo, setModo] = useState<ModoChecklist>(getModoSalvo);
  const [filtro, setFiltro] = useState<FiltroChecklist>('todos');

  useEffect(() => {
    if (!id) return;
    if (readonlyParam === '1') {
      carregar(id);
    } else {
      iniciar(id);
    }
    return () => limpar();
  }, [id, readonlyParam, iniciar, carregar, limpar]);

  const respondidos = useMemo(() => itens.filter(i => i.resposta !== 'nao_avaliado').length, [itens]);

  const contadores = useMemo(() => ({
    todos: itens.length,
    pendentes: itens.filter(i => i.resposta === 'nao_avaliado').length,
    naoConformes: itens.filter(i => i.resposta === 'nao_conforme').length,
  }), [itens]);

  const handleToggleModo = useCallback(() => {
    const novoModo: ModoChecklist = modo === 'lista' ? 'cards' : 'lista';
    setModo(novoModo);
    storage.set(MODO_KEY, novoModo);
  }, [modo]);

  const handleFinalizar = useCallback(() => {
    const pendentes = itens.filter(i => i.resposta === 'nao_avaliado').length;
    const doFinalize = () => {
      finalizar();
      router.replace({ pathname: '/(app)/auditorias/[id]/resumo', params: { id: id! } });
    };
    if (pendentes > 0) {
      Alert.alert(
        'Itens pendentes',
        `${pendentes} item(s) ainda não foram respondidos. Deseja finalizar assim mesmo?`,
        [{ text: 'Continuar', style: 'cancel' }, { text: 'Finalizar', onPress: doFinalize }]
      );
    } else {
      doFinalize();
    }
  }, [itens, finalizar, id]);

  const handleResponderLista = useCallback((itemId: string, resposta: string) => {
    salvarResposta(itemId, { resposta });
  }, [salvarResposta]);

  const handleResponderTinder = useCallback((itemId: string, resposta: string, extras?: {
    observacao?: string;
    descricaoNaoConformidade?: string;
    planoAcaoFinal?: string;
    descricaoIa?: string;
    planoAcaoSugerido?: string;
  }) => {
    salvarResposta(itemId, { resposta, ...extras });
  }, [salvarResposta]);

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200">
        <ActivityIndicator color="#00B8A9" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200 px-8">
        <Text className="text-red-600 text-base text-center mb-4">{error}</Text>
        <TouchableOpacity onPress={() => router.back()} className="bg-primary px-6 py-3 rounded-xl">
          <Text className="text-white font-semibold">Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-base-200">
      {/* Header */}
      <View className="bg-neutral px-4 py-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-white font-semibold text-sm" numberOfLines={1}>
            {auditoria?.clienteNome ?? '...'}
          </Text>
          <Text className="text-gray-400 text-xs" numberOfLines={1}>
            {auditoria?.unidadeNome ?? ''}
          </Text>
        </View>
        {!isReadonly && (
          <TouchableOpacity onPress={handleToggleModo} className="p-1.5 rounded-lg bg-white/10 mr-1">
            {modo === 'lista'
              ? <Layers size={18} color="white" />
              : <List size={18} color="white" />}
          </TouchableOpacity>
        )}
        <AuditoriaStatusBadge status={auditoria?.status ?? 'rascunho'} />
      </View>

      {/* Modo Lista */}
      {modo === 'lista' && (
        <>
          <ChecklistProgress respondidos={respondidos} total={itens.length} />
          {!isReadonly && (
            <ChecklistFilterBar
              filtroAtual={filtro}
              onFiltroChange={setFiltro}
              contadores={contadores}
            />
          )}
          <ChecklistListMode
            auditoriaId={id!}
            itens={itens}
            filtro={filtro}
            isReadonly={isReadonly}
            onResponder={handleResponderLista}
          />
          {!isReadonly && (
            <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-4">
              <TouchableOpacity onPress={handleFinalizar} className="bg-primary rounded-xl py-4 items-center">
                <Text className="text-white font-bold text-base">Finalizar Auditoria</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* Modo Cards (Tinder) */}
      {modo === 'cards' && !isReadonly && (
        <ChecklistTinderMode
          itens={itens}
          onResponder={handleResponderTinder}
          onFinalizar={handleFinalizar}
        />
      )}
    </View>
  );
}

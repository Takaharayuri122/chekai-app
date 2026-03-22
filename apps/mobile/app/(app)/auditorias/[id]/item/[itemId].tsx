import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuditoriaStore } from '../../../../../src/store/auditoria';
import { FotoRepo } from '../../../../../src/db/repositories/foto.repo';
import { AuditoriaItemRepo } from '../../../../../src/db/repositories/auditoria-item.repo';
import { ItemRespostaButtons } from '../../../../../src/components/auditoria/ItemRespostaButtons';
import { ItemCamposNc } from '../../../../../src/components/auditoria/ItemCamposNc';
import { FotoGrid } from '../../../../../src/components/auditoria/FotoGrid';
import { getSugestaoIa } from '../../../../../src/api/auditoria.api';

const fotoRepo = new FotoRepo();
const itemRepo = new AuditoriaItemRepo();

export default function ItemScreen() {
  const { id, itemId } = useLocalSearchParams<{ id: string; itemId: string }>();
  const { itens, salvarResposta } = useAuditoriaStore();

  const item = itens.find(i => i.id === itemId);

  const [resposta, setResposta] = useState(item?.resposta ?? 'nao_avaliado');
  const [observacao, setObservacao] = useState(item?.observacao ?? '');
  const [descricaoNc, setDescricaoNc] = useState(item?.descricaoNaoConformidade ?? '');
  const [planoAcao, setPlanoAcao] = useState(item?.planoAcaoFinal ?? '');
  const [pontuacao, setPontuacao] = useState(item?.pontuacao ?? 0);
  const [fotos, setFotos] = useState(() => fotoRepo.findByItem(itemId!));
  const [loadingIa, setLoadingIa] = useState(false);
  const [descricaoIa, setDescricaoIa] = useState(item?.descricaoIa ?? undefined);
  const [planoIa, setPlanoIa] = useState(item?.planoAcaoSugerido ?? undefined);

  // Parse opcoes customizadas
  const opcoes = item?.opcoesRespostaConfig
    ? JSON.parse(item.opcoesRespostaConfig)
    : undefined;

  const handleSelectResposta = (v: string, pts?: number) => {
    setResposta(v);
    if (pts !== undefined) setPontuacao(pts);

    // IA: trigger on NC
    if (v === 'nao_conforme' && !descricaoNc && !loadingIa) {
      setLoadingIa(true);
      getSugestaoIa(itemId!, item?.descricao ?? '')
        .then(({ descricao, planoAcao: pa }) => {
          setDescricaoIa(descricao);
          setPlanoIa(pa);
          if (!descricaoNc) setDescricaoNc(descricao);
          if (!planoAcao) setPlanoAcao(pa);
        })
        .catch(() => { /* best-effort */ })
        .finally(() => setLoadingIa(false));
    }
  };

  const handleAddFoto = useCallback(async () => {
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      fotoRepo.add(itemId!, result.assets[0].uri);
      setFotos(fotoRepo.findByItem(itemId!));
    }
  }, [itemId]);

  const handleRemoveFoto = useCallback((fotoId: string) => {
    fotoRepo.remove(fotoId);
    setFotos(fotoRepo.findByItem(itemId!));
  }, [itemId]);

  const handleSalvar = () => {
    // Validate required fields
    if (item?.fotoObrigatoria && fotos.length === 0) {
      Alert.alert('Foto obrigatória', 'Adicione pelo menos uma foto para este item.');
      return;
    }
    if (item?.observacaoObrigatoria && !observacao.trim()) {
      Alert.alert('Observação obrigatória', 'Preencha a observação para este item.');
      return;
    }

    salvarResposta(itemId!, {
      resposta,
      observacao: observacao || undefined,
      descricaoNaoConformidade: resposta === 'nao_conforme' ? descricaoNc || undefined : undefined,
      planoAcaoFinal: resposta === 'nao_conforme' ? planoAcao || undefined : undefined,
      pontuacao,
      descricaoIa: descricaoIa,
      planoAcaoSugerido: planoIa,
    });
    router.back();
  };

  if (!item) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-gray-400">Item não encontrado</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top', 'bottom']}>
      {/* Header */}
      <View className="bg-neutral px-4 py-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <Text className="text-white font-semibold text-sm flex-1" numberOfLines={2}>
          {item.descricao}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Response buttons */}
        <ItemRespostaButtons
          tipo={item.tipoResposta as any}
          opcoes={opcoes}
          valorAtual={resposta === 'nao_avaliado' ? null : resposta}
          onSelect={handleSelectResposta}
        />

        {/* Observação */}
        <View>
          <Text className="text-sm font-medium text-gray-600 mb-2">
            Observação{item.observacaoObrigatoria ? ' *' : ''}
          </Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-base text-neutral min-h-[72px]"
            style={{ lineHeight: 22, textAlignVertical: 'top' }}
            multiline
            value={observacao}
            onChangeText={setObservacao}
            placeholder="Adicione uma observação..."
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Foto obrigatória warning */}
        {item.fotoObrigatoria && fotos.length === 0 && (
          <View className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex-row items-center gap-2">
            <Text className="text-orange-700 text-sm">📷 Foto obrigatória para este item</Text>
          </View>
        )}

        {/* NC fields */}
        {resposta === 'nao_conforme' && (
          <ItemCamposNc
            descricaoIa={descricaoIa}
            planoAcaoIa={planoIa}
            loadingIa={loadingIa}
            descricao={descricaoNc}
            planoAcao={planoAcao}
            onChange={(d, p) => { setDescricaoNc(d); setPlanoAcao(p); }}
          />
        )}

        {/* Fotos */}
        <View>
          <Text className="text-sm font-medium text-gray-600 mb-2">Fotos</Text>
          <FotoGrid
            fotos={fotos}
            onAdd={handleAddFoto}
            onRemove={handleRemoveFoto}
            obrigatoria={item.fotoObrigatoria}
          />
        </View>

        {/* Salvar button */}
        <TouchableOpacity
          onPress={handleSalvar}
          className="bg-primary rounded-xl py-4 items-center mt-4"
        >
          <Text className="text-white font-bold text-base">Salvar</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

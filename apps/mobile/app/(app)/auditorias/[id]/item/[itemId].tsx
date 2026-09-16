import {
  View, Text, ScrollView, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react-native';
import * as FileSystem from 'expo-file-system';
import { useAuditoriaStore } from '../../../../../src/store/auditoria';
import { FotoRepo } from '../../../../../src/db/repositories/foto.repo';
import { ItemRespostaButtons } from '../../../../../src/components/auditoria/ItemRespostaButtons';
import { ItemCamposNc } from '../../../../../src/components/auditoria/ItemCamposNc';
import { FotoGrid } from '../../../../../src/components/auditoria/FotoGrid';
import { getSugestaoIa, CreditoInsuficienteError } from '../../../../../src/api/ia.api';
import { abrirFotoPicker } from '../../../../../src/utils/foto-picker';

const fotoRepo = new FotoRepo();

export default function ItemScreen() {
  const { id, itemId, readonly: readonlyParam } = useLocalSearchParams<{ id: string; itemId: string; readonly?: string }>();
  const { itens, auditoria, salvarResposta } = useAuditoriaStore();
  const isReadonly = readonlyParam === '1' || (auditoria?.status === 'concluida' && auditoria?.syncStatus === 'synced');

  const item = itens.find(i => i.id === itemId);

  const [resposta, setResposta] = useState(item?.resposta ?? 'nao_avaliado');
  const [observacao, setObservacao] = useState(item?.observacao ?? '');
  const [descricaoNc, setDescricaoNc] = useState(item?.descricaoNaoConformidade ?? '');
  const [planoAcao, setPlanoAcao] = useState(item?.planoAcaoFinal ?? '');
  const [pontuacao, setPontuacao] = useState(item?.pontuacao ?? 0);
  const [fotos, setFotos] = useState(() => itemId ? fotoRepo.findByItem(itemId) : []);
  const [loadingIa, setLoadingIa] = useState(false);
  const [descricaoIa, setDescricaoIa] = useState(item?.descricaoIa ?? undefined);
  const [planoIa, setPlanoIa] = useState(item?.planoAcaoSugerido ?? undefined);
  const [referenciaLegal, setReferenciaLegal] = useState(item?.referenciaLegal ?? undefined);
  const [carregandoFoto, setCarregandoFoto] = useState(false);

  const opcoes = item?.opcoesRespostaConfig
    ? JSON.parse(item.opcoesRespostaConfig)
    : undefined;

  const handleSelectResposta = (v: string, pts?: number) => {
    setResposta(v);
    if (pts !== undefined) setPontuacao(pts);
    if (v === 'nao_conforme' && !descricaoNc && !loadingIa) {
      setLoadingIa(true);
      getSugestaoIa(item?.descricao ?? '')
        .then(({ descricao, planoAcao: pa, referenciaLegal: ref }) => {
          setDescricaoIa(descricao);
          setPlanoIa(pa);
          if (ref) setReferenciaLegal(ref);
          if (!descricaoNc) setDescricaoNc(descricao);
          if (!planoAcao) setPlanoAcao(pa);
        })
        .catch((e) => {
          if (e instanceof CreditoInsuficienteError) {
            Alert.alert('Créditos de IA esgotados', e.message);
          }
        })
        .finally(() => setLoadingIa(false));
    }
  };

  const handleAddFoto = useCallback(async () => {
    if (!itemId) return;
    setCarregandoFoto(true);
    try {
      const novasFotos = await abrirFotoPicker(fotos.length);
      for (const foto of novasFotos) {
        fotoRepo.add(itemId, foto.uri, foto.coords ?? undefined, foto.tamanhoBytes);
      }
      if (novasFotos.length > 0) {
        setFotos(fotoRepo.findByItem(itemId));
      }
    } finally {
      setCarregandoFoto(false);
    }
  }, [itemId, fotos.length]);

  const handleRemoveFoto = useCallback(async (fotoId: string) => {
    const foto = fotos.find(f => f.id === fotoId);
    fotoRepo.remove(fotoId);
    if (foto?.filePath) {
      FileSystem.deleteAsync(foto.filePath, { idempotent: true }).catch(() => {});
    }
    setFotos(fotoRepo.findByItem(itemId!));
  }, [itemId, fotos]);

  const handleSalvar = () => {
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
      referenciaLegal: resposta === 'nao_conforme' ? referenciaLegal : undefined,
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
    <View className="flex-1 bg-white">
      <View className="bg-neutral px-4 py-3 flex-row items-center gap-3">
        <TouchableOpacity onPress={() => router.back()}>
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <Text className="text-white font-semibold text-sm flex-1" numberOfLines={2}>
          {item.descricao}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <ItemRespostaButtons
          tipo={item.tipoResposta as any}
          opcoes={opcoes}
          valorAtual={resposta === 'nao_avaliado' ? null : resposta}
          onSelect={isReadonly ? () => {} : handleSelectResposta}
          disabled={isReadonly}
        />

        <View>
          <Text className="text-sm font-medium text-gray-600 mb-2">
            Observação{item.observacaoObrigatoria && !isReadonly ? ' *' : ''}
          </Text>
          <TextInput
            className="border border-gray-200 rounded-xl px-4 py-3 text-base text-neutral min-h-[72px]"
            style={{ lineHeight: 22, textAlignVertical: 'top' }}
            multiline
            value={observacao}
            onChangeText={setObservacao}
            placeholder={isReadonly ? 'Sem observação' : 'Adicione uma observação...'}
            placeholderTextColor="#9CA3AF"
            editable={!isReadonly}
          />
        </View>

        {resposta === 'nao_conforme' && (
          <ItemCamposNc
            descricaoIa={descricaoIa}
            planoAcaoIa={planoIa}
            loadingIa={loadingIa}
            descricao={descricaoNc}
            planoAcao={planoAcao}
            onChange={isReadonly ? () => {} : (d, p) => { setDescricaoNc(d); setPlanoAcao(p); }}
            readonly={isReadonly}
          />
        )}

        <View>
          <Text className="text-sm font-medium text-gray-600 mb-2">Fotos</Text>
          <FotoGrid
            fotos={fotos}
            onAdd={isReadonly ? undefined : handleAddFoto}
            onRemove={isReadonly ? undefined : handleRemoveFoto}
            obrigatoria={!isReadonly && item.fotoObrigatoria}
            carregando={carregandoFoto}
            analiseContexto={isReadonly ? undefined : { perguntaChecklist: item.descricao, categoria: item.categoria ?? undefined }}
            onAnaliseAtualizada={() => setFotos(fotoRepo.findByItem(itemId!))}
          />
        </View>

        {!isReadonly && (
          <TouchableOpacity
            onPress={handleSalvar}
            className="bg-primary rounded-xl py-4 items-center mt-4"
          >
            <Text className="text-white font-bold text-base">Salvar</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

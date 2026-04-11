import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { X } from 'lucide-react-native';
import { ItemCamposNc } from './ItemCamposNc';
import { FotoGrid } from './FotoGrid';
import { FotoRepo } from '../../db/repositories/foto.repo';
import { getSugestaoIa } from '../../api/auditoria.api';
import type { AuditoriaItemCompleto } from '../../db/repositories/auditoria-item.repo';
import type { Foto } from '../../db/repositories/foto.repo';

const fotoRepo = new FotoRepo();

interface Props {
  visible: boolean;
  item: AuditoriaItemCompleto;
  resposta: string;
  onSalvar: (dados: {
    observacao?: string;
    descricaoNaoConformidade?: string;
    planoAcaoFinal?: string;
    descricaoIa?: string;
    planoAcaoSugerido?: string;
  }) => void;
  onFechar: () => void;
}

export function ItemDetailSheet({ visible, item, resposta, onSalvar, onFechar }: Props) {
  const [observacao, setObservacao] = useState(item.observacao ?? '');
  const [descricaoNc, setDescricaoNc] = useState(item.descricaoNaoConformidade ?? '');
  const [planoAcao, setPlanoAcao] = useState(item.planoAcaoFinal ?? '');
  const [fotos, setFotos] = useState<Foto[]>(() => fotoRepo.findByItem(item.id));
  const [loadingIa, setLoadingIa] = useState(false);
  const [descricaoIa, setDescricaoIa] = useState(item.descricaoIa ?? undefined);
  const [planoIa, setPlanoIa] = useState(item.planoAcaoSugerido ?? undefined);

  const isNc = resposta === 'nao_conforme';

  const triggerIa = useCallback(() => {
    if (loadingIa || descricaoNc) return;
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
  }, [item.id, item.descricao, descricaoNc, planoAcao, loadingIa]);

  if (isNc && !descricaoNc && !loadingIa && !descricaoIa) {
    triggerIa();
  }

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

  const handleSalvar = () => {
    onSalvar({
      observacao: observacao || undefined,
      descricaoNaoConformidade: isNc ? (descricaoNc || undefined) : undefined,
      planoAcaoFinal: isNc ? (planoAcao || undefined) : undefined,
      descricaoIa,
      planoAcaoSugerido: planoIa,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
      >
        {/* Header fixo */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
          <Text className="text-base font-semibold text-neutral flex-1 mr-3" numberOfLines={2}>
            {item.descricao}
          </Text>
          <TouchableOpacity onPress={onFechar} className="p-1">
            <X size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
          {/* Campos NC */}
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
        </ScrollView>

        {/* Footer fixo */}
        <View className="px-4 py-4 border-t border-gray-100 bg-white">
          <TouchableOpacity onPress={handleSalvar} className="bg-primary rounded-xl py-4 items-center">
            <Text className="text-white font-bold text-base">Salvar e Continuar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

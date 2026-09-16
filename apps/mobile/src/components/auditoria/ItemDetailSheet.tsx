import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { useState, useCallback } from 'react';
import * as FileSystem from 'expo-file-system';
import { X } from 'lucide-react-native';
import { ItemCamposNc } from './ItemCamposNc';
import { FotoGrid } from './FotoGrid';
import { FotoRepo } from '../../db/repositories/foto.repo';
import { getSugestaoIa, CreditoInsuficienteError } from '../../api/ia.api';
import { abrirFotoPicker } from '../../utils/foto-picker';
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
    referenciaLegal?: string;
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
  const [referenciaLegal, setReferenciaLegal] = useState(item.referenciaLegal ?? undefined);
  const [carregandoFoto, setCarregandoFoto] = useState(false);

  const isNc = resposta === 'nao_conforme';

  const triggerIa = useCallback(() => {
    if (loadingIa || descricaoNc) return;
    setLoadingIa(true);
    getSugestaoIa(item.descricao)
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
  }, [item.id, item.descricao, descricaoNc, planoAcao, loadingIa]);

  if (isNc && !descricaoNc && !loadingIa && !descricaoIa) {
    triggerIa();
  }

  const handleAddFoto = useCallback(async () => {
    setCarregandoFoto(true);
    try {
      const novasFotos = await abrirFotoPicker(fotos.length);
      for (const foto of novasFotos) {
        fotoRepo.add(item.id, foto.uri, foto.coords ?? undefined, foto.tamanhoBytes);
      }
      if (novasFotos.length > 0) {
        setFotos(fotoRepo.findByItem(item.id));
      }
    } finally {
      setCarregandoFoto(false);
    }
  }, [item.id, fotos.length]);

  const handleRemoveFoto = useCallback(async (fotoId: string) => {
    const foto = fotos.find(f => f.id === fotoId);
    fotoRepo.remove(fotoId);
    if (foto?.filePath) {
      FileSystem.deleteAsync(foto.filePath, { idempotent: true }).catch(() => {});
    }
    setFotos(fotoRepo.findByItem(item.id));
  }, [item.id, fotos]);

  const handleSalvar = () => {
    if (item.fotoObrigatoria && fotos.length === 0) {
      Alert.alert('Foto obrigatória', 'Adicione pelo menos uma foto para este item.');
      return;
    }
    if (item.observacaoObrigatoria && !observacao.trim()) {
      Alert.alert('Observação obrigatória', 'Preencha a observação para este item.');
      return;
    }
    onSalvar({
      observacao: observacao || undefined,
      descricaoNaoConformidade: isNc ? (descricaoNc || undefined) : undefined,
      planoAcaoFinal: isNc ? (planoAcao || undefined) : undefined,
      descricaoIa,
      planoAcaoSugerido: planoIa,
      referenciaLegal: isNc ? referenciaLegal : undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onFechar}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-white"
      >
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100">
          <Text className="text-base font-semibold text-neutral flex-1 mr-3" numberOfLines={2}>
            {item.descricao}
          </Text>
          <TouchableOpacity onPress={onFechar} className="p-1">
            <X size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
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

          <View>
            <Text className="text-sm font-medium text-gray-600 mb-2">Fotos</Text>
            <FotoGrid
              fotos={fotos}
              onAdd={handleAddFoto}
              onRemove={handleRemoveFoto}
              obrigatoria={item.fotoObrigatoria}
              carregando={carregandoFoto}
              analiseContexto={{ perguntaChecklist: item.descricao, categoria: item.categoria ?? undefined }}
              onAnaliseAtualizada={() => setFotos(fotoRepo.findByItem(item.id))}
            />
          </View>
        </ScrollView>

        <View className="px-4 py-4 border-t border-gray-100 bg-white">
          <TouchableOpacity onPress={handleSalvar} className="bg-primary rounded-xl py-4 items-center">
            <Text className="text-white font-bold text-base">Salvar e Continuar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

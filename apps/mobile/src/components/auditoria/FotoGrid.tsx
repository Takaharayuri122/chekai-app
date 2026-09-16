import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, useWindowDimensions, Alert } from 'react-native';
import { Camera, ImagePlus, X, Sparkles } from 'lucide-react-native';
import { FotoRepo, type Foto } from '../../db/repositories/foto.repo';
import { FotoPreviewModal } from './FotoPreviewModal';
import { MAX_FOTOS_POR_ITEM } from '../../utils/foto-picker';
import {
  analisarImagemChecklist,
  CreditoInsuficienteError,
  type AnaliseImagemChecklistIa,
} from '../../api/ia.api';

const fotoRepo = new FotoRepo();

/**
 * Contexto necessário para a análise de IA da imagem (RN-FOT-003).
 * Quando ausente, o grid não dispara análise.
 */
export interface AnaliseContexto {
  perguntaChecklist: string;
  categoria?: string;
  tipoEstabelecimento?: string;
}

function parseAnalise(json: string | null): AnaliseImagemChecklistIa | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as AnaliseImagemChecklistIa;
  } catch {
    return null;
  }
}

interface Props {
  fotos: Foto[];
  onAdd?: () => void;
  onRemove?: (id: string) => void;
  obrigatoria?: boolean;
  maxFotos?: number;
  carregando?: boolean;
  analiseContexto?: AnaliseContexto;
  onAnaliseAtualizada?: () => void;
}

export function FotoGrid({
  fotos,
  onAdd,
  onRemove,
  obrigatoria = false,
  maxFotos = MAX_FOTOS_POR_ITEM,
  carregando = false,
  analiseContexto,
  onAnaliseAtualizada,
}: Props) {
  const { width } = useWindowDimensions();
  const [previewIndice, setPreviewIndice] = useState<number | null>(null);
  const [analisandoId, setAnalisandoId] = useState<string | null>(null);
  const contextoRef = useRef(analiseContexto);
  contextoRef.current = analiseContexto;
  const onAtualizadaRef = useRef(onAnaliseAtualizada);
  onAtualizadaRef.current = onAnaliseAtualizada;
  const tentadasRef = useRef<Set<string>>(new Set());
  const erroCreditoRef = useRef(false);

  useEffect(() => {
    const contexto = contextoRef.current;
    if (!contexto) return;
    let cancelado = false;
    const processar = async (): Promise<void> => {
      for (const foto of fotos) {
        if (cancelado) return;
        if (!foto.filePath || foto.analiseIa || tentadasRef.current.has(foto.id)) continue;
        if (erroCreditoRef.current) return;
        tentadasRef.current.add(foto.id);
        setAnalisandoId(foto.id);
        try {
          const resultado = await analisarImagemChecklist(
            foto.filePath,
            contexto.perguntaChecklist,
            contexto.categoria,
            contexto.tipoEstabelecimento,
          );
          fotoRepo.setAnalise(foto.id, JSON.stringify(resultado));
          onAtualizadaRef.current?.();
        } catch (e) {
          if (e instanceof CreditoInsuficienteError) {
            erroCreditoRef.current = true;
            Alert.alert('Créditos de IA esgotados', e.message);
          }
        } finally {
          if (!cancelado) setAnalisandoId(null);
        }
        return;
      }
    };
    processar();
    return () => { cancelado = true; };
  }, [fotos]);

  const GAP = 8;
  const PADDING_HORIZONTAL = 0;
  const COLUNAS = 2;
  const tamanhoThumb = (width - PADDING_HORIZONTAL * 2 - GAP * (COLUNAS - 1)) / COLUNAS - 16;

  const canAdd = !!onAdd && fotos.length < maxFotos;

  const confirmarRemocao = useCallback((fotoId: string) => {
    Alert.alert(
      'Remover foto',
      'Deseja remover esta foto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => onRemove?.(fotoId) },
      ],
    );
  }, [onRemove]);

  const handlePreviewRemover = useCallback((fotoId: string) => {
    confirmarRemocao(fotoId);
  }, [confirmarRemocao]);

  return (
    <View>
      {obrigatoria && fotos.length === 0 && (
        <View className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex-row items-center gap-2 mb-3">
          <Camera size={14} color="#d97706" />
          <Text className="text-xs text-amber-700 font-medium">
            Foto obrigatória para este item
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
        {fotos.map((f, i) => (
          <TouchableOpacity
            key={f.id}
            onPress={() => setPreviewIndice(i)}
            activeOpacity={0.8}
            style={{ width: tamanhoThumb, height: tamanhoThumb }}
          >
            <Image
              source={{ uri: f.filePath ?? f.url ?? undefined }}
              style={{ width: tamanhoThumb, height: tamanhoThumb, borderRadius: 12 }}
              className="bg-gray-200"
            />
            {onRemove && (
              <TouchableOpacity
                onPress={() => confirmarRemocao(f.id)}
                className="absolute top-1.5 right-1.5 bg-black/60 rounded-full w-6 h-6 items-center justify-center"
                hitSlop={8}
              >
                <X color="white" size={14} />
              </TouchableOpacity>
            )}
            {f.syncStatus === 'pending' && (
              <View className="absolute bottom-1.5 left-1.5 bg-amber-500 rounded-full px-1.5 py-0.5">
                <Text className="text-[8px] text-white font-bold">Pendente</Text>
              </View>
            )}
            {f.analiseIa && (
              <View className="absolute bottom-1.5 right-1.5 bg-teal-600 rounded-full px-1.5 py-0.5 flex-row items-center gap-0.5">
                <Sparkles size={9} color="white" />
                <Text className="text-[8px] text-white font-bold">IA</Text>
              </View>
            )}
            {analisandoId === f.id && (
              <View className="absolute inset-0 bg-black/40 rounded-xl items-center justify-center">
                <ActivityIndicator color="white" size="small" />
                <Text className="text-[9px] text-white font-medium mt-1">Analisando...</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {canAdd && (
          <TouchableOpacity
            onPress={onAdd}
            disabled={carregando}
            style={{ width: tamanhoThumb, height: tamanhoThumb }}
            className="rounded-xl border-2 border-dashed border-gray-300 items-center justify-center bg-gray-50"
            activeOpacity={0.6}
          >
            {carregando ? (
              <Text className="text-xs text-gray-400">Processando...</Text>
            ) : (
              <>
                <ImagePlus size={28} color="#9CA3AF" />
                <Text className="text-xs text-gray-400 mt-1">Adicionar</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {fotos.length > 0 && (
        <Text className="text-xs text-gray-400 mt-2">
          {fotos.length}/{maxFotos} foto{fotos.length !== 1 ? 's' : ''}
        </Text>
      )}

      {fotos.some(f => f.analiseIa) && (
        <View className="mt-3 gap-2">
          {fotos.map((f) => {
            const analise = parseAnalise(f.analiseIa);
            if (!analise?.descricaoIa) return null;
            return (
              <View key={`analise-${f.id}`} className="bg-teal-50 border border-teal-200 rounded-xl p-3">
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Sparkles size={13} color="#0f766e" />
                  <Text className="text-[11px] font-bold text-teal-900 uppercase">Análise da IA</Text>
                </View>
                <Text className="text-xs text-teal-800 leading-4">{analise.descricaoIa}</Text>
                {analise.referenciaLegal ? (
                  <Text className="text-[11px] text-teal-700 mt-1.5">{analise.referenciaLegal}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      {!onAdd && fotos.length === 0 && !obrigatoria && (
        <Text className="text-xs text-gray-400">Nenhuma foto registrada</Text>
      )}

      {previewIndice !== null && (
        <FotoPreviewModal
          fotos={fotos}
          indiceInicial={previewIndice}
          visivel
          onFechar={() => setPreviewIndice(null)}
          onRemover={onRemove ? handlePreviewRemover : undefined}
        />
      )}
    </View>
  );
}

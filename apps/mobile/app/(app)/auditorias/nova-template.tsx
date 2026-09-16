import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { getDatabase } from '../../../src/db/client';
import { AuditoriaRepo } from '../../../src/db/repositories/auditoria.repo';
import { AuditoriaItemRepo } from '../../../src/db/repositories/auditoria-item.repo';
import { pullTemplates } from '../../../src/sync/pull';
import { SyncService } from '../../../src/sync/SyncService';
import { gerarUUID } from '../../../src/utils/uuid';

interface TemplateRow {
  id: string;
  nome: string;
  descricao: string | null;
  tipo_atividade: string | null;
  totalItens: number;
}
interface TemplateItemRaw {
  id: string; descricao: string; ordem: number; categoria: string | null;
  tipo_resposta: string; foto_obrigatoria: number; observacao_obrigatoria: number;
  pontuacao_maxima: number; opcoes_resposta_config: string | null; criticidade: string | null;
}

const auditoriaRepo = new AuditoriaRepo();
const itemRepo = new AuditoriaItemRepo();

function carregarTemplatesLocais(): TemplateRow[] {
  const db = getDatabase();
  return db.getAllSync<TemplateRow>(
    `SELECT ct.id, ct.nome, ct.descricao, ct.tipo_atividade,
            COUNT(ti.id) AS totalItens
     FROM checklist_templates ct
     LEFT JOIN template_itens ti ON ti.template_id = ct.id
     WHERE ct.status = 'ativo'
     GROUP BY ct.id
     ORDER BY ct.nome`
  );
}

export default function NovaTemplateScreen() {
  const { unidadeId, clienteId } = useLocalSearchParams<{ unidadeId: string; clienteId: string }>();
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const creating = useRef(false);

  const carregarDados = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const isOnline = await SyncService.isOnline();
      if (isOnline) {
        await pullTemplates();
      }
    } catch {
      console.warn('[NovaTemplate] Falha ao sincronizar templates, usando cache local');
    } finally {
      setTemplates(carregarTemplatesLocais());
      setLoadingTemplates(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const handleSelect = async (template: TemplateRow) => {
    if (creating.current) return;
    if (!clienteId || !unidadeId) {
      Alert.alert('Erro', 'Dados de cliente/unidade não encontrados. Volte e tente novamente.');
      return;
    }
    creating.current = true;
    setLoading(true);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
        }
      } catch {
        console.warn('[NovaAuditoria] GPS indisponível');
      }

      const newId = gerarUUID();
      const now = new Date().toISOString();
      console.log(`[NovaAuditoria] Criando — id=${newId}, clienteId=${clienteId}, unidadeId=${unidadeId}, templateId=${template.id}`);

      auditoriaRepo.create({
        id: newId,
        clienteId,
        unidadeId,
        templateId: template.id,
        dataInicio: now,
        latitudeInicio: latitude,
        longitudeInicio: longitude,
      });
      console.log('[NovaAuditoria] Auditoria inserida no SQLite');

      const db = getDatabase();
      const itens = db.getAllSync<TemplateItemRaw>(
        `SELECT id, descricao, ordem, categoria, tipo_resposta,
                foto_obrigatoria, observacao_obrigatoria, pontuacao_maxima,
                opcoes_resposta_config, criticidade
         FROM template_itens WHERE template_id = ? ORDER BY categoria, ordem`,
        [template.id]
      );
      console.log(`[NovaAuditoria] ${itens.length} itens do template encontrados`);

      itemRepo.bulkCreate(newId, itens.map(i => ({
        id: i.id,
        descricao: i.descricao,
        ordem: i.ordem,
        categoria: i.categoria,
        tipoResposta: i.tipo_resposta,
        fotoObrigatoria: i.foto_obrigatoria === 1,
        observacaoObrigatoria: i.observacao_obrigatoria === 1,
        pontuacaoMaxima: i.pontuacao_maxima,
        opcoesRespostaConfig: i.opcoes_resposta_config,
        criticidade: i.criticidade,
      })));
      console.log('[NovaAuditoria] Itens de auditoria criados, navegando...');

      router.replace({ pathname: '/(app)/auditorias/[id]/checklist', params: { id: newId } });
    } catch (e) {
      console.error('[NovaAuditoria] Erro ao criar auditoria:', e);
      creating.current = false;
      setLoading(false);
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert('Erro ao criar auditoria', msg);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200">
        <ActivityIndicator color="#00B8A9" />
        <Text className="text-gray-500 mt-3">Criando auditoria...</Text>
      </View>
    );
  }

  if (loadingTemplates) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200">
        <ActivityIndicator color="#00B8A9" />
        <Text className="text-gray-500 mt-3">Carregando checklists...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-base-200" edges={['bottom']}>
      <FlatList
        data={templates}
        keyExtractor={t => t.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          <View className="items-center py-12 px-8">
            <Text className="text-base text-gray-400 text-center">
              Nenhum checklist disponível
            </Text>
            <Text className="text-sm text-gray-300 text-center mt-1">
              Verifique sua conexão e tente novamente
            </Text>
          </View>
        }
        renderItem={({ item: t }) => (
          <TouchableOpacity
            onPress={() => handleSelect(t)}
            className="bg-white rounded-xl p-4 border border-gray-100"
          >
            <Text className="font-semibold text-neutral">{t.nome}</Text>
            {t.descricao && (
              <Text className="text-sm text-gray-500 mt-0.5" numberOfLines={2}>{t.descricao}</Text>
            )}
            <View className="flex-row items-center gap-2 mt-2">
              {t.tipo_atividade && (
                <View className="bg-gray-100 rounded-full px-2.5 py-0.5">
                  <Text className="text-xs text-gray-500">{t.tipo_atividade}</Text>
                </View>
              )}
              <Text className="text-xs text-gray-400">{t.totalItens} itens</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

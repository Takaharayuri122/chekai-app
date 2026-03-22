import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getDatabase } from '../../../src/db/client';
import { AuditoriaRepo } from '../../../src/db/repositories/auditoria.repo';
import { AuditoriaItemRepo } from '../../../src/db/repositories/auditoria-item.repo';

interface TemplateRow { id: string; nome: string; descricao: string | null; totalItens: number; }
interface TemplateItemRaw {
  id: string; descricao: string; ordem: number; categoria: string | null;
  tipo_resposta: string; foto_obrigatoria: number; observacao_obrigatoria: number;
  pontuacao_maxima: number; opcoes_resposta_config: string | null; criticidade: string | null;
}

const auditoriaRepo = new AuditoriaRepo();
const itemRepo = new AuditoriaItemRepo();

export default function NovaTemplateScreen() {
  const { unidadeId, clienteId } = useLocalSearchParams<{ unidadeId: string; clienteId: string }>();
  const [loading, setLoading] = useState(false);

  const templates = useMemo((): TemplateRow[] => {
    const db = getDatabase();
    return db.getAllSync<TemplateRow>(
      `SELECT ct.id, ct.nome, ct.descricao,
              COUNT(ti.id) AS totalItens
       FROM checklist_templates ct
       JOIN clientes c ON ct.tipo_atividade = c.tipo_atividade
       JOIN unidades u ON u.cliente_id = c.id
       LEFT JOIN template_itens ti ON ti.template_id = ct.id
       WHERE u.id = ? AND ct.status = 'ativo'
       GROUP BY ct.id
       ORDER BY ct.nome`,
      [unidadeId]
    );
  }, [unidadeId]);

  const handleSelect = (template: TemplateRow) => {
    setLoading(true);
    const newId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Create auditoria
    auditoriaRepo.create({
      id: newId,
      clienteId: clienteId!,
      unidadeId: unidadeId!,
      templateId: template.id,
      dataInicio: now,
    });

    // Bulk-create items
    const db = getDatabase();
    const itens = db.getAllSync<TemplateItemRaw>(
      `SELECT id, descricao, ordem, categoria, tipo_resposta,
              foto_obrigatoria, observacao_obrigatoria, pontuacao_maxima,
              opcoes_resposta_config, criticidade
       FROM template_itens WHERE template_id = ? ORDER BY categoria, ordem`,
      [template.id]
    );

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

    router.replace({ pathname: '/(app)/auditorias/[id]/checklist', params: { id: newId } });
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200">
        <ActivityIndicator color="#00B8A9" />
        <Text className="text-gray-500 mt-3">Criando auditoria...</Text>
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
          <Text className="text-center text-gray-400 py-8">
            Nenhum template disponível para este estabelecimento
          </Text>
        }
        renderItem={({ item: t }) => (
          <TouchableOpacity
            onPress={() => handleSelect(t)}
            className="bg-white rounded-xl p-4 border border-gray-100"
          >
            <Text className="font-semibold text-neutral">{t.nome}</Text>
            {t.descricao && <Text className="text-sm text-gray-500 mt-0.5">{t.descricao}</Text>}
            <Text className="text-xs text-gray-400 mt-1">{t.totalItens} itens</Text>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

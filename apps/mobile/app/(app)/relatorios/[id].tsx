import {
  View, Text, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Building2, MapPin, Plus, Trash2, Camera, Sparkles, Save, CheckCircle2, FileDown,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RichTextEditor } from '../../../src/components/relatorio-tecnico/RichTextEditor';
import {
  RelatorioTecnicoRepo, type RelatorioTecnicoCompleto,
} from '../../../src/db/repositories/relatorio-tecnico.repo';
import {
  RelatorioFotoRepo, type RelatorioFoto, MAX_FOTOS_POR_RELATORIO,
} from '../../../src/db/repositories/relatorio-foto.repo';
import { pushRelatorioTecnico, enqueueRelatorioPush } from '../../../src/sync/push';
import { SyncService } from '../../../src/sync/SyncService';
import {
  gerarApoioAnalitico, removerRelatorioFoto, baixarPdfRelatorioTecnico,
} from '../../../src/api/relatorio-tecnico.api';
import { comprimirImagem } from '../../../src/utils/compressao-imagem';
import { useAuthStore } from '../../../src/store/auth';

const repo = new RelatorioTecnicoRepo();
const fotoRepo = new RelatorioFotoRepo();

function htmlVazio(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length === 0;
}

async function selecionarFoto(): Promise<string | null> {
  const permissao = await ImagePicker.requestCameraPermissionsAsync();
  const usarCamera = permissao.granted;
  const resultado = usarCamera
    ? await ImagePicker.launchCameraAsync({ quality: 0.8, mediaTypes: ['images'] })
    : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, mediaTypes: ['images'] });
  if (resultado.canceled || !resultado.assets.length) {
    return null;
  }
  const { uri } = await comprimirImagem(resultado.assets[0].uri);
  return uri;
}

export default function RelatorioTecnicoFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const usuario = useAuthStore((s) => s.user);

  const [relatorio, setRelatorio] = useState<RelatorioTecnicoCompleto | null>(null);
  const [fotos, setFotos] = useState<RelatorioFoto[]>([]);
  const [identificacao, setIdentificacao] = useState('');
  const [descricao, setDescricao] = useState('');
  const [avaliacao, setAvaliacao] = useState('');
  const [recomendacoes, setRecomendacoes] = useState('');
  const [planoAcao, setPlanoAcao] = useState('');
  const [acoes, setAcoes] = useState<string[]>([]);
  const [novaAcao, setNovaAcao] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [gerandoApoio, setGerandoApoio] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [baixandoPdf, setBaixandoPdf] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const somenteLeitura = relatorio?.status === 'finalizado';
  const nomeConsultora = usuario?.nome ?? relatorio?.assinaturaNomeConsultora ?? '';

  const carregar = useCallback(() => {
    if (!id) return;
    const r = repo.findById(id);
    if (!r) {
      setErro('Relatório técnico não encontrado.');
      return;
    }
    setRelatorio(r);
    setIdentificacao(r.identificacao);
    setDescricao(r.descricaoOcorrenciaHtml);
    setAvaliacao(r.avaliacaoTecnicaHtml);
    setRecomendacoes(r.recomendacoesConsultoraHtml);
    setPlanoAcao(r.planoAcaoSugeridoHtml);
    setAcoes(r.acoesExecutadas);
    setResponsavel(r.responsavel ?? '');
    setFotos(fotoRepo.findByRelatorio(id));
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  const persistirCampos = useCallback(() => {
    if (!id) return;
    repo.updateCampos(id, {
      identificacao,
      descricaoOcorrenciaHtml: descricao,
      avaliacaoTecnicaHtml: avaliacao,
      acoesExecutadas: acoes,
      recomendacoesConsultoraHtml: recomendacoes,
      planoAcaoSugeridoHtml: planoAcao,
      assinaturaNomeConsultora: nomeConsultora,
      responsavel,
    });
  }, [id, identificacao, descricao, avaliacao, acoes, recomendacoes, planoAcao, nomeConsultora, responsavel]);

  const adicionarAcao = (): void => {
    const texto = novaAcao.trim();
    if (!texto) return;
    setAcoes((prev) => [...prev, texto]);
    setNovaAcao('');
  };

  const adicionarFoto = async (): Promise<void> => {
    if (!id) return;
    if (fotos.length >= MAX_FOTOS_POR_RELATORIO) {
      Alert.alert('Limite atingido', `Máximo de ${MAX_FOTOS_POR_RELATORIO} fotos por relatório.`);
      return;
    }
    setEnviandoFoto(true);
    try {
      const uri = await selecionarFoto();
      if (uri) {
        fotoRepo.add(id, uri);
        setFotos(fotoRepo.findByRelatorio(id));
      }
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível adicionar a foto.');
    } finally {
      setEnviandoFoto(false);
    }
  };

  const removerFoto = (foto: RelatorioFoto): void => {
    Alert.alert('Remover foto', 'Deseja remover esta evidência?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          try {
            if (foto.remoteId && relatorio?.remoteId) {
              const online = await SyncService.isOnline();
              if (!online) {
                Alert.alert('Sem conexão', 'É necessário estar online para remover uma foto já sincronizada.');
                return;
              }
              await removerRelatorioFoto(relatorio.remoteId, foto.remoteId);
            }
            fotoRepo.remove(foto.id);
            if (id) setFotos(fotoRepo.findByRelatorio(id));
          } catch (e) {
            Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível remover a foto.');
          }
        },
      },
    ]);
  };

  const salvarRascunho = async (): Promise<void> => {
    if (!id) return;
    setSalvando(true);
    setErro(null);
    try {
      persistirCampos();
      const online = await SyncService.isOnline();
      if (online) {
        await pushRelatorioTecnico(id);
      } else {
        enqueueRelatorioPush(id);
      }
      carregar();
      Alert.alert('Salvo', online ? 'Rascunho sincronizado.' : 'Rascunho salvo. Será enviado quando houver conexão.');
    } catch (e) {
      enqueueRelatorioPush(id);
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const finalizar = async (): Promise<void> => {
    if (!id) return;
    const faltando: string[] = [];
    if (!identificacao.trim()) faltando.push('Identificação');
    if (htmlVazio(descricao)) faltando.push('Descrição da ocorrência');
    if (htmlVazio(avaliacao)) faltando.push('Avaliação técnica');
    if (htmlVazio(recomendacoes)) faltando.push('Recomendações da consultora');
    if (htmlVazio(planoAcao)) faltando.push('Plano de ação sugerido');
    if (acoes.length === 0) faltando.push('Ao menos uma ação executada');
    if (faltando.length > 0) {
      Alert.alert('Campos obrigatórios', `Preencha antes de finalizar:\n\n• ${faltando.join('\n• ')}`);
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      persistirCampos();
      repo.updateStatus(id, 'finalizado');
      const online = await SyncService.isOnline();
      if (online) {
        await pushRelatorioTecnico(id);
      } else {
        enqueueRelatorioPush(id);
      }
      carregar();
      Alert.alert(
        'Relatório finalizado',
        online ? 'Relatório finalizado e sincronizado.' : 'Finalizado. Será enviado quando houver conexão.',
        [{ text: 'OK', onPress: () => router.replace('/(app)/relatorios') }],
      );
    } catch (e) {
      enqueueRelatorioPush(id);
      setErro(e instanceof Error ? e.message : 'Erro ao finalizar.');
    } finally {
      setSalvando(false);
    }
  };

  const gerarApoio = async (): Promise<void> => {
    if (!id) return;
    const completo = !!identificacao.trim() && !htmlVazio(descricao) && !htmlVazio(avaliacao)
      && !htmlVazio(recomendacoes) && !htmlVazio(planoAcao) && acoes.length > 0;
    if (!completo) {
      Alert.alert('Atenção', 'Preencha todo o relatório (e ao menos uma ação) antes de gerar o apoio analítico.');
      return;
    }
    setGerandoApoio(true);
    try {
      const online = await SyncService.isOnline();
      if (!online) {
        Alert.alert('Sem conexão', 'O apoio analítico por IA exige conexão com a internet.');
        return;
      }
      persistirCampos();
      await pushRelatorioTecnico(id);
      const atualizado = repo.findById(id);
      if (!atualizado?.remoteId) {
        throw new Error('Não foi possível sincronizar o relatório antes de gerar o apoio.');
      }
      const resposta = await gerarApoioAnalitico(atualizado.remoteId);
      repo.setApoioAnalitico(id, resposta.apoioAnaliticoChekAi ?? '');
      carregar();
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao gerar apoio analítico.');
    } finally {
      setGerandoApoio(false);
    }
  };

  const abrirPdf = async (): Promise<void> => {
    if (!id || !relatorio?.remoteId) return;
    setBaixandoPdf(true);
    try {
      if (relatorio.pdfLocalPath) {
        const info = await FileSystem.getInfoAsync(relatorio.pdfLocalPath);
        if (info.exists) {
          await compartilhar(relatorio.pdfLocalPath);
          return;
        }
      }
      const online = await SyncService.isOnline();
      if (!online) {
        Alert.alert('Sem conexão', 'É necessário estar online para baixar o PDF na primeira vez.');
        return;
      }
      const destino = `${FileSystem.documentDirectory}relatorio-tecnico-${relatorio.remoteId}.pdf`;
      const uri = await baixarPdfRelatorioTecnico(relatorio.remoteId, destino);
      repo.updatePdfLocalPath(id, uri);
      setRelatorio((prev) => (prev ? { ...prev, pdfLocalPath: uri } : prev));
      await compartilhar(uri);
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Erro ao abrir o PDF.');
    } finally {
      setBaixandoPdf(false);
    }
  };

  const compartilhar = async (uri: string): Promise<void> => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Indisponível', 'Não há visualizador de PDF neste dispositivo.');
      return;
    }
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: 'Relatório técnico',
    });
  };

  const apoioBlocos = useMemo(() => {
    const texto = (relatorio?.apoioAnalitico ?? '').trim();
    return texto ? texto.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean) : [];
  }, [relatorio?.apoioAnalitico]);

  if (erro && !relatorio) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200 px-8">
        <Text className="text-red-600 text-center">{erro}</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4">
          <Text className="text-primary font-semibold">Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!relatorio) {
    return (
      <View className="flex-1 items-center justify-center bg-base-200">
        <ActivityIndicator color="#00B8A9" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-base-200">
      <View className="bg-neutral px-4 pt-3 pb-4">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
            <ArrowLeft color="white" size={22} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-white font-semibold text-base">
              {somenteLeitura ? 'Relatório técnico' : 'Editar relatório técnico'}
            </Text>
            <View className="mt-1 gap-0.5">
              <View className="flex-row items-center gap-1.5">
                <Building2 size={12} color="#d1d5db" />
                <Text className="text-gray-300 text-xs flex-1" numberOfLines={1}>{relatorio.clienteNome}</Text>
              </View>
              {relatorio.unidadeNome ? (
                <View className="flex-row items-center gap-1.5">
                  <MapPin size={12} color="#d1d5db" />
                  <Text className="text-gray-300 text-xs flex-1" numberOfLines={1}>{relatorio.unidadeNome}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 + insets.bottom, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text className="text-sm font-medium text-gray-700 mb-1.5">
            Identificação<Text className="text-red-500"> *</Text>
          </Text>
          <TextInput
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-base text-neutral"
            placeholder="Ex.: setorial/estrutural"
            placeholderTextColor="#9CA3AF"
            value={identificacao}
            editable={!somenteLeitura}
            onChangeText={setIdentificacao}
          />
        </View>

        <RichTextEditor
          label="Descrição da ocorrência"
          initialValue={relatorio.descricaoOcorrenciaHtml}
          onChange={setDescricao}
          required
          disabled={somenteLeitura}
        />

        <View className="bg-white rounded-2xl p-4 border border-gray-100">
          <Text className="font-semibold text-neutral mb-1">Evidências fotográficas</Text>
          <Text className="text-xs text-gray-500 mb-3">Sem análise por IA. Até {MAX_FOTOS_POR_RELATORIO} fotos.</Text>
          <View className="flex-row flex-wrap gap-2">
            {fotos.map((foto) => (
              <View key={foto.id} className="relative">
                <Image
                  source={{ uri: foto.filePath ?? foto.url ?? '' }}
                  className="w-24 h-24 rounded-lg bg-gray-100"
                />
                {!somenteLeitura ? (
                  <TouchableOpacity
                    onPress={() => removerFoto(foto)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
                  >
                    <Trash2 size={12} color="white" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))}
            {!somenteLeitura && fotos.length < MAX_FOTOS_POR_RELATORIO ? (
              <TouchableOpacity
                onPress={adicionarFoto}
                disabled={enviandoFoto}
                className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg items-center justify-center"
              >
                {enviandoFoto ? (
                  <ActivityIndicator color="#00B8A9" size="small" />
                ) : (
                  <Camera size={22} color="#9CA3AF" />
                )}
              </TouchableOpacity>
            ) : null}
          </View>
          {fotos.length === 0 && somenteLeitura ? (
            <Text className="text-sm text-gray-400">Nenhuma evidência adicionada.</Text>
          ) : null}
        </View>

        <RichTextEditor
          label="Avaliação técnica"
          initialValue={relatorio.avaliacaoTecnicaHtml}
          onChange={setAvaliacao}
          required
          disabled={somenteLeitura}
        />

        <View className="bg-white rounded-2xl p-4 border border-gray-100">
          <Text className="font-semibold text-neutral mb-2">
            Ações executadas na visita<Text className="text-red-500"> *</Text>
          </Text>
          {!somenteLeitura ? (
            <View className="flex-row gap-2 mb-3">
              <TextInput
                className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-base text-neutral"
                placeholder="Adicionar ação executada"
                placeholderTextColor="#9CA3AF"
                value={novaAcao}
                onChangeText={setNovaAcao}
                onSubmitEditing={adicionarAcao}
              />
              <TouchableOpacity
                onPress={adicionarAcao}
                className="bg-primary rounded-xl px-4 items-center justify-center"
              >
                <Plus size={20} color="white" />
              </TouchableOpacity>
            </View>
          ) : null}
          {acoes.length === 0 ? (
            <Text className="text-sm text-gray-400">Nenhuma ação adicionada.</Text>
          ) : (
            acoes.map((acao, index) => (
              <View key={`${acao}-${index}`} className="flex-row items-center justify-between border border-gray-100 rounded-lg p-2.5 mb-2">
                <Text className="text-sm text-neutral flex-1 mr-2">{acao}</Text>
                {!somenteLeitura ? (
                  <TouchableOpacity onPress={() => setAcoes((prev) => prev.filter((_, i) => i !== index))}>
                    <Trash2 size={16} color="#dc2626" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ))
          )}
        </View>

        <RichTextEditor
          label="Recomendações da consultora"
          initialValue={relatorio.recomendacoesConsultoraHtml}
          onChange={setRecomendacoes}
          required
          disabled={somenteLeitura}
        />

        <RichTextEditor
          label="Plano de ação sugerido"
          initialValue={relatorio.planoAcaoSugeridoHtml}
          onChange={setPlanoAcao}
          required
          disabled={somenteLeitura}
        />

        <View className="bg-white rounded-2xl p-4 border border-gray-100">
          <View className="flex-row items-center gap-2 mb-2">
            <Sparkles size={18} color="#0f766e" />
            <Text className="font-semibold text-neutral flex-1">Apoio analítico ChekAi</Text>
          </View>
          {apoioBlocos.length > 0 ? (
            <View className="gap-2">
              {apoioBlocos.map((bloco, index) => (
                <View key={index} className="bg-teal-50 border border-teal-100 rounded-xl p-3">
                  <Text className="text-sm text-teal-900 leading-5">{bloco}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-sm text-gray-400 mb-3">
              Conteúdo somente leitura, gerado pela IA. Requer conexão e consome créditos do gestor.
            </Text>
          )}
          {!somenteLeitura ? (
            <TouchableOpacity
              onPress={gerarApoio}
              disabled={gerandoApoio}
              className={`mt-3 rounded-xl py-3 flex-row items-center justify-center gap-2 ${gerandoApoio ? 'bg-gray-400' : 'bg-teal-700'}`}
            >
              {gerandoApoio ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Sparkles size={18} color="white" />
              )}
              <Text className="text-white font-semibold">
                {gerandoApoio ? 'Gerando...' : 'Gerar apoio analítico'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View className="bg-white rounded-2xl p-4 border border-gray-100">
          <Text className="font-semibold text-neutral mb-3">Assinatura</Text>
          <Text className="text-xs text-gray-500 mb-1">Consultora</Text>
          <Text className="text-base text-neutral mb-3">{nomeConsultora || '—'}</Text>
          <Text className="text-xs text-gray-500 mb-1">Responsável pelo recebimento</Text>
          <TextInput
            className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-base text-neutral"
            placeholder="Nome do responsável (opcional)"
            placeholderTextColor="#9CA3AF"
            value={responsavel}
            editable={!somenteLeitura}
            onChangeText={setResponsavel}
          />
        </View>

        {erro ? (
          <View className="bg-red-50 border border-red-200 rounded-xl p-3">
            <Text className="text-red-700 text-sm">{erro}</Text>
          </View>
        ) : null}

        {somenteLeitura ? (
          <View className="gap-3">
            <View className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex-row items-center gap-2">
              <CheckCircle2 size={20} color="#059669" />
              <Text className="text-emerald-800 font-semibold flex-1">Relatório finalizado</Text>
            </View>
            {relatorio.remoteId ? (
              <TouchableOpacity
                onPress={abrirPdf}
                disabled={baixandoPdf}
                className={`rounded-2xl py-4 flex-row items-center justify-center gap-2 ${baixandoPdf ? 'bg-gray-400' : 'bg-primary'}`}
              >
                {baixandoPdf ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <FileDown size={20} color="white" />
                )}
                <Text className="text-white font-bold text-base">
                  {relatorio.pdfLocalPath ? 'Abrir PDF' : 'Baixar e abrir PDF'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <View className="gap-3">
            <TouchableOpacity
              onPress={salvarRascunho}
              disabled={salvando}
              className="bg-white border-2 border-primary rounded-2xl py-4 flex-row items-center justify-center gap-2"
            >
              <Save size={20} color="#00B8A9" />
              <Text className="text-primary font-bold text-base">
                {salvando ? 'Salvando...' : 'Salvar rascunho'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={finalizar}
              disabled={salvando}
              className={`rounded-2xl py-4 flex-row items-center justify-center gap-2 ${salvando ? 'bg-gray-400' : 'bg-primary'}`}
            >
              <CheckCircle2 size={20} color="white" />
              <Text className="text-white font-bold text-base">Finalizar relatório</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

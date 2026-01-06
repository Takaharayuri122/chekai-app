  'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Camera,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Loader2,
  Save,
  FileText,
  X,
  Edit3,
  Image as ImageIcon,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { AppLayout, PageHeader } from '@/components';
import {
  auditoriaService,
  iaService,
  type Auditoria,
  type AuditoriaItem,
  type AnaliseChecklistResponse,
} from '@/lib/api';
import { toastService } from '@/lib/toast';

type RespostaType = 'conforme' | 'nao_conforme' | 'nao_aplicavel' | string;

interface FotoPreview {
  id?: string;
  file?: File;
  preview: string;
  analiseIa?: AnaliseChecklistResponse;
  isAnalyzing?: boolean;
  isExisting?: boolean;
}

interface ItemModalState {
  item: AuditoriaItem;
  fotos: FotoPreview[];
  complemento: string;
  observacao: string;
  descricaoIaExistente: string;
  isSaving: boolean;
}

const MAX_FOTOS_POR_ITEM = 5;

export default function AuditoriaPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [auditoria, setAuditoria] = useState<Auditoria | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [processingIa, setProcessingIa] = useState<string | null>(null);
  const [finalizando, setFinalizando] = useState(false);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [observacoesGerais, setObservacoesGerais] = useState('');
  const [erroFinalizar, setErroFinalizar] = useState('');

  // Modal de foto + IA
  const [itemModal, setItemModal] = useState<ItemModalState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const carregarAuditoria = useCallback(async () => {
    try {
      const data = await auditoriaService.buscarPorId(id);
      setAuditoria(data);
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    carregarAuditoria();
  }, [carregarAuditoria]);

  const handleResposta = async (itemId: string, resposta: RespostaType) => {
    if (!auditoria) return;
    setAuditoria((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        itens: prev.itens.map((item) =>
          item.id === itemId ? { ...item, resposta } : item
        ),
      };
    });
    try {
      await auditoriaService.responderItem(auditoria.id, itemId, resposta);
      toastService.success('Resposta salva com sucesso!');
    } catch (error) {
      // Erro já é tratado pelo interceptor
      setAuditoria((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          itens: prev.itens.map((item) =>
            item.id === itemId ? { ...item, resposta: '' } : item
          ),
        };
      });
    }
  };

  const openPhotoModal = (item: AuditoriaItem) => {
    // Verificar se o item tem resposta antes de abrir o modal
    if (!item.resposta || item.resposta === 'nao_avaliado') {
      toastService.warning('Por favor, marque uma resposta antes de adicionar fotos');
      return;
    }
    // Carregar fotos existentes do item
    const fotosExistentes: FotoPreview[] = (item.fotos || []).map((foto) => ({
      id: foto.id,
      preview: foto.url,
      isExisting: true,
    }));
    setItemModal({
      item,
      fotos: fotosExistentes,
      complemento: '', // Campo removido, mas mantido para compatibilidade
      observacao: item.observacao || '',
      descricaoIaExistente: item.descricaoIa || '',
      isSaving: false,
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !itemModal || !auditoria) return;
    // Verificar se o item tem resposta antes de processar a imagem
    if (!itemModal.item.resposta || itemModal.item.resposta === 'nao_avaliado') {
      toastService.warning('Por favor, marque uma resposta antes de adicionar fotos');
      if (e.target) e.target.value = '';
      return;
    }
    if (itemModal.fotos.length >= MAX_FOTOS_POR_ITEM) {
      toastService.warning(`Máximo de ${MAX_FOTOS_POR_ITEM} fotos por item`);
      if (e.target) e.target.value = '';
      return;
    }
    const preview = URL.createObjectURL(file);
    const novaFoto: FotoPreview = { file, preview, isAnalyzing: true, isExisting: false };
    const fotoIndex = itemModal.fotos.length;
    setItemModal((prev) => prev ? { ...prev, fotos: [...prev.fotos, novaFoto] } : null);
    try {
      // Salva a foto automaticamente no backend
      const fotoSalva = await auditoriaService.adicionarFoto(
        auditoria.id,
        itemModal.item.id,
        file
      );
      toastService.success('Foto adicionada com sucesso!');
      // Analisa a imagem com IA
      const analise = await iaService.analisarImagemChecklist(
        file,
        itemModal.item.templateItem.pergunta,
        itemModal.item.templateItem.categoria || 'geral',
        auditoria?.template?.tipoAtividade || 'serviço de alimentação'
      );
      // Atualiza o estado com a foto salva e a análise
      setItemModal((prev) => {
        if (!prev) return null;
        const fotosAtualizadas = [...prev.fotos];
        fotosAtualizadas[fotoIndex] = { 
          ...fotosAtualizadas[fotoIndex], 
          id: fotoSalva.id,
          preview: fotoSalva.url || preview,
          analiseIa: analise, 
          isAnalyzing: false,
          isExisting: true, // Marca como existente pois já foi salva
        };
        
        return { 
          ...prev, 
          fotos: fotosAtualizadas,
          descricaoIaExistente: analise.descricaoIa,
        };
      });
      // Atualiza o estado global da auditoria com a nova foto
      setAuditoria((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          itens: prev.itens.map((item) =>
            item.id === itemModal.item.id
              ? {
                  ...item,
                  fotos: [...(item.fotos || []), { id: fotoSalva.id, url: fotoSalva.url }],
                }
              : item
          ),
        };
      });
      // Atualiza o item com a análise da IA automaticamente (salva a descrição da IA)
      await auditoriaService.responderItem(
        auditoria.id,
        itemModal.item.id,
        itemModal.item.resposta || 'nao_avaliado',
        {
          descricaoIa: analise.descricaoIa,
          descricaoNaoConformidade: analise.tipoNaoConformidade !== 'Nenhuma identificada' 
            ? analise.tipoNaoConformidade 
            : undefined,
          referenciaLegal: analise.referenciaLegal,
          planoAcaoSugerido: analise.sugestoes?.join('\n'),
        }
      );
    } catch {
      setItemModal((prev) => {
        if (!prev) return null;
        const fotosAtualizadas = [...prev.fotos];
        fotosAtualizadas[fotoIndex] = { ...fotosAtualizadas[fotoIndex], isAnalyzing: false };
        return { ...prev, fotos: fotosAtualizadas };
      });
    }
    if (e.target) e.target.value = '';
  };

  const handleRemoveFoto = async (index: number) => {
    if (!itemModal || !auditoria) return;
    
    const fotoParaRemover = itemModal.fotos[index];
    
    // Remove do estado local imediatamente
    setItemModal((prev) => {
      if (!prev) return null;
      const fotosAtualizadas = prev.fotos.filter((_, i) => i !== index);
      return { ...prev, fotos: fotosAtualizadas };
    });

    // Se a foto já foi salva no backend (tem id), deleta
    if (fotoParaRemover.id && fotoParaRemover.isExisting) {
      try {
        await auditoriaService.removerFoto(auditoria.id, itemModal.item.id, fotoParaRemover.id);
        toastService.success('Foto removida com sucesso!');
        
        // Atualiza o estado global também
        setAuditoria((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            itens: prev.itens.map((item) =>
              item.id === itemModal.item.id
                ? {
                    ...item,
                    fotos: (item.fotos || []).filter((f) => f.id !== fotoParaRemover.id),
                  }
                : item
            ),
          };
        });
      } catch (error) {
        // Erro já é tratado pelo interceptor
        // Se falhar, restaura a foto no estado
        setItemModal((prev) => {
          if (!prev) return null;
          const fotosAtualizadas = [...prev.fotos];
          fotosAtualizadas.splice(index, 0, fotoParaRemover);
          return { ...prev, fotos: fotosAtualizadas };
        });
      }
    }
  };

  const handleSaveItemModal = async () => {
    if (!itemModal || !auditoria) return;
    
    // Validar se a observação foi preenchida
    if (!itemModal.observacao || itemModal.observacao.trim() === '') {
      toastService.warning('A observação do auditor é obrigatória');
      setItemModal((prev) => prev ? { ...prev, isSaving: false } : null);
      return;
    }
    
    setItemModal((prev) => prev ? { ...prev, isSaving: true } : null);
    // Preserva a resposta atual do item
    const respostaAtual = itemModal.item.resposta || 'nao_avaliado';
    try {
      // Salva apenas a observação (a descrição da IA já foi salva automaticamente durante o upload)
      await auditoriaService.responderItem(
        auditoria.id,
        itemModal.item.id,
        respostaAtual,
        {
          observacao: itemModal.observacao,
        }
      );
      // Atualiza o estado local
      setAuditoria((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          itens: prev.itens.map((item) =>
            item.id === itemModal.item.id
              ? {
                  ...item,
                  observacao: itemModal.observacao,
                }
              : item
          ),
        };
      });
      toastService.success('Item salvo com sucesso!');
      setItemModal(null);
    } catch (error) {
      // Erro já é tratado pelo interceptor
      setItemModal((prev) => prev ? { ...prev, isSaving: false } : null);
    }
  };

  const handleGerarTextoIa = async (item: AuditoriaItem) => {
    setProcessingIa(item.id);
    try {
      const resultado = await iaService.gerarTexto(
        item.descricaoNaoConformidade || item.templateItem.pergunta,
        auditoria?.template?.tipoAtividade || 'serviço de alimentação'
      );
      await auditoriaService.responderItem(
        auditoria!.id,
        item.id,
        'nao_conforme',
        {
          descricaoIa: resultado.descricaoTecnica,
          referenciaLegal: resultado.referenciaLegal,
          planoAcaoSugerido: resultado.planoAcao.acoesCorretivas.join('\n'),
        }
      );
      setAuditoria((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          itens: prev.itens.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  descricaoIa: resultado.descricaoTecnica,
                  referenciaLegal: resultado.referenciaLegal,
                  planoAcaoSugerido: resultado.planoAcao.acoesCorretivas.join('\n'),
                }
              : i
          ),
        };
      });
      toastService.success('Texto gerado pela IA com sucesso!');
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setProcessingIa(null);
    }
  };

  const handleFinalizar = async () => {
    if (!auditoria) return;
    setFinalizando(true);
    setErroFinalizar('');
    try {
      await auditoriaService.finalizar(auditoria.id, observacoesGerais);
      toastService.success('Auditoria finalizada com sucesso!');
      setShowFinalModal(false);
      router.push('/dashboard');
    } catch (error: unknown) {
      // Erro já é tratado pelo interceptor
      let mensagem = 'Erro ao finalizar auditoria';
      if (error && typeof error === 'object') {
        const axiosError = error as { response?: { data?: { message?: string | string[] } } };
        const apiMessage = axiosError.response?.data?.message;
        if (Array.isArray(apiMessage)) {
          mensagem = apiMessage.join(', ');
        } else if (typeof apiMessage === 'string') {
          mensagem = apiMessage;
        } else if (error instanceof Error) {
          mensagem = error.message;
        }
      }
      setErroFinalizar(mensagem);
      setFinalizando(false);
    }
  };

  const getProgresso = () => {
    if (!auditoria?.itens.length) return 0;
    const respondidos = auditoria.itens.filter((i) => i.resposta && i.resposta !== 'nao_avaliado').length;
    return Math.round((respondidos / auditoria.itens.length) * 100);
  };

  // Verifica se todas as perguntas obrigatórias foram respondidas
  const getObrigatoriasStatus = () => {
    if (!auditoria?.itens.length) return { total: 0, respondidas: 0, completo: false };
    
    const obrigatorias = auditoria.itens.filter((i) => i.templateItem?.obrigatorio);
    const respondidas = obrigatorias.filter((i) => i.resposta && i.resposta !== 'nao_avaliado');
    
    return {
      total: obrigatorias.length,
      respondidas: respondidas.length,
      completo: obrigatorias.length === respondidas.length,
    };
  };

  const getRespostaStyle = (item: AuditoriaItem, tipo: RespostaType, isPersonalizada: boolean = false) => {
    const isSelected = item.resposta === tipo;
    const base = 'btn btn-sm flex-1';
    if (!isSelected) return `${base} btn-ghost`;
    if (isPersonalizada) {
      // Para opções personalizadas, usar estilo neutro
      return `${base} btn-primary`;
    }
    switch (tipo) {
      case 'conforme':
        return `${base} btn-success`;
      case 'nao_conforme':
        return `${base} btn-error`;
      case 'nao_aplicavel':
        return `${base} btn-warning`;
      default:
        return `${base} btn-primary`;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      </AppLayout>
    );
  }

  if (!auditoria) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-base-content/60">Auditoria não encontrada</p>
        </div>
      </AppLayout>
    );
  }

  const progresso = getProgresso();
  const obrigatoriasStatus = getObrigatoriasStatus();

  return (
    <AppLayout>
      <PageHeader
        title={auditoria.unidade?.nome || 'Auditoria'}
        subtitle={auditoria.template?.nome}
        backHref="/dashboard"
      />

      {/* Progress */}
      <div className="px-4 py-3 bg-base-100 border-b border-base-300 sticky top-[64px] md:top-[136px] z-20">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Progresso</span>
          <span className="text-sm text-base-content/60">
            {auditoria.itens.filter((i) => i.resposta && i.resposta !== 'nao_avaliado').length}/{auditoria.itens.length} itens
          </span>
        </div>
        <progress className="progress progress-primary w-full" value={progresso} max="100"></progress>
      </div>

      {/* Items */}
      <div className="px-4 py-4 lg:px-8 space-y-3 max-w-3xl mx-auto pb-36 md:pb-24">
        {auditoria.itens.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className="card bg-base-100 shadow-sm border border-base-300"
          >
            <div className="card-body p-4">
              {/* Pergunta */}
              <div className="flex items-start gap-3">
                <span className="badge badge-ghost badge-sm mt-1">{index + 1}</span>
                <div className="flex-1">
                  <p className="font-medium text-base-content">{item.templateItem.pergunta}</p>
                  {item.templateItem.legislacaoReferencia && (
                    <p className="text-xs text-info mt-1">📋 {item.templateItem.legislacaoReferencia}</p>
                  )}
                </div>
              </div>

              {/* Botões de resposta */}
              <div className="flex gap-2 mt-3 flex-wrap">
                {item.templateItem.usarRespostasPersonalizadas && item.templateItem.opcoesResposta && item.templateItem.opcoesResposta.length > 0 ? (
                  // Opções personalizadas do template
                  item.templateItem.opcoesResposta.map((opcao, idx) => (
                    <button
                      key={idx}
                      className={getRespostaStyle(item, opcao, true)}
                      onClick={() => handleResposta(item.id, opcao)}
                    >
                      <span>{opcao}</span>
                    </button>
                  ))
                ) : (
                  // Opções padrão
                  <>
                    <button className={getRespostaStyle(item, 'conforme')} onClick={() => handleResposta(item.id, 'conforme')}>
                      <CheckCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Conforme</span>
                    </button>
                    <button className={getRespostaStyle(item, 'nao_conforme')} onClick={() => handleResposta(item.id, 'nao_conforme')}>
                      <XCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Não Conforme</span>
                    </button>
                    <button className={getRespostaStyle(item, 'nao_aplicavel')} onClick={() => handleResposta(item.id, 'nao_aplicavel')}>
                      <AlertTriangle className="w-4 h-4" />
                      <span className="hidden sm:inline">N/A</span>
                    </button>
                  </>
                )}
              </div>

              {/* Ações - sempre visíveis para documentar qualquer item */}
              <div className="mt-3 pt-3 border-t border-base-200">
                <div className="flex gap-2">
                  <button
                    className={`btn btn-outline btn-sm gap-1 flex-1 border-primary text-primary hover:bg-primary hover:text-primary-content ${
                      (!item.resposta || item.resposta === 'nao_avaliado') ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    onClick={() => openPhotoModal(item)}
                    disabled={!item.resposta || item.resposta === 'nao_avaliado'}
                    title={(!item.resposta || item.resposta === 'nao_avaliado') ? 'Marque uma resposta antes de adicionar fotos' : ''}
                  >
                    <Camera className="w-4 h-4" />
                    {item.fotos?.length > 0 ? `Foto (${item.fotos.length})` : 'Adicionar Foto'}
                  </button>
                  {item.resposta === 'nao_conforme' && (
                    <button
                      className="btn btn-ghost btn-sm gap-1 flex-1"
                      onClick={() => handleGerarTextoIa(item)}
                      disabled={processingIa === item.id}
                    >
                      {processingIa === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Gerar Texto
                    </button>
                  )}
                </div>

                {/* Indicadores de dados preenchidos */}
                {(item.descricaoIa || item.complementoDescricao || item.observacao || item.fotos?.length > 0) && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {item.fotos?.length > 0 && (
                      <span className="badge badge-primary badge-sm gap-1">
                        <Camera className="w-3 h-3" /> {item.fotos.length} foto(s)
                      </span>
                    )}
                    {item.descricaoIa && (
                      <span className="badge badge-success badge-sm gap-1">
                        <Sparkles className="w-3 h-3" /> IA
                      </span>
                    )}
                    {item.complementoDescricao && (
                      <span className="badge badge-info badge-sm gap-1">
                        <Edit3 className="w-3 h-3" /> Descrição
                      </span>
                    )}
                    {item.observacao && (
                      <span className="badge badge-warning badge-sm gap-1">
                        <MessageSquare className="w-3 h-3" /> Obs.
                      </span>
                    )}
                  </div>
                )}

                {/* Detalhes expandidos */}
                {(item.descricaoIa || item.complementoDescricao || item.observacao) && (
                  <div className="mt-3">
                    <button
                      className="flex items-center justify-between w-full text-left text-sm font-medium text-primary"
                      onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                    >
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        Ver detalhes
                      </span>
                      {expandedItem === item.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <AnimatePresence>
                      {expandedItem === item.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 p-3 bg-base-200 rounded-lg text-sm space-y-3">
                            {item.descricaoIa && (
                              <div>
                                <p className="font-medium text-base-content/70">Descrição da IA:</p>
                                <p>{item.descricaoIa}</p>
                              </div>
                            )}
                            {item.complementoDescricao && (
                              <div className="border-l-2 border-info pl-3">
                                <p className="font-medium text-info">Descrição do Auditor:</p>
                                <p>{item.complementoDescricao}</p>
                              </div>
                            )}
                            {item.referenciaLegal && (
                              <div>
                                <p className="font-medium text-base-content/70">Referência Legal:</p>
                                <p className="text-info">{item.referenciaLegal}</p>
                              </div>
                            )}
                            {item.observacao && (
                              <div className="border-l-2 border-warning pl-3">
                                <p className="font-medium text-warning">Observação:</p>
                                <p>{item.observacao}</p>
                              </div>
                            )}
                            {item.planoAcaoSugerido && (
                              <div>
                                <p className="font-medium text-base-content/70">Plano de Ação:</p>
                                <ul className="list-disc list-inside text-xs mt-1 space-y-1">
                                  {item.planoAcaoSugerido.split('\n').map((acao, i) => (
                                    <li key={i}>{acao}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <button
                              onClick={() => openPhotoModal(item)}
                              className="btn btn-ghost btn-xs gap-1"
                            >
                              <Edit3 className="w-3 h-3" />
                              Editar
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleImageSelect}
      />

      {/* Modal de Foto + IA */}
      <AnimatePresence>
        {itemModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal modal-open"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Documentar Item</h3>
                <button onClick={() => setItemModal(null)} className="btn btn-ghost btn-sm btn-circle">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Pergunta do checklist */}
              <div className="bg-base-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-base-content/70">Item do Checklist:</p>
                <p className="font-medium">{itemModal.item.templateItem.pergunta}</p>
              </div>

              {/* Área de fotos */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">
                    <Camera className="w-4 h-4 inline mr-1" />
                    Fotos da Evidência
                  </label>
                  <span className="text-xs text-base-content/60">
                    {itemModal.fotos.length}/{MAX_FOTOS_POR_ITEM}
                  </span>
                </div>

                {/* Grid de fotos */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {itemModal.fotos.map((foto, index) => (
                    <div key={index} className="relative aspect-square">
                      <img
                        src={foto.preview}
                        alt={`Foto ${index + 1}`}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      {foto.isAnalyzing && (
                        <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-white" />
                        </div>
                      )}
                      {foto.analiseIa && (
                        <div className="absolute bottom-1 left-1 flex gap-1 flex-wrap">
                          {!foto.analiseIa.imagemRelevante && (
                            <span className="badge badge-xs badge-error" title="Imagem não relacionada ao item do checklist">
                              <AlertCircle className="w-2 h-2 mr-1" />
                              Não relevante
                            </span>
                          )}
                          {foto.analiseIa.imagemRelevante && (
                            <span className={`badge badge-xs ${
                              foto.analiseIa.tipoNaoConformidade === 'Nenhuma identificada' 
                                ? 'badge-success' 
                                : foto.analiseIa.gravidade === 'critica' ? 'badge-error' 
                                : foto.analiseIa.gravidade === 'alta' ? 'badge-warning' 
                                : 'badge-info'
                            }`}>
                              <Sparkles className="w-2 h-2" />
                            </span>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => handleRemoveFoto(index)}
                        className="absolute top-1 right-1 btn btn-circle btn-xs btn-error"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {/* Botão adicionar mais */}
                  {itemModal.fotos.length < MAX_FOTOS_POR_ITEM && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square border-2 border-dashed border-base-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-colors"
                    >
                      <ImageIcon className="w-6 h-6 text-base-content/40" />
                      <span className="text-xs text-base-content/60">Adicionar</span>
                    </button>
                  )}
                </div>

                {itemModal.fotos.length === 0 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-24 border-2 border-dashed border-base-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <Camera className="w-8 h-8 text-base-content/40" />
                    <span className="text-sm text-base-content/60">Clique para adicionar fotos (até {MAX_FOTOS_POR_ITEM})</span>
                  </button>
                )}
              </div>

              {/* Descrição IA existente */}
              {itemModal.descricaoIaExistente && (
                <div className="mb-4">
                  <p className="text-sm font-medium flex items-center gap-1 mb-2">
                    <Sparkles className="w-4 h-4 text-success" />
                    Análise Salva Anteriormente
                  </p>
                  <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-sm">
                    <p className="whitespace-pre-line">{itemModal.descricaoIaExistente}</p>
                  </div>
                  {itemModal.item.referenciaLegal && (
                    <p className="text-xs text-info mt-2">📋 {itemModal.item.referenciaLegal}</p>
                  )}
                </div>
              )}

              {/* Alerta se houver imagens não relevantes */}
              {itemModal.fotos.some((f) => !f.isExisting && f.analiseIa && !f.analiseIa.imagemRelevante) && (
                <div className="alert alert-warning mb-4">
                  <AlertCircle className="w-5 h-5" />
                  <div>
                    <h3 className="font-bold">Atenção: Imagem não relevante</h3>
                    <div className="text-sm">
                      Uma ou mais imagens não parecem estar relacionadas ao item do checklist. 
                      Por favor, remova as imagens inadequadas ou adicione uma observação explicando por que a imagem é relevante.
                    </div>
                  </div>
                </div>
              )}

              {/* Novas análises da IA */}
              {itemModal.fotos.some((f) => !f.isExisting && f.analiseIa) && (
                <div className="space-y-3 mb-4">
                  <p className="text-sm font-medium flex items-center gap-1">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Novas Análises
                  </p>
                  {itemModal.fotos.map((foto, index) => (
                    !foto.isExisting && foto.analiseIa && (
                      <div key={index} className={`rounded-lg p-3 text-sm ${
                        !foto.analiseIa.imagemRelevante 
                          ? 'bg-error/10 border-2 border-error/50' 
                          : 'bg-primary/10 border border-primary/20'
                      }`}>
                        <div className="flex items-start gap-2">
                          <img src={foto.preview} alt="" className="w-12 h-12 object-cover rounded" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="font-medium">Nova Foto</span>
                              {!foto.analiseIa.imagemRelevante && (
                                <span className="badge badge-sm badge-error" title="Esta imagem não parece estar relacionada ao item do checklist">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  IMAGEM NÃO RELEVANTE
                                </span>
                              )}
                              {foto.analiseIa.tipoNaoConformidade !== 'Nenhuma identificada' && foto.analiseIa.imagemRelevante && (
                                <span className={`badge badge-xs ${
                                  foto.analiseIa.gravidade === 'critica' ? 'badge-error' :
                                  foto.analiseIa.gravidade === 'alta' ? 'badge-warning' :
                                  foto.analiseIa.gravidade === 'media' ? 'badge-info' : 'badge-ghost'
                                }`}>
                                  {foto.analiseIa.gravidade}
                                </span>
                              )}
                            </div>
                            {!foto.analiseIa.imagemRelevante ? (
                              <div className="space-y-2">
                                <div className="bg-error/20 border border-error/30 rounded p-2">
                                  <p className="text-error font-semibold text-sm mb-1">
                                    ⚠️ IMAGEM NÃO RELACIONADA AO ITEM
                                  </p>
                                  <p className="text-error text-xs mb-2">
                                    Esta imagem não parece estar relacionada ao item do checklist "{itemModal.item.templateItem.pergunta}". 
                                    Por favor, remova esta imagem ou adicione uma observação explicando sua relevância.
                                  </p>
                                  {foto.analiseIa.descricaoIa && (
                                    <div className="mt-2 pt-2 border-t border-error/30">
                                      <p className="text-error text-xs font-medium mb-1">Motivo da não relevância:</p>
                                      <p className="text-error/90 text-xs">{foto.analiseIa.descricaoIa}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-base-content/80">{foto.analiseIa.descricaoIa}</p>
                                {foto.analiseIa.tipoNaoConformidade !== 'Nenhuma identificada' && (
                                  <p className="text-xs text-warning mt-1">⚠️ {foto.analiseIa.tipoNaoConformidade}</p>
                                )}
                                {foto.analiseIa.referenciaLegal && (
                                  <p className="text-xs text-info mt-1">📋 {foto.analiseIa.referenciaLegal}</p>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  ))}

                  {/* Sugestões consolidadas das novas fotos */}
                  {(() => {
                    const todasSugestoes = itemModal.fotos
                      .filter((f) => !f.isExisting && f.analiseIa?.sugestoes)
                      .flatMap((f) => f.analiseIa!.sugestoes);
                    const sugestoesUnicas = [...new Set(todasSugestoes)];
                    if (sugestoesUnicas.length === 0) return null;
                    return (
                      <div className="bg-success/10 border border-success/20 rounded-lg p-3">
                        <p className="text-sm font-medium mb-2">Sugestões de Correção:</p>
                        <ul className="text-sm space-y-1">
                          {sugestoesUnicas.map((s, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-success">•</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Observação */}
              <div className="form-control mb-6">
                <label className="label">
                  <span className="label-text font-medium">
                    <MessageSquare className="w-4 h-4 inline mr-1" />
                    Observação do Auditor <span className="text-error">*</span>
                  </span>
                </label>
                <textarea
                  className={`textarea textarea-bordered ${!itemModal.observacao || itemModal.observacao.trim() === '' ? 'textarea-error' : ''}`}
                  placeholder="Descreva o que foi observado neste item..."
                  rows={3}
                  value={itemModal.observacao}
                  onChange={(e) => setItemModal((prev) => prev ? { ...prev, observacao: e.target.value } : null)}
                  required
                />
                {(!itemModal.observacao || itemModal.observacao.trim() === '') && (
                  <label className="label">
                    <span className="label-text-alt text-error">A observação é obrigatória</span>
                  </label>
                )}
              </div>

              {/* Ações */}
              <div className="modal-action">
                <button className="btn btn-ghost" onClick={() => setItemModal(null)}>
                  Cancelar
                </button>
                <button
                  className="btn btn-primary gap-2"
                  onClick={handleSaveItemModal}
                  disabled={
                    itemModal.isSaving || 
                    itemModal.fotos.some((f) => f.isAnalyzing) ||
                    !itemModal.observacao || 
                    itemModal.observacao.trim() === ''
                  }
                >
                  {itemModal.isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar
                    </>
                  )}
                </button>
              </div>
            </motion.div>
            <div className="modal-backdrop" onClick={() => setItemModal(null)}></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão flutuante Encerrar - apenas para auditorias em andamento */}
      {auditoria.status === 'em_andamento' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 md:bottom-6 left-0 right-0 px-4 z-40"
        >
          <div className="max-w-3xl mx-auto space-y-2">
            {!obrigatoriasStatus.completo && obrigatoriasStatus.total > 0 && (
              <div className="bg-warning/10 text-warning text-center text-sm py-2 px-4 rounded-lg border border-warning/20">
                <AlertCircle className="w-4 h-4 inline-block mr-1" />
                {obrigatoriasStatus.total - obrigatoriasStatus.respondidas} pergunta(s) obrigatória(s) pendente(s)
              </div>
            )}
            <button
              onClick={() => setShowFinalModal(true)}
              disabled={!obrigatoriasStatus.completo}
              className={`btn w-full shadow-lg gap-2 ${
                obrigatoriasStatus.completo 
                  ? 'btn-primary' 
                  : 'btn-disabled bg-base-300 text-base-content/40'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              Encerrar Auditoria
            </button>
          </div>
        </motion.div>
      )}

      {/* Modal de finalização */}
      {showFinalModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Encerrar Auditoria</h3>
            <p className="py-4 text-base-content/60">
              Adicione observações gerais sobre a auditoria (opcional).
            </p>
            {erroFinalizar && (
              <div className="alert alert-error mb-4">
                <AlertTriangle className="w-5 h-5" />
                <span>{erroFinalizar}</span>
                <button 
                  onClick={() => setErroFinalizar('')} 
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <textarea
              className="textarea textarea-bordered w-full"
              placeholder="Observações gerais..."
              rows={4}
              value={observacoesGerais}
              onChange={(e) => setObservacoesGerais(e.target.value)}
            ></textarea>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setShowFinalModal(false); setErroFinalizar(''); }}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleFinalizar} disabled={finalizando}>
                {finalizando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => { setShowFinalModal(false); setErroFinalizar(''); }}></div>
        </div>
      )}
    </AppLayout>
  );
}

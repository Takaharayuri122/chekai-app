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
  Clock,
} from 'lucide-react';
import { AppLayout, PageHeader } from '@/components';
import {
  auditoriaService,
  iaService,
  type Auditoria,
  type AuditoriaItem,
  type AnaliseChecklistResponse,
  TipoRespostaCustomizada,
} from '@/lib/api';
import { toastService } from '@/lib/toast';
import {
  buscarAuditoriaPorId,
  responderItemAuditoria,
  adicionarFotoAuditoria,
  finalizarAuditoria,
  ehIdLocal,
} from '@/lib/offline/auditoria-offline';
import { useOfflineStore } from '@/lib/store-offline';
import * as cache from '@/lib/offline/cache';
import { renderEmoji } from '@/lib/emoji';

type RespostaType = 'conforme' | 'nao_conforme' | 'nao_aplicavel' | string;

interface FotoPreview {
  id?: string;
  localId?: string;
  file?: File;
  preview: string;
  analiseIa?: AnaliseChecklistResponse;
  statusUpload?: 'enviando' | 'processando' | 'pronta';
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
  const [finalizando, setFinalizando] = useState(false);
  const [showFinalModal, setShowFinalModal] = useState(false);
  const [observacoesGerais, setObservacoesGerais] = useState('');
  const [erroFinalizar, setErroFinalizar] = useState('');
  const [respostasCustomizadas, setRespostasCustomizadas] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [ultimaHoraSalva, setUltimaHoraSalva] = useState<Date | null>(null);
  const [itensObrigatoriosNaoAvaliados, setItensObrigatoriosNaoAvaliados] = useState<Set<string>>(new Set());

  // Modal de foto + IA
  const [itemModal, setItemModal] = useState<ItemModalState | null>(null);
  const [activeTab, setActiveTab] = useState<'fotos' | 'observacao'>('fotos');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Refs para scroll automático até o último item respondido
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollRealizado = useRef(false);
  const prevItemIdRef = useRef<string | null>(null);

  const formatarHora = (data: Date) => {
    return data.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const carregarAuditoria = useCallback(async () => {
    try {
      scrollRealizado.current = false;
      const data = await buscarAuditoriaPorId(id);
      setAuditoria(data);
      const customizadas: Record<string, string> = {};
      data.itens.forEach((item) => {
        if (item.templateItem?.tipoRespostaCustomizada && item.resposta) {
          customizadas[item.id] = item.resposta;
        }
      });
      setRespostasCustomizadas(customizadas);
    } catch {
      router.push('/admin/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    carregarAuditoria();
  }, [carregarAuditoria]);

  // Quando abrir modal, definir tab inicial (sempre fotos; obrigatoriedade não esconde a tab)
  useEffect(() => {
    if (itemModal) {
      if (prevItemIdRef.current !== itemModal.item.id) {
        setActiveTab('fotos');
        prevItemIdRef.current = itemModal.item.id;
      }
    } else {
      prevItemIdRef.current = null;
    }
  }, [itemModal]);

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!itemModal) return;

      // Alt+1 = Fotos, Alt+2 = Observação
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        setActiveTab('fotos');
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        setActiveTab('observacao');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [itemModal]);

  // Scroll automático até o último item respondido quando a auditoria carregar
  useEffect(() => {
    if (!loading && auditoria && auditoria.status === 'em_andamento' && !scrollRealizado.current) {
      // Encontra o último item respondido (que tem resposta preenchida)
      const itensComResposta = auditoria.itens
        .filter((item) => item.resposta && item.resposta !== 'nao_avaliado')
        .sort((a, b) => {
          // Ordena por ordem do templateItem
          const ordemA = a.templateItem?.ordem ?? 0;
          const ordemB = b.templateItem?.ordem ?? 0;
          return ordemA - ordemB;
        });

      if (itensComResposta.length > 0) {
        const ultimoItem = itensComResposta[itensComResposta.length - 1];
        
        // Aguarda um pouco para garantir que o DOM está renderizado
        setTimeout(() => {
          const itemRef = itemRefs.current.get(ultimoItem.id);
          if (itemRef) {
            itemRef.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
            scrollRealizado.current = true;
          }
        }, 500);
      } else {
        // Se não houver itens respondidos, marca como realizado para não tentar novamente
        scrollRealizado.current = true;
      }
    }
  }, [loading, auditoria]);

  const handleResposta = async (itemId: string, resposta: RespostaType) => {
    if (!auditoria) return;
    // Verificar se a auditoria está finalizada
    if (auditoria.status === 'finalizada') {
      toastService.warning('Não é possível editar uma auditoria finalizada. Reabra a auditoria para fazer alterações.');
      return;
    }
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
      setSalvando(true);
      await responderItemAuditoria(auditoria.id, itemId, resposta);
      setUltimaHoraSalva(new Date());
      // Remove o item da lista de obrigatórios não avaliados se foi respondido
      if (resposta && resposta !== 'nao_avaliado') {
        setItensObrigatoriosNaoAvaliados((prev) => {
          const novo = new Set(prev);
          novo.delete(itemId);
          return novo;
        });
      }
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
    } finally {
      setSalvando(false);
    }
  };

  const handleRespostaCustomizada = async (itemId: string, valor: string) => {
    if (!auditoria) return;
    if (auditoria.status === 'finalizada') {
      toastService.warning('Não é possível editar uma auditoria finalizada. Reabra a auditoria para fazer alterações.');
      return;
    }
    setRespostasCustomizadas((prev) => ({ ...prev, [itemId]: valor }));
    setAuditoria((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        itens: prev.itens.map((item) =>
          item.id === itemId ? { ...item, resposta: valor } : item
        ),
      };
    });
    try {
      setSalvando(true);
      await responderItemAuditoria(auditoria.id, itemId, valor);
      setUltimaHoraSalva(new Date());
      // Remove o item da lista de obrigatórios não avaliados se foi respondido
      if (valor && valor.trim() !== '') {
        setItensObrigatoriosNaoAvaliados((prev) => {
          const novo = new Set(prev);
          novo.delete(itemId);
          return novo;
        });
      }
    } catch (error) {
      // Erro já é tratado pelo interceptor
      setAuditoria((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          itens: prev.itens.map((item) =>
            item.id === itemId ? { ...item, resposta: item.resposta } : item
          ),
        };
      });
    } finally {
      setSalvando(false);
    }
  };

  const openPhotoModal = (item: AuditoriaItem) => {
    const isFinalizada = auditoria?.status === 'finalizada';
    // Carregar fotos existentes do item com suas análises
    const fotosExistentes: FotoPreview[] = (item.fotos || []).map((foto) => {
      let analiseIa: AnaliseChecklistResponse | undefined;
      if (foto.analiseIa) {
        try {
          analiseIa = JSON.parse(foto.analiseIa);
        } catch {
          // Se não for JSON válido, trata como texto simples
          analiseIa = {
            descricaoIa: foto.analiseIa,
            tipoNaoConformidade: '',
            gravidade: '',
            sugestoes: [],
            referenciaLegal: '',
            imagemRelevante: true,
          };
        }
      }
      return {
        id: foto.id,
        preview: foto.url,
        isExisting: true,
        analiseIa,
      };
    });
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
    const files = Array.from(e.target.files || []);
    if (!files.length || !itemModal || !auditoria) return;
    // Verificar se a auditoria está finalizada
    if (auditoria.status === 'finalizada') {
      toastService.warning('Não é possível adicionar fotos em uma auditoria finalizada. Reabra a auditoria para fazer alterações.');
      if (e.target) e.target.value = '';
      return;
    }
    if (itemModal.fotos.length >= MAX_FOTOS_POR_ITEM) {
      toastService.warning(`Máximo de ${MAX_FOTOS_POR_ITEM} fotos por item`);
      if (e.target) e.target.value = '';
      return;
    }
    const vagasDisponiveis = MAX_FOTOS_POR_ITEM - itemModal.fotos.length;
    const filesParaProcessar = files.slice(0, vagasDisponiveis);
    if (files.length > vagasDisponiveis) {
      toastService.warning(`Foram selecionadas muitas fotos. Apenas ${vagasDisponiveis} serão adicionadas agora.`);
    }
    const itemId = itemModal.item.id;
    const perguntaChecklist = itemModal.item.templateItem.pergunta;
    const categoriaChecklist = itemModal.item.templateItem.categoria || 'geral';
    const tipoEstabelecimento = auditoria?.template?.tipoAtividade || 'serviço de alimentação';
    const fotosSelecionadas = filesParaProcessar.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      localId: `preview-${crypto.randomUUID()}`,
    }));
    setItemModal((prev) => {
      if (!prev) return null;
      const novasFotos: FotoPreview[] = fotosSelecionadas.map((fotoSelecionada) => ({
        localId: fotoSelecionada.localId,
        file: fotoSelecionada.file,
        preview: fotoSelecionada.preview,
        statusUpload: 'enviando',
        isExisting: false,
      }));
      return {
        ...prev,
        fotos: [...prev.fotos, ...novasFotos],
      };
    });
    for (const fotoSelecionada of fotosSelecionadas) {
      const { file, preview, localId } = fotoSelecionada;
      let fotoSalva: { id: string; url: string } | null = null;
      try {
        setSalvando(true);
        fotoSalva = await adicionarFotoAuditoria(auditoria.id, itemId, file);
        setUltimaHoraSalva(new Date());
        setSalvando(false);
        setItemModal((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            fotos: prev.fotos.map((foto) =>
              foto.localId === localId
                ? {
                    ...foto,
                    id: fotoSalva!.id,
                    preview: fotoSalva!.url || preview,
                    statusUpload: useOfflineStore.getState().isOnline ? 'processando' : 'pronta',
                    isExisting: true,
                  }
                : foto
            ),
          };
        });
        setAuditoria((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            itens: prev.itens.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    fotos: [...(item.fotos || []), {
                      id: fotoSalva!.id,
                      url: fotoSalva!.url,
                    }],
                  }
                : item
            ),
          };
        });
        if (useOfflineStore.getState().isOnline) {
          try {
            const analise = await iaService.analisarImagemChecklist(
              file,
              perguntaChecklist,
              categoriaChecklist,
              tipoEstabelecimento
            );
            setSalvando(true);
            await auditoriaService.atualizarAnaliseFoto(
              auditoria.id,
              itemId,
              fotoSalva.id,
              JSON.stringify(analise)
            );
            setUltimaHoraSalva(new Date());
            setSalvando(false);
            setItemModal((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                fotos: prev.fotos.map((foto) =>
                  foto.localId === localId
                    ? {
                        ...foto,
                        analiseIa: analise,
                        statusUpload: 'pronta',
                      }
                    : foto
                ),
              };
            });
            setAuditoria((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                itens: prev.itens.map((item) =>
                  item.id === itemId
                    ? {
                        ...item,
                        fotos: item.fotos.map((foto) =>
                          foto.id === fotoSalva!.id
                            ? { ...foto, analiseIa: JSON.stringify(analise) }
                            : foto
                        ),
                      }
                    : item
                ),
              };
            });
          } catch (analiseError: any) {
            const errorMessage = analiseError?.response?.data?.message || analiseError?.message || 'Erro desconhecido';
            if (errorMessage.includes('crédito') || errorMessage.includes('limite')) {
              toastService.warning('Foto salva, mas não foi possível analisar: créditos insuficientes.');
            } else {
              toastService.warning(`Foto salva, mas não foi possível analisar: ${errorMessage}`);
            }
            setItemModal((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                fotos: prev.fotos.map((foto) =>
                  foto.localId === localId
                    ? {
                        ...foto,
                        statusUpload: 'pronta',
                      }
                    : foto
                ),
              };
            });
          }
        } else {
          setItemModal((prev) => {
            if (!prev) return null;
            return {
              ...prev,
              fotos: prev.fotos.map((foto) =>
                foto.localId === localId
                  ? {
                      ...foto,
                      statusUpload: 'pronta',
                    }
                  : foto
              ),
            };
          });
        }
      } catch (error: unknown) {
        const err = error as { response?: { data?: { message?: string } }; message?: string };
        const errorMessage = err?.response?.data?.message || err?.message || 'Erro ao salvar foto';
        toastService.error(`Erro ao salvar foto: ${errorMessage}`);
        setItemModal((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            fotos: prev.fotos.filter((foto) => foto.localId !== localId),
          };
        });
      }
    }
    if (e.target) e.target.value = '';
  };

  const handleRemoveFoto = async (index: number) => {
    if (!itemModal || !auditoria) return;
    // Verificar se a auditoria está finalizada
    if (auditoria.status === 'finalizada') {
      toastService.warning('Não é possível remover fotos de uma auditoria finalizada. Reabra a auditoria para fazer alterações.');
      return;
    }
    const fotoParaRemover = itemModal.fotos[index];

    // Remove do estado local imediatamente
    setItemModal((prev) => {
      if (!prev) return null;
      const fotosAtualizadas = prev.fotos.filter((_, i) => i !== index);
      return { ...prev, fotos: fotosAtualizadas };
    });

    const auditoriaAtualizada = (prev: Auditoria | null): Auditoria | null => {
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
    };

    const aplicarRemocao = () => {
      setAuditoria((prev) => {
        const next = auditoriaAtualizada(prev);
        if (next && !useOfflineStore.getState().isOnline) {
          cache.salvarAuditoria(next.id, next);
        }
        return next;
      });
    };

    if (fotoParaRemover.id && fotoParaRemover.isExisting) {
      const fotoLocal = ehIdLocal(fotoParaRemover.id) || fotoParaRemover.id.startsWith('local-');
      if (fotoLocal || !useOfflineStore.getState().isOnline) {
        aplicarRemocao();
      } else {
        try {
          setSalvando(true);
          await auditoriaService.removerFoto(auditoria.id, itemModal.item.id, fotoParaRemover.id);
          setUltimaHoraSalva(new Date());
          setSalvando(false);
          aplicarRemocao();
        } catch {
          setItemModal((prev) => {
            if (!prev) return null;
            const fotosAtualizadas = [...prev.fotos];
            fotosAtualizadas.splice(index, 0, fotoParaRemover);
            return { ...prev, fotos: fotosAtualizadas };
          });
        }
      }
    }
  };

  const getOpcaoConfig = (item: AuditoriaItem, resposta: string) => {
    const configs = item.templateItem.opcoesRespostaConfig;

    console.log('🔍 getOpcaoConfig DEBUG:', {
      resposta,
      configs,
      configsLength: configs?.length,
      templateItemId: item.templateItem.id,
    });

    if (!configs || configs.length === 0) {
      console.log('⚠️ Usando comportamento legado (sem configs)');
      // Comportamento legado: observação sempre obrigatória, foto opcional
      return {
        fotoObrigatoria: false,
        observacaoObrigatoria: true,
      };
    }

    const config = configs.find(c => c.valor === resposta);
    console.log('📌 Config encontrado:', config);

    const resultado = config || {
      fotoObrigatoria: false,
      observacaoObrigatoria: false,
    };

    console.log('✅ Retornando config:', resultado);
    return resultado;
  };

  const handleSaveItemModal = async () => {
    if (!itemModal || !auditoria) return;
    // Verificar se a auditoria está finalizada
    if (auditoria.status === 'finalizada') {
      toastService.warning('Não é possível editar uma auditoria finalizada. Reabra a auditoria para fazer alterações.');
      return;
    }

    const temResposta = Boolean(itemModal.item.resposta && itemModal.item.resposta !== 'nao_avaliado');
    const temFotos = itemModal.fotos.length > 0;
    if (!temResposta && !temFotos) {
      toastService.error('Adicione pelo menos uma foto ou selecione uma resposta');
      return;
    }

    if (temResposta) {
      const opcaoConfig = getOpcaoConfig(itemModal.item, itemModal.item.resposta);
      if (opcaoConfig.fotoObrigatoria && itemModal.fotos.length === 0) {
        setActiveTab('fotos');
        toastService.error('Esta resposta requer pelo menos uma foto');
        return;
      }
      if (opcaoConfig.observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '')) {
        setActiveTab('observacao');
        toastService.error('Esta resposta requer uma observação');
        return;
      }
    }

    // Validar imagens não relevantes
    const imagensNaoRelevantes = itemModal.fotos.filter(
      (f) => f.analiseIa && !f.analiseIa.imagemRelevante
    );

    if (imagensNaoRelevantes.length > 0 && (!itemModal.observacao || itemModal.observacao.trim() === '')) {
      setActiveTab('observacao'); // Mudar para tab de observação
      toastService.error(
        'Por favor, remova as imagens inadequadas ou adicione uma observação explicando por que a imagem é relevante.'
      );
      return;
    }

    setItemModal((prev) => prev ? { ...prev, isSaving: true } : null);
    // Preserva a resposta atual do item
    const respostaAtual = itemModal.item.resposta || 'nao_avaliado';
    try {
      // Salva a observação e a descrição da IA (se existir)
      setSalvando(true);
      await responderItemAuditoria(
        auditoria.id,
        itemModal.item.id,
        respostaAtual,
        {
          observacao: itemModal.observacao,
          descricaoIa: itemModal.descricaoIaExistente || itemModal.item.descricaoIa,
        }
      );
      setUltimaHoraSalva(new Date());
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
                  descricaoIa: itemModal.descricaoIaExistente || itemModal.item.descricaoIa || item.descricaoIa,
                }
              : item
          ),
        };
      });
      setItemModal(null);
    } catch (error) {
      // Erro já é tratado pelo interceptor
      setItemModal((prev) => prev ? { ...prev, isSaving: false } : null);
    }
  };


  const handleFinalizar = async () => {
    if (!auditoria) return;
    setFinalizando(true);
    setErroFinalizar('');
    try {
      await finalizarAuditoria(auditoria.id, observacoesGerais);
      const isOnline = useOfflineStore.getState().isOnline;
      toastService.success(
        isOnline
          ? 'Auditoria finalizada com sucesso!'
          : 'Auditoria salva localmente. Será finalizada no servidor quando você estiver online.'
      );
      setShowFinalModal(false);
      setItensObrigatoriosNaoAvaliados(new Set());
      router.push('/admin/dashboard');
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

  const getPontuacaoParaOpcao = (item: AuditoriaItem, opcao: string): number | null | undefined => {
    const configs = item.templateItem?.opcoesRespostaConfig ?? [];
    const opcoesOrdenadas = item.templateItem?.usarRespostasPersonalizadas && item.templateItem?.opcoesResposta?.length
      ? item.templateItem.opcoesResposta
      : ['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'];
    const config = configs.find((c) => c.valor === opcao);
    if (typeof config?.pontuacao === 'number') return config.pontuacao;
    if (config?.pontuacao === null) return null;
    const idx = opcoesOrdenadas.indexOf(opcao);
    if (idx < 0) return undefined;
    const configPrimeira = configs.find((c) => c.valor === opcoesOrdenadas[0]);
    const base = typeof configPrimeira?.pontuacao === 'number' ? configPrimeira.pontuacao : 1;
    return base - idx;
  };

  const getClassePorPontuacao = (pontuacao: number | null | undefined): string => {
    if (pontuacao == null || (typeof pontuacao !== 'number')) return 'btn-warning';
    if (pontuacao >= 1) return 'btn-success';
    if (pontuacao === 0) return 'btn-warning';
    return 'btn-error';
  };

  const getRespostaStyle = (item: AuditoriaItem, tipo: RespostaType, isPersonalizada: boolean = false) => {
    const isSelected = item.resposta === tipo;
    const base = 'btn btn-sm flex-1';
    if (!isSelected) return `${base} btn-ghost`;
    const pontuacao = getPontuacaoParaOpcao(item, tipo);
    return `${base} ${getClassePorPontuacao(pontuacao)}`;
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
        backHref="/admin/dashboard"
        action={
          <div className="flex items-center gap-2 text-sm text-base-content/70">
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="hidden sm:inline">Salvando...</span>
              </>
            ) : ultimaHoraSalva ? (
              <>
                <Clock className="w-4 h-4 text-success" />
                <span className="hidden sm:inline">Salvo às</span>
                <span className="font-medium">{formatarHora(ultimaHoraSalva)}</span>
              </>
            ) : null}
          </div>
        }
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
      <div className="px-4 py-4 lg:px-8 space-y-4 pb-36 md:pb-24">
        {[...auditoria.itens]
          .sort((a, b) => {
            const ordemA = a.templateItem?.ordem ?? 0;
            const ordemB = b.templateItem?.ordem ?? 0;
            return ordemA - ordemB;
          })
          .map((item, index) => (
          <motion.div
            key={item.id}
            ref={(el) => {
              if (el) {
                itemRefs.current.set(item.id, el);
              } else {
                itemRefs.current.delete(item.id);
              }
            }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.02 }}
            className={`card bg-base-100 shadow-sm border ${
              itensObrigatoriosNaoAvaliados.has(item.id)
                ? 'border-error border-2'
                : 'border-base-300'
            }`}
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

              {/* Campos de resposta */}
              <div className="mt-3">
                {item.templateItem.tipoRespostaCustomizada ? (
                  // Campos customizados
                  <div className="space-y-2">
                    {item.templateItem.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO && (
                      <textarea
                        className="textarea textarea-bordered w-full"
                        placeholder="Digite sua resposta..."
                        value={(() => {
                          const raw = respostasCustomizadas[item.id] ?? item.resposta ?? '';
                          return raw === 'nao_avaliado' ? '' : raw;
                        })()}
                        onChange={(e) => {
                          setRespostasCustomizadas((prev) => ({ ...prev, [item.id]: e.target.value }));
                        }}
                        onBlur={(e) => {
                          if (e.target.value !== (item.resposta || '')) {
                            handleRespostaCustomizada(item.id, e.target.value);
                          }
                        }}
                        disabled={auditoria.status === 'finalizada'}
                        rows={3}
                      />
                    )}
                    {item.templateItem.tipoRespostaCustomizada === TipoRespostaCustomizada.NUMERO && (
                      <input
                        type="number"
                        className="input input-bordered w-full"
                        placeholder="Digite um número..."
                        value={(() => {
                          const raw = respostasCustomizadas[item.id] ?? item.resposta ?? '';
                          if (raw === '' || raw === 'nao_avaliado') return '';
                          const n = Number(raw);
                          return Number.isNaN(n) ? '' : raw;
                        })()}
                        onChange={(e) => {
                          setRespostasCustomizadas((prev) => ({ ...prev, [item.id]: e.target.value }));
                        }}
                        onBlur={(e) => {
                          if (e.target.value !== (item.resposta || '')) {
                            handleRespostaCustomizada(item.id, e.target.value);
                          }
                        }}
                        disabled={auditoria.status === 'finalizada'}
                      />
                    )}
                    {item.templateItem.tipoRespostaCustomizada === TipoRespostaCustomizada.DATA && (
                      <input
                        type="date"
                        className="input input-bordered w-full"
                        value={(() => {
                          const raw = respostasCustomizadas[item.id] ?? item.resposta ?? '';
                          if (raw === '' || raw === 'nao_avaliado') return '';
                          return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : '';
                        })()}
                        onChange={(e) => handleRespostaCustomizada(item.id, e.target.value)}
                        disabled={auditoria.status === 'finalizada'}
                      />
                    )}
                    {item.templateItem.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT && (
                      <select
                        className="select select-bordered w-full"
                        value={(() => {
                          const raw = respostasCustomizadas[item.id] ?? item.resposta ?? '';
                          if (raw === '' || raw === 'nao_avaliado') return '';
                          const opcoes = item.templateItem.opcoesResposta ?? [];
                          return opcoes.includes(raw) ? raw : '';
                        })()}
                        onChange={(e) => handleRespostaCustomizada(item.id, e.target.value)}
                        disabled={auditoria.status === 'finalizada'}
                      >
                        <option value="">Selecione uma opção</option>
                        {item.templateItem.opcoesResposta?.map((opcao, idx) => (
                          <option key={idx} value={opcao}>
                            {renderEmoji(opcao)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : item.templateItem.usarRespostasPersonalizadas && item.templateItem.opcoesResposta && item.templateItem.opcoesResposta.length > 0 ? (
                  // Opções personalizadas do template (botões)
                  <div className="flex gap-2 flex-wrap">
                    {item.templateItem.opcoesResposta.map((opcao, idx) => (
                      <button
                        key={idx}
                        className={getRespostaStyle(item, opcao, true)}
                        onClick={() => handleResposta(item.id, opcao)}
                        disabled={auditoria.status === 'finalizada'}
                        title={auditoria.status === 'finalizada' ? 'Auditoria finalizada. Reabra para editar.' : ''}
                      >
                        <span>{renderEmoji(opcao)}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  // Opções padrão
                  <div className="flex gap-2 flex-wrap">
                    <button
                      className={getRespostaStyle(item, 'conforme')}
                      onClick={() => handleResposta(item.id, 'conforme')}
                      disabled={auditoria.status === 'finalizada'}
                      title={auditoria.status === 'finalizada' ? 'Auditoria finalizada. Reabra para editar.' : ''}
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Conforme</span>
                    </button>
                    <button
                      className={getRespostaStyle(item, 'nao_conforme')}
                      onClick={() => handleResposta(item.id, 'nao_conforme')}
                      disabled={auditoria.status === 'finalizada'}
                      title={auditoria.status === 'finalizada' ? 'Auditoria finalizada. Reabra para editar.' : ''}
                    >
                      <XCircle className="w-4 h-4" />
                      <span className="hidden sm:inline">Não Conforme</span>
                    </button>
                    <button
                      className={getRespostaStyle(item, 'nao_aplicavel')}
                      onClick={() => handleResposta(item.id, 'nao_aplicavel')}
                      disabled={auditoria.status === 'finalizada'}
                      title={auditoria.status === 'finalizada' ? 'Auditoria finalizada. Reabra para editar.' : ''}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span className="hidden sm:inline">N/A</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Ações - sempre visíveis para documentar qualquer item */}
              <div className="mt-3 pt-3 border-t border-base-200">
                <div className="flex gap-2">
                  <button
                    className="btn btn-outline btn-sm gap-1 flex-1 border-primary text-primary hover:bg-primary hover:text-primary-content"
                    onClick={() => openPhotoModal(item)}
                    disabled={!auditoria.status}
                    title={
                      auditoria.status === 'finalizada'
                        ? 'Visualizar documentação do item'
                        : 'Adicionar fotos e observações'
                    }
                  >
                    <Camera className="w-4 h-4" />
                    {auditoria.status === 'finalizada' ? 'Ver Documentação' : 'Documentar Item'}
                  </button>
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
        multiple
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
            onClick={(e) => {
              // Não fecha ao clicar fora - removido para evitar perda de dados
              if (e.target === e.currentTarget) {
                e.stopPropagation();
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-box max-w-5xl w-full max-h-[95vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">
                  {auditoria.status === 'finalizada' ? 'Visualizar Item' : 'Documentar Item'}
                </h3>
                <button onClick={() => setItemModal(null)} className="btn btn-ghost btn-sm btn-circle">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {auditoria.status === 'finalizada' && (
                <div className="alert alert-info mb-4">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Auditoria finalizada. Apenas visualização disponível.</span>
                </div>
              )}

              {/* Pergunta do checklist */}
              <div className="bg-base-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-base-content/70">Item do Checklist:</p>
                <p className="font-medium">{itemModal.item.templateItem.pergunta}</p>
              </div>

              {/* Tabs para Fotos e Observação */}
              <div className="mb-6">
                {/* Tab Headers */}
                <div className="tabs tabs-bordered">
                  {(() => {
                    const opcaoConfigModal = getOpcaoConfig(itemModal.item, itemModal.item.resposta || '');
                    const fotoObrigatoria = opcaoConfigModal?.fotoObrigatoria || false;

                    return (
                      <button
                        className={`tab gap-2 ${activeTab === 'fotos' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('fotos')}
                        title="Alt+1 para alternar"
                        aria-keyshortcuts="Alt+1"
                      >
                        <Camera className="w-4 h-4" />
                        Fotos
                        {itemModal.fotos.length > 0 && (
                          <span className="badge badge-neutral badge-sm">{itemModal.fotos.length}</span>
                        )}
                        {fotoObrigatoria && itemModal.fotos.length === 0 && (
                          <span className="badge badge-error badge-sm">Obrigatório</span>
                        )}
                      </button>
                    );
                  })()}

                  {(() => {
                    const opcaoConfigModal = getOpcaoConfig(itemModal.item, itemModal.item.resposta || '');
                    const observacaoObrigatoria = opcaoConfigModal?.observacaoObrigatoria || false;

                    return (
                      <button
                        className={`tab gap-2 ${activeTab === 'observacao' ? 'tab-active' : ''}`}
                        onClick={() => setActiveTab('observacao')}
                        title="Alt+2 para alternar"
                        aria-keyshortcuts="Alt+2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Observação
                        {observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '') && (
                          <span className="badge badge-error badge-sm">Obrigatório</span>
                        )}
                      </button>
                    );
                  })()}
                </div>

                {/* Tab Content */}
                <div className="bg-base-100 border-x border-b border-base-300 rounded-b-box p-6 min-h-[300px]">
                  {/* Tab Fotos - sempre visível; fotoObrigatoria só define se exige pelo menos uma imagem */}
                  {activeTab === 'fotos' && (() => {
                    const opcaoConfigModal = getOpcaoConfig(itemModal.item, itemModal.item.resposta || '');
                    const fotoObrigatoria = opcaoConfigModal?.fotoObrigatoria || false;

                    return (
                      <div>
                        {/* Grid de fotos */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                          {itemModal.fotos.map((foto, index) => (
                            <div key={index} className="relative aspect-square">
                              <img
                                src={foto.preview}
                                alt={`Foto ${index + 1}`}
                                className={`w-full h-full object-cover rounded-lg transition-all duration-300 ${
                                  foto.statusUpload === 'enviando'
                                    ? 'grayscale blur-sm opacity-70'
                                    : foto.statusUpload === 'processando'
                                      ? 'grayscale blur-[1px] opacity-85'
                                      : 'grayscale-0 blur-0 opacity-100'
                                }`}
                              />
                              {foto.statusUpload && foto.statusUpload !== 'pronta' && (
                                <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                                  <div className="flex flex-col items-center gap-2 text-white">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                    <span className="text-[10px] font-medium uppercase tracking-wide">
                                      {foto.statusUpload === 'enviando' ? 'Enviando...' : 'Processando IA...'}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {foto.analiseIa && (
                                <>
                                  {!foto.analiseIa.imagemRelevante && (
                                    <div className="absolute bottom-1 left-1 right-1">
                                      <span
                                        className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-error px-2 py-1 text-[11px] font-semibold leading-none text-error-content shadow-sm"
                                        title="Imagem não relacionada ao item do checklist"
                                      >
                                        <AlertCircle className="w-3 h-3 shrink-0" />
                                        Não relevante
                                      </span>
                                    </div>
                                  )}
                                  {foto.analiseIa.imagemRelevante && (
                                    <div className="absolute bottom-1 left-1">
                                      <span className={`badge badge-xs ${
                                        foto.analiseIa.tipoNaoConformidade === 'Nenhuma identificada'
                                          ? 'badge-success'
                                          : foto.analiseIa.gravidade === 'critica' ? 'badge-error'
                                          : foto.analiseIa.gravidade === 'alta' ? 'badge-warning'
                                          : 'badge-info'
                                      }`}>
                                        <Sparkles className="w-2 h-2" />
                                      </span>
                                    </div>
                                  )}
                                </>
                              )}
                              {auditoria.status !== 'finalizada' && (
                                <button
                                  onClick={() => handleRemoveFoto(index)}
                                  className="absolute top-1 right-1 btn btn-circle btn-xs btn-error"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Botão para adicionar fotos */}
                        {itemModal.fotos.length < MAX_FOTOS_POR_ITEM && auditoria.status !== 'finalizada' && (
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full mt-3 h-20 border-2 border-dashed border-base-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
                          >
                            <Camera className="w-6 h-6 text-base-content/40" />
                            <span className="text-sm text-base-content/60">
                              Clique para adicionar fotos (até {MAX_FOTOS_POR_ITEM} • máx. 5MB cada)
                            </span>
                          </button>
                        )}
                        {itemModal.fotos.length === 0 && auditoria.status === 'finalizada' && (
                          <div className="text-center py-8 text-base-content/60">
                            <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>Nenhuma foto foi adicionada a este item</p>
                          </div>
                        )}

                        {/* Análises de fotos (se houver) */}
                        {itemModal.fotos.some(f => f.analiseIa) && (
                          <div className="mt-4 space-y-3">
                            {itemModal.fotos.map((foto, index) =>
                              foto.analiseIa && (
                                <div key={index} className="alert alert-info text-sm">
                                  <Sparkles className="w-4 h-4" />
                                  <div className="flex-1">
                                    <p className="font-medium">Análise da Foto {index + 1}:</p>
                                    <p className="text-xs mt-1">{foto.analiseIa.descricaoIa}</p>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Tab Observação */}
                  {activeTab === 'observacao' && (() => {
                    const opcaoConfigModal = getOpcaoConfig(itemModal.item, itemModal.item.resposta || '');
                    const observacaoObrigatoria = opcaoConfigModal?.observacaoObrigatoria || false;
                    const imagensNaoRelevantes = itemModal?.fotos.some((f) => f.analiseIa && !f.analiseIa.imagemRelevante) || false;

                    return (
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text font-medium">
                            Observação do Auditor {observacaoObrigatoria && <span className="text-error">*</span>}
                          </span>
                        </label>
                        <textarea
                          placeholder="Adicione observações sobre este item..."
                          className={`textarea textarea-bordered ${
                            observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '')
                              ? 'textarea-error'
                              : ''
                          }`}
                          rows={8}
                          value={itemModal.observacao}
                          onChange={(e) => setItemModal((prev) => prev ? { ...prev, observacao: e.target.value } : null)}
                          disabled={auditoria.status === 'finalizada'}
                          readOnly={auditoria.status === 'finalizada'}
                        />
                        {observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '') && (
                          <label className="label">
                            <span className="label-text-alt text-error">Observação obrigatória para esta resposta</span>
                          </label>
                        )}
                        {imagensNaoRelevantes && (
                          <div className="alert alert-warning mt-2 text-sm">
                            <AlertCircle className="w-4 h-4" />
                            <span>Há fotos marcadas como não relevantes. Adicione uma observação explicando sua relevância.</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Ações */}
              {(() => {
                const temResposta = Boolean(itemModal.item.resposta && itemModal.item.resposta !== 'nao_avaliado');
                const temFotos = itemModal.fotos.length > 0;
                const opcaoConfigModal = itemModal ? getOpcaoConfig(itemModal.item, itemModal.item.resposta || '') : null;
                const imagensNaoRelevantes = itemModal?.fotos.some((f) => f.analiseIa && !f.analiseIa.imagemRelevante) || false;
                const faltaObservacaoParaImagens = imagensNaoRelevantes && (!itemModal.observacao || itemModal.observacao.trim() === '');

                const isDisabled = temResposta
                  ? (opcaoConfigModal?.observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '')) ||
                    (opcaoConfigModal?.fotoObrigatoria && !temFotos) ||
                    faltaObservacaoParaImagens
                  : !temFotos || faltaObservacaoParaImagens;

                return (
                  <div className="modal-action">
                    {auditoria.status !== 'finalizada' ? (
                      <>
                        <button className="btn btn-ghost" onClick={() => setItemModal(null)}>
                          Cancelar
                        </button>
                        <button
                          className="btn btn-primary w-full"
                          onClick={handleSaveItemModal}
                          disabled={isDisabled}
                        >
                          {itemModal.isSaving ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4" />
                              Salvar Resposta
                            </>
                          )}
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-ghost" onClick={() => setItemModal(null)}>
                        Fechar
                      </button>
                    )}
                  </div>
                );
              })()}
            </motion.div>
            <div 
              className="modal-backdrop" 
              onClick={(e) => {
                // Não fecha ao clicar fora
                e.stopPropagation();
              }}
            ></div>
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
              <div className="bg-warning/30 text-warning text-center text-sm py-2 px-4 rounded-lg border border-warning/40 font-medium">
                <AlertCircle className="w-4 h-4 inline-block mr-1" />
                {obrigatoriasStatus.total - obrigatoriasStatus.respondidas} pergunta(s) obrigatória(s) pendente(s)
              </div>
            )}
            <button
              onClick={() => {
                // Se há itens obrigatórios não respondidos, marcar e não abrir o modal
                if (!obrigatoriasStatus.completo && auditoria) {
                  const itensNaoAvaliados = auditoria.itens
                    .filter((item) => 
                      item.templateItem?.obrigatorio && 
                      (!item.resposta || item.resposta === 'nao_avaliado')
                    )
                    .map((item) => item.id);
                  setItensObrigatoriosNaoAvaliados(new Set(itensNaoAvaliados));
                  
                  // Scroll até o primeiro item não avaliado
                  if (itensNaoAvaliados.length > 0) {
                    setTimeout(() => {
                      const primeiroItemId = itensNaoAvaliados[0];
                      const itemRef = itemRefs.current.get(primeiroItemId);
                      if (itemRef) {
                        itemRef.scrollIntoView({ 
                          behavior: 'smooth', 
                          block: 'center' 
                        });
                      }
                    }, 100);
                  }
                  
                  toastService.error('Existem itens obrigatórios não avaliados. Eles foram marcados em vermelho.');
                  return; // Não abre o modal
                }
                
                // Se todos os itens obrigatórios foram respondidos, abre o modal
                setItensObrigatoriosNaoAvaliados(new Set());
                setShowFinalModal(true);
              }}
              className={`btn w-full shadow-lg gap-2 ${
                obrigatoriasStatus.completo 
                  ? 'btn-primary' 
                  : 'btn-warning'
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
        <div 
          className="modal modal-open"
          onClick={(e) => {
            // Não fecha ao clicar fora - removido para evitar perda de dados
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
          <div 
            className="modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg">Encerrar Auditoria</h3>
            <p className="py-4 text-base-content/60">
              Adicione observações gerais sobre a auditoria (opcional).
            </p>
            {erroFinalizar && !erroFinalizar.toLowerCase().includes('itens não avaliados') && !erroFinalizar.toLowerCase().includes('obrigat') && (
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
              <button 
                className="btn btn-ghost" 
                onClick={() => { 
                  setShowFinalModal(false); 
                  setErroFinalizar('');
                  setItensObrigatoriosNaoAvaliados(new Set());
                }}
              >
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
          <div 
            className="modal-backdrop" 
            onClick={(e) => {
              // Não fecha ao clicar fora
              e.stopPropagation();
            }}
          ></div>
        </div>
      )}
    </AppLayout>
  );
}

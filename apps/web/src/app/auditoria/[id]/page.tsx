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
import { renderEmoji } from '@/lib/emoji';

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

// Helper function to check if any option requires a photo
const algmaOpcaoExigeFoto = (item: AuditoriaItem): boolean => {
  const configs = item.templateItem.opcoesRespostaConfig;
  if (!configs || configs.length === 0) return false;
  return configs.some(c => c.fotoObrigatoria);
};

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
      // Resetar flag de scroll ao carregar nova auditoria
      scrollRealizado.current = false;
      const data = await auditoriaService.buscarPorId(id);
      setAuditoria(data);
      const customizadas: Record<string, string> = {};
      data.itens.forEach((item) => {
        if (item.templateItem?.tipoRespostaCustomizada && item.resposta) {
          customizadas[item.id] = item.resposta;
        }
      });
      setRespostasCustomizadas(customizadas);
    } catch {
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    carregarAuditoria();
  }, [carregarAuditoria]);

  // Quando abrir modal, definir tab inicial
  useEffect(() => {
    if (itemModal) {
      // Only reset tab if this is a new item (modal just opened or switched items)
      if (prevItemIdRef.current !== itemModal.item.id) {
        if (algmaOpcaoExigeFoto(itemModal.item)) {
          setActiveTab('fotos');
        } else {
          setActiveTab('observacao');
        }
        prevItemIdRef.current = itemModal.item.id;
      }
    } else {
      // Reset when modal closes
      prevItemIdRef.current = null;
    }
  }, [itemModal]);

  // Keyboard shortcuts for tab navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!itemModal) return;

      // Alt+1 = Fotos, Alt+2 = Observação
      if (e.altKey && e.key === '1' && algmaOpcaoExigeFoto(itemModal.item)) {
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
      await auditoriaService.responderItem(auditoria.id, itemId, resposta);
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
      await auditoriaService.responderItem(auditoria.id, itemId, valor);
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
    // Se a auditoria está finalizada, permitir apenas visualização
    const isFinalizada = auditoria?.status === 'finalizada';
    
    // Se não está finalizada, verificar se o item tem resposta antes de abrir o modal
    if (!isFinalizada && (!item.resposta || item.resposta === 'nao_avaliado')) {
      toastService.warning('Por favor, marque uma resposta antes de adicionar fotos');
      return;
    }
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
    const file = e.target.files?.[0];
    if (!file || !itemModal || !auditoria) return;
    // Verificar se a auditoria está finalizada
    if (auditoria.status === 'finalizada') {
      toastService.warning('Não é possível adicionar fotos em uma auditoria finalizada. Reabra a auditoria para fazer alterações.');
      if (e.target) e.target.value = '';
      return;
    }
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
    let fotoSalva: { id: string; url: string } | null = null;
    
    try {
      // Salva a foto automaticamente no backend (sempre salva, mesmo sem créditos)
      setSalvando(true);
      fotoSalva = await auditoriaService.adicionarFoto(
        auditoria.id,
        itemModal.item.id,
        file
      );
      setUltimaHoraSalva(new Date());
      setSalvando(false);
      
      // Atualiza o estado com a foto salva (sem análise ainda)
      setItemModal((prev) => {
        if (!prev) return null;
        const fotosAtualizadas = [...prev.fotos];
        fotosAtualizadas[fotoIndex] = { 
          ...fotosAtualizadas[fotoIndex], 
          id: fotoSalva!.id,
          preview: fotoSalva!.url || preview,
          isAnalyzing: true, // Continua analisando
          isExisting: true, // Marca como existente pois já foi salva
        };
        return { ...prev, fotos: fotosAtualizadas };
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
                  fotos: [...(item.fotos || []), { 
                    id: fotoSalva!.id, 
                    url: fotoSalva!.url,
                  }],
                }
              : item
          ),
        };
      });

      // Tenta analisar a imagem com IA (pode falhar se não houver créditos)
      try {
        const analise = await iaService.analisarImagemChecklist(
          file,
          itemModal.item.templateItem.pergunta,
          itemModal.item.templateItem.categoria || 'geral',
          auditoria?.template?.tipoAtividade || 'serviço de alimentação'
        );
        
        // Salva a análise individual da foto
        setSalvando(true);
        await auditoriaService.atualizarAnaliseFoto(
          auditoria.id,
          itemModal.item.id,
          fotoSalva.id,
          JSON.stringify(analise)
        );
        setUltimaHoraSalva(new Date());
        setSalvando(false);
        
        // Atualiza o estado com a análise
        setItemModal((prev) => {
          if (!prev) return null;
          const fotosAtualizadas = [...prev.fotos];
          fotosAtualizadas[fotoIndex] = { 
            ...fotosAtualizadas[fotoIndex], 
            analiseIa: analise, 
            isAnalyzing: false,
          };
          return { ...prev, fotos: fotosAtualizadas };
        });
        
        // Atualiza o estado global com a análise
        setAuditoria((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            itens: prev.itens.map((item) =>
              item.id === itemModal.item.id
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
        // Se der erro na análise (ex: créditos insuficientes), apenas avisa mas mantém a foto
        const errorMessage = analiseError?.response?.data?.message || analiseError?.message || 'Erro desconhecido';
        if (errorMessage.includes('crédito') || errorMessage.includes('limite')) {
          toastService.warning('Foto salva, mas não foi possível analisar: créditos insuficientes.');
        } else {
          toastService.warning(`Foto salva, mas não foi possível analisar: ${errorMessage}`);
        }
        
        // Atualiza o estado removendo o indicador de análise
        setItemModal((prev) => {
          if (!prev) return null;
          const fotosAtualizadas = [...prev.fotos];
          fotosAtualizadas[fotoIndex] = { 
            ...fotosAtualizadas[fotoIndex], 
            isAnalyzing: false,
          };
          return { ...prev, fotos: fotosAtualizadas };
        });
      }
    } catch (error: any) {
      // Se der erro ao salvar a foto, remove do estado
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro ao salvar foto';
      toastService.error(`Erro ao salvar foto: ${errorMessage}`);
      
      setItemModal((prev) => {
        if (!prev) return null;
        const fotosAtualizadas = [...prev.fotos];
        // Remove a foto que falhou ao salvar
        fotosAtualizadas.splice(fotoIndex, 1);
        return { ...prev, fotos: fotosAtualizadas };
      });
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

    // Se a foto já foi salva no backend (tem id), deleta
    if (fotoParaRemover.id && fotoParaRemover.isExisting) {
      try {
        setSalvando(true);
        await auditoriaService.removerFoto(auditoria.id, itemModal.item.id, fotoParaRemover.id);
        setUltimaHoraSalva(new Date());
        setSalvando(false);

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

    if (!itemModal.item.resposta) {
      toastService.error('Selecione uma resposta');
      return;
    }

    // Buscar configuração da opção selecionada
    const opcaoConfig = getOpcaoConfig(itemModal.item, itemModal.item.resposta);

    // Validar foto obrigatória
    if (opcaoConfig.fotoObrigatoria && itemModal.fotos.length === 0) {
      setActiveTab('fotos'); // Mudar para tab de fotos
      toastService.error('Esta resposta requer pelo menos uma foto');
      return;
    }

    // Validar observação obrigatória
    if (opcaoConfig.observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '')) {
      setActiveTab('observacao'); // Mudar para tab de observação
      toastService.error('Esta resposta requer uma observação');
      return;
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
      await auditoriaService.responderItem(
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
      await auditoriaService.finalizar(auditoria.id, observacoesGerais);
      toastService.success('Auditoria finalizada com sucesso!');
      setShowFinalModal(false);
      setItensObrigatoriosNaoAvaliados(new Set());
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
                        value={respostasCustomizadas[item.id] ?? item.resposta ?? ''}
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
                        value={respostasCustomizadas[item.id] ?? item.resposta ?? ''}
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
                        value={respostasCustomizadas[item.id] ?? item.resposta ?? ''}
                        onChange={(e) => handleRespostaCustomizada(item.id, e.target.value)}
                        disabled={auditoria.status === 'finalizada'}
                      />
                    )}
                    {item.templateItem.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT && (
                      <select
                        className="select select-bordered w-full"
                        value={respostasCustomizadas[item.id] ?? item.resposta ?? ''}
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
                    disabled={!auditoria.status || (auditoria.status !== 'finalizada' && (!item.resposta || item.resposta === 'nao_avaliado'))}
                    title={
                      auditoria.status === 'finalizada'
                        ? 'Visualizar documentação do item'
                        : (!item.resposta || item.resposta === 'nao_avaliado')
                        ? 'Marque uma resposta antes de documentar'
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
                  {algmaOpcaoExigeFoto(itemModal.item) && (() => {
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
                  {/* Tab Fotos */}
                  {activeTab === 'fotos' && algmaOpcaoExigeFoto(itemModal.item) && (() => {
                    const opcaoConfigModal = getOpcaoConfig(itemModal.item, itemModal.item.resposta || '');
                    const fotoObrigatoria = opcaoConfigModal?.fotoObrigatoria || false;

                    return (
                      <div>
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
                const opcaoConfigModal = itemModal ? getOpcaoConfig(itemModal.item, itemModal.item.resposta || '') : null;
                const imagensNaoRelevantes = itemModal?.fotos.some((f) => f.analiseIa && !f.analiseIa.imagemRelevante) || false;

                const isDisabled = !itemModal.item.resposta ||
                  (opcaoConfigModal?.observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '')) ||
                  (opcaoConfigModal?.fotoObrigatoria && itemModal.fotos.length === 0) ||
                  (imagensNaoRelevantes && (!itemModal.observacao || itemModal.observacao.trim() === ''));

                console.log('🔘 Botão Salvar DEBUG:', {
                  resposta: itemModal.item.resposta,
                  opcaoConfigModal,
                  hasObservacao: !!itemModal.observacao,
                  observacaoTrim: itemModal.observacao?.trim(),
                  numFotos: itemModal.fotos.length,
                  imagensNaoRelevantes,
                  isDisabled,
                  validacoes: {
                    semResposta: !itemModal.item.resposta,
                    observacaoObrigatoriaFaltando: opcaoConfigModal?.observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === ''),
                    fotoObrigatoriaFaltando: opcaoConfigModal?.fotoObrigatoria && itemModal.fotos.length === 0,
                    imagensNaoRelevantesSemObservacao: imagensNaoRelevantes && (!itemModal.observacao || itemModal.observacao.trim() === ''),
                  }
                });

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

  'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CheckCircle,
  Camera,
  Sparkles,
  Loader2,
  Save,
  X,
  MessageSquare,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { AppLayout, PageHeader, FormModal } from '@/components';
import {
  auditoriaService,
  iaService,
  type Auditoria,
  type AuditoriaItem,
  type AnaliseChecklistResponse,
} from '@/lib/api';
import { toastService } from '@/lib/toast';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/shadcn/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/shadcn/drawer';
import { ListaSecoes } from '@/components/auditoria/execucao/lista-secoes';
import { PainelItem } from '@/components/auditoria/execucao/painel-item';
import { RespostasItem } from '@/components/auditoria/execucao/respostas-item';
import { RevisaoFinal } from '@/components/auditoria/execucao/revisao-final';
import {
  agruparPorSecao,
  naoConformidades,
  pendenciasObrigatorias,
  progresso as calcularProgresso,
  vizinhos,
  customizadoPendente,
  podeFinalizar,
} from '@/lib/auditoria/execucao';

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
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [painelMobileAberto, setPainelMobileAberto] = useState(false);
  // No celular a folha do item fecha para o modal de documentação poder receber toques; reabre ao fechar o modal
  const [voltarAoPainel, setVoltarAoPainel] = useState(false);

  useEffect(() => {
    if (!itemModal && voltarAoPainel) {
      setVoltarAoPainel(false);
      setPainelMobileAberto(true);
    }
  }, [itemModal, voltarAoPainel]);

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

  useEffect(() => {
    if (!auditoria || selecionadoId) return;
    const sequencia = agruparPorSecao(auditoria.itens).flatMap((s) => s.itens);
    const primeiroPendente = sequencia.find((i) => !i.resposta || i.resposta === 'nao_avaliado');
    setSelecionadoId((primeiroPendente ?? sequencia[0])?.id ?? null);
  }, [auditoria, selecionadoId]);

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
        fotoSalva = await auditoriaService.adicionarFoto(auditoria.id, itemId, file);
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
                    statusUpload: 'processando',
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
      setAuditoria((prev) => auditoriaAtualizada(prev));
    };

    if (fotoParaRemover.id && fotoParaRemover.isExisting) {
      const fotoLocal = fotoParaRemover.id.startsWith('local-');
      if (fotoLocal) {
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


    if (!configs || configs.length === 0) {
      console.log('⚠️ Usando comportamento legado (sem configs)');
      // Comportamento legado: observação sempre obrigatória, foto opcional
      return {
        fotoObrigatoria: false,
        observacaoObrigatoria: true,
      };
    }

    const config = configs.find(c => c.valor === resposta);

    const resultado = config || {
      fotoObrigatoria: false,
      observacaoObrigatoria: false,
    };

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

  const somenteLeitura = auditoria.status === 'finalizada';
  const secoes = agruparPorSecao(auditoria.itens);
  const sequencia = secoes.flatMap((s) => s.itens);
  const resumo = calcularProgresso(auditoria.itens);
  const pendentes = pendenciasObrigatorias(auditoria.itens);
  const selecionado = sequencia.find((i) => i.id === selecionadoId) ?? null;
  const nav = selecionado ? vizinhos(sequencia, selecionado.id) : null;

  // Garante que texto/número digitado não se perca ao trocar de item ou fechar o painel antes do blur
  const salvarCustomizadoPendente = () => {
    if (selecionado && customizadoPendente(selecionado, respostasCustomizadas[selecionado.id])) {
      handleRespostaCustomizada(selecionado.id, respostasCustomizadas[selecionado.id]);
    }
  };

  const navegar = (itemId: string) => {
    salvarCustomizadoPendente();
    setSelecionadoId(itemId);
  };

  const selecionar = (itemId: string) => {
    navegar(itemId);
    if (!desktop) setPainelMobileAberto(true);
  };

  const documentar = (item: NonNullable<typeof selecionado>) => {
    salvarCustomizadoPendente();
    if (desktop) {
      openPhotoModal(item);
      return;
    }
    setPainelMobileAberto(false);
    setVoltarAoPainel(true);
    // aguarda a folha terminar de fechar e liberar o foco/toques da página antes de abrir o modal
    window.setTimeout(() => openPhotoModal(item), 350);
  };

  const painel = selecionado && nav && (
    <PainelItem
      item={selecionado}
      numero={nav.posicao}
      total={sequencia.length}
      anterior={nav.anterior}
      proximo={nav.proximo}
      somenteLeitura={somenteLeitura}
      onNavegar={navegar}
      onDocumentar={() => documentar(selecionado)}
      respostas={
        <RespostasItem
          key={selecionado.id}
          item={selecionado}
          valorCustomizado={respostasCustomizadas[selecionado.id] ?? selecionado.resposta ?? ''}
          somenteLeitura={somenteLeitura}
          onResponder={(valor) => handleResposta(selecionado.id, valor)}
          onAlterarCustomizado={(valor) => setRespostasCustomizadas((prev) => ({ ...prev, [selecionado.id]: valor }))}
          onConfirmarCustomizado={(valor) => {
            if (valor !== (selecionado.resposta || '')) handleRespostaCustomizada(selecionado.id, valor);
          }}
        />
      }
    />
  );

  return (
    <AppLayout>
      <PageHeader
        title={auditoria.unidade?.nome || 'Auditoria'}
        subtitle={auditoria.template?.nome}
        backHref="/admin/auditorias"
        action={
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="hidden sm:inline">Salvando...</span>
              </>
            ) : ultimaHoraSalva ? (
              <>
                <Clock className="w-4 h-4 text-[hsl(160_84%_28%)]" />
                <span className="hidden sm:inline">Salvo às</span>
                <span className="font-medium">{formatarHora(ultimaHoraSalva)}</span>
              </>
            ) : null}
          </div>
        }
      />

      <div className="sticky top-[calc(3.5rem+81px)] z-10 border-b border-border bg-card px-4 py-2 md:top-[calc(3.5rem+85px)] lg:px-8">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {resumo.respondidos}/{resumo.total} respondidas
          </span>
          <span className="font-semibold text-foreground">{resumo.percentual}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${resumo.percentual}%` }} />
        </div>
      </div>

      <div className={`px-4 py-4 lg:px-8 ${podeFinalizar(auditoria.status) ? 'pb-40 md:pb-28' : 'pb-8'}`}>
        <div className="lg:grid lg:grid-cols-[minmax(320px,420px)_1fr] lg:gap-6">
          <ListaSecoes secoes={secoes} selecionadoId={selecionadoId} destacados={itensObrigatoriosNaoAvaliados} onSelecionar={selecionar} />
          {desktop && (
            <div className="sticky top-[calc(3.5rem+130px)] hidden h-[calc(100vh-14rem)] flex-col overflow-hidden rounded-lg border border-border bg-card p-6 shadow-sm lg:flex">
              {painel}
            </div>
          )}
        </div>
      </div>

      {!desktop && (
        <Drawer
          open={painelMobileAberto && Boolean(selecionado)}
          onOpenChange={(aberto) => {
            if (!aberto) salvarCustomizadoPendente();
            setPainelMobileAberto(aberto);
          }}
        >
          <DrawerContent className="max-h-[92vh] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerTitle className="sr-only">Pergunta da auditoria</DrawerTitle>
            <div className="h-[75vh] pt-2">{painel}</div>
          </DrawerContent>
        </Drawer>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleImageSelect}
      />

      <FormModal
        open={Boolean(itemModal)}
        onClose={() => setItemModal(null)}
        title={auditoria.status === 'finalizada' ? 'Visualizar Item' : 'Documentar Item'}
        maxWidth="5xl"
        isDirty={Boolean(itemModal && (itemModal.fotos.length > 0 || itemModal.observacao))}
        closeOnBackdrop={false}
        footer={itemModal ? (() => {
          const temResposta = Boolean(itemModal.item.resposta && itemModal.item.resposta !== 'nao_avaliado');
          const temFotos = itemModal.fotos.length > 0;
          const opcaoConfigModal = getOpcaoConfig(itemModal.item, itemModal.item.resposta || '');
          const imagensNaoRelevantes = itemModal.fotos.some((f) => f.analiseIa && !f.analiseIa.imagemRelevante) || false;
          const faltaObservacaoParaImagens = imagensNaoRelevantes && (!itemModal.observacao || itemModal.observacao.trim() === '');
          const isDisabled = temResposta
            ? (opcaoConfigModal?.observacaoObrigatoria && (!itemModal.observacao || itemModal.observacao.trim() === '')) ||
              (opcaoConfigModal?.fotoObrigatoria && !temFotos) ||
              faltaObservacaoParaImagens
            : !temFotos || faltaObservacaoParaImagens;
          return auditoria.status !== 'finalizada' ? (
            <>
              <button className="btn btn-ghost" onClick={() => setItemModal(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
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
          );
        })() : undefined}
      >
        {itemModal && (
          <>
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

          </>
        )}
      </FormModal>

      {podeFinalizar(auditoria.status) && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-6 md:left-auto md:right-8 md:px-0">
          <Button
            className="h-12 w-full shadow-lg md:w-auto md:px-6"
            variant={pendentes.length ? 'outline' : 'default'}
            onClick={() => {
              salvarCustomizadoPendente();
              setItensObrigatoriosNaoAvaliados(new Set(pendentes.map((p) => p.id)));
              setShowFinalModal(true);
            }}
          >
            <CheckCircle className="h-5 w-5" />
            Revisar e finalizar
            {pendentes.length > 0 && <span className="ml-1 rounded-full bg-destructive px-2 text-xs text-white">{pendentes.length}</span>}
          </Button>
        </div>
      )}

      <RevisaoFinal
        open={showFinalModal}
        onOpenChange={(aberto) => {
          setShowFinalModal(aberto);
          if (!aberto) setErroFinalizar('');
        }}
        pendentes={pendentes}
        naoConformes={naoConformidades(auditoria.itens)}
        observacoes={observacoesGerais}
        onObservacoes={setObservacoesGerais}
        erro={erroFinalizar}
        finalizando={finalizando}
        onIrParaItem={(itemId) => {
          setShowFinalModal(false);
          selecionar(itemId);
        }}
        onFinalizar={handleFinalizar}
      />
    </AppLayout>
  );
}

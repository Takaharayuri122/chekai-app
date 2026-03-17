'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  ChevronLeft,
  AlertTriangle,
  GripVertical,
  Edit,
  X,
  Settings,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  Copy,
  Camera,
  MessageSquare,
  Star,
  HelpCircle,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AppLayout, Tooltip, ConfirmDialog, FormModal } from '@/components';
import {
  checklistService,
  ChecklistTemplate,
  TemplateItem,
  ChecklistGrupo,
  TipoAtividade,
  CategoriaItem,
  CriticidadeItem,
  StatusTemplate,
  STATUS_TEMPLATE_LABELS,
  TIPO_ATIVIDADE_LABELS,
  CATEGORIA_ITEM_LABELS,
  CRITICIDADE_LABELS,
  CriarTemplateItemRequest,
  CriarGrupoRequest,
  RESPOSTAS_PADRAO,
  TipoRespostaCustomizada,
  TIPO_RESPOSTA_LABELS,
} from '@/lib/api';
import { toastService } from '@/lib/toast';
import { useAuthStore } from '@/lib/store';
import { calcularPontuacoesEmSequencia, isOpcaoSemPontuacao } from '@/lib/utils';

interface ItemFormData extends CriarTemplateItemRequest {
  id?: string;
}

const RESPOSTAS_PERSONALIZADAS_SUGESTOES = [
  'Conforme',
  'Não Conforme',
  'Parcialmente Conforme',
  'Não Aplicável',
  'Em Adequação',
  'Necessita Melhoria',
];

/**
 * Função auxiliar para obter a classe do badge de criticidade
 */
const getCriticidadeBadge = (criticidade: CriticidadeItem) => {
  const colors: Record<CriticidadeItem, string> = {
    [CriticidadeItem.BAIXA]: 'badge-info',
    [CriticidadeItem.MEDIA]: 'badge-warning',
    [CriticidadeItem.ALTA]: 'badge-error',
    [CriticidadeItem.CRITICA]: 'badge-error badge-outline',
  };
  return colors[criticidade] || 'badge-ghost';
};

/**
 * Componente de item sortable para drag and drop
 */
interface SortableItemProps {
  item: TemplateItem;
  index: number;
  onEdit: (item: TemplateItem) => void;
  onRemove: (itemId: string) => void;
  onDuplicate: (itemId: string) => void;
  isDuplicating?: boolean;
  isHighlighted?: boolean;
}

function SortableItem({ item, index, onEdit, onRemove, onDuplicate, isDuplicating, isHighlighted }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-base-100 rounded-lg border group hover:border-primary/30 transition-all cursor-pointer ${
        isHighlighted ? 'border-info shadow-lg shadow-info/20 ring-2 ring-info/30' : 'border-base-200'
      }`}
      onClick={() => onEdit(item)}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-base-content/40 hover:text-base-content/60 transition-colors flex-shrink-0 flex items-center justify-center w-6 h-6"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <span className="text-xs sm:text-sm font-bold text-base-content/40 min-w-[20px] sm:min-w-[24px] flex-shrink-0">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm leading-relaxed break-words">{item.pergunta}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 sm:mt-1">
          <Tooltip content="Categoria da pergunta: indica a área ou aspecto que a pergunta avalia">
            <span className="badge badge-ghost badge-sm px-2 py-1">
              {CATEGORIA_ITEM_LABELS[item.categoria]}
            </span>
          </Tooltip>
          <Tooltip content={`Criticidade: ${CRITICIDADE_LABELS[item.criticidade]} - indica o nível de importância e impacto desta pergunta na avaliação`}>
            <span className={`badge badge-sm px-2 py-1 ${getCriticidadeBadge(item.criticidade)}`}>
              {CRITICIDADE_LABELS[item.criticidade]}
            </span>
          </Tooltip>
          {item.legislacaoReferencia && (
            <Tooltip content={`Referência legal: ${item.legislacaoReferencia}${item.artigo ? ` - ${item.artigo}` : ''}`}>
              <span className="text-xs text-base-content/50 truncate max-w-[120px] sm:max-w-none">
                {item.legislacaoReferencia}
              </span>
            </Tooltip>
          )}
          {item.usarRespostasPersonalizadas && (
            <Tooltip content="Respostas Personalizadas: este item usa opções de resposta customizadas ao invés das padrão">
              <span className="badge badge-secondary badge-sm gap-1 px-2 py-1">
                <Settings className="w-2.5 h-2.5 sm:w-3 sm:h-3" />Pers.
              </span>
            </Tooltip>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 flex-shrink-0">
        <Tooltip content="Duplicar pergunta">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isDuplicating) onDuplicate(item.id);
            }}
            className="btn btn-ghost btn-square btn-xs text-info"
            disabled={isDuplicating}
          >
            {isDuplicating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
          </button>
        </Tooltip>
        <Tooltip content="Editar pergunta">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(item);
            }}
            className="btn btn-ghost btn-square btn-xs"
          >
            <Edit className="w-4 h-4" />
          </button>
        </Tooltip>
        <Tooltip content="Remover pergunta">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
            className="btn btn-ghost btn-square btn-xs text-error"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

/**
 * Página para editar um template existente com suporte a grupos e seções.
 */
export default function EditarTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const { isGestor, isMaster } = useAuthStore();
  const templateId = params.id as string;
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [expandedGrupos, setExpandedGrupos] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipoAtividade: TipoAtividade.OUTRO,
    versao: '1.0',
  });

  // Modal de Grupo
  const [showGrupoModal, setShowGrupoModal] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<ChecklistGrupo | null>(null);
  const [grupoForm, setGrupoForm] = useState<CriarGrupoRequest>({
    nome: '',
    descricao: '',
  });

  // Modal de Item
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TemplateItem | null>(null);
  const [selectedGrupoId, setSelectedGrupoId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemFormData>({
    pergunta: '',
    categoria: CategoriaItem.OUTRO,
    criticidade: CriticidadeItem.MEDIA,
    peso: 1,
    legislacaoReferencia: '',
    artigo: '',
    obrigatorio: true,
    opcoesResposta: [],
    usarRespostasPersonalizadas: false,
    tipoRespostaCustomizada: undefined,
    grupoId: undefined,
    secao: '',
  });
  const [novaOpcaoResposta, setNovaOpcaoResposta] = useState('');

  // Dialogs de confirmação de exclusão
  const [confirmRemoverGrupo, setConfirmRemoverGrupo] = useState<string | null>(null);
  const [confirmRemoverItem, setConfirmRemoverItem] = useState<string | null>(null);

  // Loading e highlight para duplicações
  const [duplicatingGrupoId, setDuplicatingGrupoId] = useState<string | null>(null);
  const [duplicatingItemId, setDuplicatingItemId] = useState<string | null>(null);
  const [highlightedGrupoId, setHighlightedGrupoId] = useState<string | null>(null);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
  const grupoRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Sensores para drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Função para lidar com o fim do drag
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !template) {
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Encontrar os itens que foram movidos
    const activeItem = template.itens?.find((item) => item.id === activeId);
    const overItem = template.itens?.find((item) => item.id === overId);

    if (!activeItem || !overItem) {
      return;
    }

    // Verificar se os itens estão no mesmo grupo (ou ambos sem grupo)
    if (activeItem.grupoId !== overItem.grupoId) {
      toastService.warning('Não é possível mover itens entre grupos diferentes');
      return;
    }

    // Filtrar itens do mesmo grupo (ou sem grupo se ambos não tiverem grupo)
    const itensDoGrupo = template.itens
      ?.filter((item) => {
        if (activeItem.grupoId) {
          return item.grupoId === activeItem.grupoId && item.ativo !== false;
        }
        return !item.grupoId && item.ativo !== false;
      })
      .sort((a, b) => a.ordem - b.ordem) || [];

    // Encontrar índices
    const oldIndex = itensDoGrupo.findIndex((item) => item.id === activeId);
    const newIndex = itensDoGrupo.findIndex((item) => item.id === overId);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    // Reordenar localmente
    const novosItens = arrayMove(itensDoGrupo, oldIndex, newIndex);

    // Atualizar estado local imediatamente
    setTemplate((prevTemplate) => {
      if (!prevTemplate) return prevTemplate;
      return {
        ...prevTemplate,
        itens: (prevTemplate.itens || []).map((item) => {
          const novoItem = novosItens.find((ni) => ni.id === item.id);
          if (novoItem) {
            const novoIndex = novosItens.indexOf(novoItem);
            return { ...item, ordem: novoIndex };
          }
          return item;
        }),
      };
    });

    // Atualizar ordem no backend
    try {
      const atualizacoes = novosItens.map((item, index) =>
        checklistService.atualizarItem(item.id, { ordem: index })
      );
      await Promise.all(atualizacoes);
      toastService.success('Ordem dos itens atualizada!');
    } catch (error) {
      // Erro já é tratado pelo interceptor
      // Reverter mudança local em caso de erro
      loadTemplate();
    }
  };

  const loadTemplate = useCallback(async () => {
    try {
      setLoading(true);
      const data = await checklistService.buscarTemplatePorId(templateId);
      setTemplate(data);
      setFormData({
        nome: data.nome,
        descricao: data.descricao || '',
        tipoAtividade: data.tipoAtividade,
        versao: data.versao || '1.0',
      });
      // Expandir todos os grupos por padrão
      if (data.grupos) {
        setExpandedGrupos(new Set(data.grupos.map((g) => g.id)));
      }
    } catch {
      setErro('Erro ao carregar template');
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    if (!isGestor() && !isMaster()) {
      router.push('/admin/templates');
      return;
    }
    loadTemplate();
  }, [loadTemplate, isGestor, isMaster, router]);

  const handleSalvar = async () => {
    if (!formData.nome.trim()) {
      toastService.warning('O nome do template é obrigatório');
      return;
    }
    setSaving(true);
    try {
      await checklistService.atualizarTemplate(templateId, formData);
      toastService.success('Checklist atualizado com sucesso!');
      router.push('/admin/templates');
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setSaving(false);
    }
  };

  // ========== GRUPOS ==========
  const resetGrupoForm = () => {
    setGrupoForm({ nome: '', descricao: '' });
    setEditingGrupo(null);
  };

  const handleAbrirModalNovoGrupo = () => {
    resetGrupoForm();
    setShowGrupoModal(true);
  };

  const handleAbrirModalEditarGrupo = (grupo: ChecklistGrupo) => {
    setEditingGrupo(grupo);
    setGrupoForm({ nome: grupo.nome, descricao: grupo.descricao || '' });
    setShowGrupoModal(true);
  };

  const handleSalvarGrupo = async () => {
    if (!grupoForm.nome.trim()) return;
    setSaving(true);
    try {
      if (editingGrupo) {
        const grupoAtualizado = await checklistService.atualizarGrupo(editingGrupo.id, grupoForm);
        setTemplate((prevTemplate) => {
          if (!prevTemplate) return prevTemplate;
          return {
            ...prevTemplate,
            grupos: (prevTemplate.grupos || []).map((grupo) =>
              grupo.id === editingGrupo.id ? grupoAtualizado : grupo
            ),
          };
        });
      } else {
        const novoGrupo = await checklistService.adicionarGrupo(templateId, grupoForm);
        setTemplate((prevTemplate) => {
          if (!prevTemplate) return prevTemplate;
          return {
            ...prevTemplate,
            grupos: [...(prevTemplate.grupos || []), novoGrupo],
          };
        });
      }
      toastService.success(editingGrupo ? 'Grupo atualizado com sucesso!' : 'Grupo criado com sucesso!');
      setShowGrupoModal(false);
      resetGrupoForm();
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setSaving(false);
    }
  };

  const scrollToAndHighlight = useCallback((type: 'grupo' | 'item', id: string) => {
    const refs = type === 'grupo' ? grupoRefs : itemRefs;
    const setHighlight = type === 'grupo' ? setHighlightedGrupoId : setHighlightedItemId;
    requestAnimationFrame(() => {
      const el = refs.current[id];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlight(id);
        setTimeout(() => setHighlight(null), 3000);
      }
    });
  }, []);

  const handleDuplicarGrupo = async (grupoId: string) => {
    try {
      setDuplicatingGrupoId(grupoId);
      const novoGrupo = await checklistService.duplicarGrupo(grupoId);
      toastService.success('Grupo duplicado com sucesso!');
      await loadTemplate();
      setExpandedGrupos((prev) => new Set([...prev, novoGrupo.id]));
      setTimeout(() => scrollToAndHighlight('grupo', novoGrupo.id), 300);
    } catch {
      // Erro já é tratado pelo interceptor
    } finally {
      setDuplicatingGrupoId(null);
    }
  };

  const handleRemoverGrupo = async (grupoId: string) => {
    try {
      await checklistService.removerGrupo(grupoId);
      toastService.success('Grupo removido com sucesso!');
      setTemplate((prevTemplate) => {
        if (!prevTemplate) return prevTemplate;
        return {
          ...prevTemplate,
          grupos: (prevTemplate.grupos || []).filter((grupo) => grupo.id !== grupoId),
          itens: (prevTemplate.itens || []).map((item) =>
            item.grupoId === grupoId ? { ...item, grupoId: undefined } : item
          ),
        };
      });
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setConfirmRemoverGrupo(null);
    }
  };

  const toggleGrupoExpanded = (grupoId: string) => {
    setExpandedGrupos((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(grupoId)) {
        newSet.delete(grupoId);
      } else {
        newSet.add(grupoId);
      }
      return newSet;
    });
  };

  // ========== ITENS ==========
  const resetItemForm = () => {
    setItemForm({
      pergunta: '',
      categoria: CategoriaItem.OUTRO,
      criticidade: CriticidadeItem.MEDIA,
      peso: 1,
      legislacaoReferencia: '',
      artigo: '',
      obrigatorio: true,
      opcoesResposta: [],
      usarRespostasPersonalizadas: false,
      opcoesRespostaConfig: RESPOSTAS_PADRAO.map(resp => ({
        valor: resp.valor,
        fotoObrigatoria: false,
        observacaoObrigatoria: false,
      })),
      grupoId: undefined,
      secao: '',
    });
    setNovaOpcaoResposta('');
    setEditingItem(null);
    setSelectedGrupoId(null);
  };

  const handleAbrirModalNovoItem = (grupoId?: string) => {
    resetItemForm();
    setSelectedGrupoId(grupoId || null);
    setItemForm((prev) => ({ ...prev, grupoId }));
    setShowItemModal(true);
  };

  const handleAbrirModalEditarItem = (item: TemplateItem) => {
    setEditingItem(item);

    // Inicializar configs se não existirem
    let configs = item.opcoesRespostaConfig;
    if (!configs || configs.length === 0) {
      if (item.usarRespostasPersonalizadas || item.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT) {
        configs = (item.opcoesResposta || []).map(opcao => ({
          valor: opcao,
          fotoObrigatoria: false,
          observacaoObrigatoria: false,
        }));
      } else {
        configs = RESPOSTAS_PADRAO.map(resp => ({
          valor: resp.valor,
          fotoObrigatoria: false,
          observacaoObrigatoria: false,
        }));
      }
    }

    setItemForm({
      id: item.id,
      pergunta: item.pergunta,
      categoria: item.categoria,
      criticidade: item.criticidade,
      peso: item.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO ? 0 : item.peso,
      legislacaoReferencia: item.legislacaoReferencia || '',
      artigo: item.artigo || '',
      obrigatorio: item.obrigatorio,
      opcoesResposta: item.opcoesResposta || [],
      usarRespostasPersonalizadas: item.usarRespostasPersonalizadas || false,
      tipoRespostaCustomizada: item.tipoRespostaCustomizada,
      opcoesRespostaConfig: configs,
      grupoId: item.grupoId,
      secao: item.secao || '',
    });
    setShowItemModal(true);
  };

  const handleSalvarItem = async () => {
    if (!itemForm.pergunta.trim()) return;
    setSaving(true);
    try {
      const dadosItem: CriarTemplateItemRequest = {
        pergunta: itemForm.pergunta,
        categoria: itemForm.categoria,
        criticidade: itemForm.criticidade,
        peso: itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO ? 0 : itemForm.peso,
        legislacaoReferencia: itemForm.legislacaoReferencia,
        artigo: itemForm.artigo,
        obrigatorio: itemForm.obrigatorio,
        opcoesResposta: itemForm.usarRespostasPersonalizadas && !itemForm.tipoRespostaCustomizada ? itemForm.opcoesResposta : (itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT ? itemForm.opcoesResposta : undefined),
        usarRespostasPersonalizadas: itemForm.usarRespostasPersonalizadas,
        tipoRespostaCustomizada: itemForm.tipoRespostaCustomizada,
        opcoesRespostaConfig: itemForm.opcoesRespostaConfig,
        grupoId: itemForm.grupoId || undefined,
        secao: itemForm.secao || undefined,
      };
      if (editingItem) {
        const itemAtualizado = await checklistService.atualizarItem(editingItem.id, dadosItem);
        setTemplate((prevTemplate) => {
          if (!prevTemplate) return prevTemplate;
          return {
            ...prevTemplate,
            itens: (prevTemplate.itens || []).map((item) =>
              item.id === editingItem.id ? itemAtualizado : item
            ),
          };
        });
      } else {
        const novoItem = await checklistService.adicionarItem(templateId, dadosItem);
        setTemplate((prevTemplate) => {
          if (!prevTemplate) return prevTemplate;
          return {
            ...prevTemplate,
            itens: [...(prevTemplate.itens || []), novoItem],
          };
        });
      }
      toastService.success(editingItem ? 'Item atualizado com sucesso!' : 'Item adicionado com sucesso!');
      setShowItemModal(false);
      resetItemForm();
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicarItem = async (itemId: string) => {
    try {
      setDuplicatingItemId(itemId);
      const novoItem = await checklistService.duplicarItem(itemId);
      setTemplate((prevTemplate) => {
        if (!prevTemplate) return prevTemplate;
        return {
          ...prevTemplate,
          itens: [...(prevTemplate.itens || []), novoItem],
        };
      });
      toastService.success('Pergunta duplicada com sucesso!');
      setTimeout(() => scrollToAndHighlight('item', novoItem.id), 300);
    } catch {
      // Erro já é tratado pelo interceptor
    } finally {
      setDuplicatingItemId(null);
    }
  };

  const handleRemoverItem = async (itemId: string) => {
    try {
      await checklistService.removerItem(itemId);
      toastService.success('Pergunta removida com sucesso!');
      setTemplate((prevTemplate) => {
        if (!prevTemplate) return prevTemplate;
        return {
          ...prevTemplate,
          itens: (prevTemplate.itens || []).filter((item) => item.id !== itemId),
        };
      });
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setConfirmRemoverItem(null);
    }
  };

  const handleAdicionarOpcaoResposta = () => {
    if (!novaOpcaoResposta.trim()) return;
    if (itemForm.opcoesResposta?.includes(novaOpcaoResposta.trim())) return;
    const novoValor = novaOpcaoResposta.trim();
    const novasOpcoes = [...(itemForm.opcoesResposta || []), novoValor];
    const configsExistentes = itemForm.opcoesRespostaConfig || [];
    const opcoesPontuaveis = novasOpcoes.filter((op) => !isOpcaoSemPontuacao(op));
    const configPrimeira = configsExistentes.find((c) => c.valor === opcoesPontuaveis[0]);
    const idxPontuavel = opcoesPontuaveis.indexOf(novoValor);
    const novaConfig = {
      valor: novoValor,
      fotoObrigatoria: false,
      observacaoObrigatoria: false,
      pontuacao: isOpcaoSemPontuacao(novoValor) ? null : (configPrimeira?.pontuacao != null ? configPrimeira.pontuacao - idxPontuavel : undefined),
    };
    setItemForm({
      ...itemForm,
      opcoesResposta: novasOpcoes,
      opcoesRespostaConfig: [...configsExistentes, novaConfig],
    });
    setNovaOpcaoResposta('');
  };

  const handleRemoverOpcaoResposta = (opcao: string) => {
    setItemForm({
      ...itemForm,
      opcoesResposta: itemForm.opcoesResposta?.filter((o) => o !== opcao),
      opcoesRespostaConfig: itemForm.opcoesRespostaConfig?.filter((c) => c.valor !== opcao),
    });
  };

  const handleAtualizarOpcaoConfig = (
    valor: string,
    campo: 'fotoObrigatoria' | 'observacaoObrigatoria' | 'pontuacao',
    value: boolean | number | null | undefined,
  ) => {
    setItemForm((prev) => {
      const configs = prev.opcoesRespostaConfig || [];
      const opcoesOrdenadas = prev.usarRespostasPersonalizadas
        ? (prev.opcoesResposta || [])
        : RESPOSTAS_PADRAO.map((r) => r.valor);
      const opcoesPontuaveis = opcoesOrdenadas.filter((op) => !isOpcaoSemPontuacao(op));
      const isPrimeiraPontuavel = opcoesPontuaveis[0] === valor;
      if (campo === 'pontuacao' && isPrimeiraPontuavel && typeof value === 'number') {
        const pontuacoes = calcularPontuacoesEmSequencia(value, opcoesOrdenadas);
        const novasConfigs = opcoesOrdenadas.map((op, i) => {
          const cfg = configs.find((c) => c.valor === op);
          return {
            ...cfg,
            valor: op,
            fotoObrigatoria: cfg?.fotoObrigatoria ?? false,
            observacaoObrigatoria: cfg?.observacaoObrigatoria ?? false,
            pontuacao: pontuacoes[i],
          };
        });
        return { ...prev, opcoesRespostaConfig: novasConfigs };
      }
      const novasConfigs = configs.map((config) =>
        config.valor === valor ? { ...config, [campo]: value } : config,
      );
      return { ...prev, opcoesRespostaConfig: novasConfigs };
    });
  };

  const handleDuplicarResposta = (opcao: string) => {
    const config = itemForm.opcoesRespostaConfig?.find((c) => c.valor === opcao);
    let novoNome = `${opcao} (cópia)`;
    let contador = 1;
    while (itemForm.opcoesResposta?.includes(novoNome)) {
      contador++;
      novoNome = `${opcao} (cópia ${contador})`;
    }
    const novasOpcoes = [...(itemForm.opcoesResposta || []), novoNome];
    const novaConfig = {
      valor: novoNome,
      fotoObrigatoria: config?.fotoObrigatoria ?? false,
      observacaoObrigatoria: config?.observacaoObrigatoria ?? false,
      pontuacao: config?.pontuacao,
    };
    setItemForm({
      ...itemForm,
      opcoesResposta: novasOpcoes,
      opcoesRespostaConfig: [...(itemForm.opcoesRespostaConfig || []), novaConfig],
    });
  };

  const handleAdicionarSugestao = (sugestao: string) => {
    if (itemForm.opcoesResposta?.includes(sugestao)) return;
    const novasOpcoes = [...(itemForm.opcoesResposta || []), sugestao];
    const configsExistentes = itemForm.opcoesRespostaConfig || [];
    const opcoesPontuaveis = novasOpcoes.filter((op) => !isOpcaoSemPontuacao(op));
    const configPrimeira = configsExistentes.find((c) => c.valor === opcoesPontuaveis[0]);
    const idxPontuavel = opcoesPontuaveis.indexOf(sugestao);
    const novaConfig = {
      valor: sugestao,
      fotoObrigatoria: false,
      observacaoObrigatoria: false,
      pontuacao: isOpcaoSemPontuacao(sugestao) ? null : (configPrimeira?.pontuacao != null ? configPrimeira.pontuacao - idxPontuavel : undefined),
    };
    setItemForm({
      ...itemForm,
      opcoesResposta: novasOpcoes,
      opcoesRespostaConfig: [...configsExistentes, novaConfig],
    });
  };

  const handleToggleTodasOpcoes = (campo: 'fotoObrigatoria' | 'observacaoObrigatoria', value: boolean) => {
    setItemForm((prev) => {
      const opcoes = prev.usarRespostasPersonalizadas
        ? (prev.opcoesResposta || [])
        : RESPOSTAS_PADRAO.map((r) => r.valor);
      const configs = prev.opcoesRespostaConfig || [];
      const novasConfigs = opcoes.map((op) => {
        const cfg = configs.find((c) => c.valor === op);
        return {
          ...cfg,
          valor: op,
          fotoObrigatoria: cfg?.fotoObrigatoria ?? false,
          observacaoObrigatoria: cfg?.observacaoObrigatoria ?? false,
          [campo]: value,
        };
      });
      return { ...prev, opcoesRespostaConfig: novasConfigs };
    });
  };

  // Organizar itens por grupo
  const getItensPorGrupo = (grupoId: string) => {
    return template?.itens?.filter((i) => i.grupoId === grupoId && i.ativo !== false) || [];
  };

  const getItensSemGrupo = () => {
    return template?.itens?.filter((i) => !i.grupoId && i.ativo !== false) || [];
  };

  // Agrupar itens por seção dentro do grupo
  const getItensPorSecao = (itens: TemplateItem[]) => {
    const porSecao: Record<string, TemplateItem[]> = {};
    itens.forEach((item) => {
      const secao = item.secao || '';
      if (!porSecao[secao]) {
        porSecao[secao] = [];
      }
      porSecao[secao].push(item);
    });
    return porSecao;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <span className="loading loading-spinner loading-lg text-primary"></span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Header */}
      <div className="bg-base-100 border-b border-base-300 px-4 lg:px-8 py-3 sm:py-4 sticky top-16 z-30">
        <div className="flex items-center gap-2 sm:gap-3 max-w-4xl mx-auto">
          <Link href="/admin/templates" className="btn btn-ghost btn-sm btn-circle flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-base-content truncate">Editar Checklist</h1>
              {template?.status && (
                <span className={`badge badge-sm ${
                  template.status === StatusTemplate.RASCUNHO ? 'badge-warning' :
                  template.status === StatusTemplate.ATIVO ? 'badge-success' : 'badge-error'
                }`}>
                  {STATUS_TEMPLATE_LABELS[template.status]}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-base-content/60 truncate">{template?.nome}</p>
          </div>
          <button onClick={handleSalvar} disabled={saving} className="btn btn-primary btn-sm gap-1 flex-shrink-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">Salvar</span>
          </button>
        </div>
      </div>

      <div className="px-4 py-4 lg:px-8 space-y-4 pb-24">
        {/* Erro */}
        {erro && (
          <div className="alert alert-error">
            <span>{erro}</span>
            <button onClick={() => setErro('')} className="btn btn-ghost btn-sm">✕</button>
          </div>
        )}

        {/* Informações Básicas */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-base-100 shadow-sm border border-base-300"
        >
          <div className="card-body">
            <h2 className="card-title text-base">Informações do Checklist</h2>
            <div className="space-y-4 mt-2">
              <div className="form-control">
                <label className="label"><span className="label-text">Nome *</span></label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Descrição</span></label>
                <textarea
                  className="textarea textarea-bordered"
                  rows={2}
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label"><span className="label-text">Tipo de Atividade</span></label>
                  <select
                    className="select select-bordered"
                    value={formData.tipoAtividade}
                    onChange={(e) => setFormData({ ...formData, tipoAtividade: e.target.value as TipoAtividade })}
                  >
                    {Object.entries(TIPO_ATIVIDADE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Versão</span></label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formData.versao}
                    onChange={(e) => setFormData({ ...formData, versao: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Grupos e Itens */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card bg-base-100 shadow-sm border border-base-300"
        >
          <div className="card-body">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2">
              <h2 className="card-title text-base">
                <span className="block sm:inline">Grupos e Perguntas</span>
                <span className="text-sm font-normal text-base-content/60 block sm:inline sm:ml-2">
                  ({template?.grupos?.length || 0} grupos, {template?.itens?.filter(i => i.ativo !== false).length || 0} perguntas)
                </span>
              </h2>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button onClick={handleAbrirModalNovoGrupo} className="btn btn-secondary btn-sm gap-1 w-full sm:w-auto">
                  <FolderOpen className="w-4 h-4" />
                  <span className="whitespace-nowrap">Novo Grupo</span>
                </button>
                <button onClick={() => handleAbrirModalNovoItem()} className="btn btn-primary btn-sm gap-1 w-full sm:w-auto">
                  <Plus className="w-4 h-4" />
                  <span className="whitespace-nowrap">Nova Pergunta</span>
                </button>
              </div>
            </div>

            <div className="space-y-4 mt-4">
              {/* Grupos */}
              {template?.grupos?.map((grupo) => (
                <div
                  key={grupo.id}
                  ref={(el) => { grupoRefs.current[grupo.id] = el; }}
                  className={`border rounded-lg transition-all duration-500 ${
                    highlightedGrupoId === grupo.id
                      ? 'border-info shadow-lg shadow-info/20 ring-2 ring-info/30'
                      : 'border-base-300'
                  }`}
                >
                  {/* Header do Grupo */}
                  <div
                    className="flex items-start sm:items-center gap-2 sm:gap-3 p-3 bg-base-200 rounded-t-lg cursor-pointer hover:bg-base-300 transition-colors"
                    onClick={() => toggleGrupoExpanded(grupo.id)}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <GripVertical className="w-4 h-4 text-base-content/40 flex-shrink-0" />
                      <FolderOpen className="w-5 h-5 text-secondary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{grupo.nome}</p>
                        {grupo.descricao && <p className="text-xs sm:text-sm text-base-content/60 line-clamp-1">{grupo.descricao}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                      <span className="badge badge-ghost text-xs hidden sm:inline-flex">{getItensPorGrupo(grupo.id).length} perguntas</span>
                      <span className="badge badge-ghost badge-sm sm:hidden">{getItensPorGrupo(grupo.id).length}</span>
                      <div className="flex items-center gap-0.5">
                        <Tooltip content="Duplicar grupo">
                          <button
                            onClick={(e) => { e.stopPropagation(); if (!duplicatingGrupoId) handleDuplicarGrupo(grupo.id); }}
                            className="btn btn-ghost btn-square btn-xs text-info"
                            disabled={duplicatingGrupoId === grupo.id}
                          >
                            {duplicatingGrupoId === grupo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </Tooltip>
                        <Tooltip content="Editar grupo">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAbrirModalEditarGrupo(grupo); }}
                            className="btn btn-ghost btn-square btn-xs"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Remover grupo">
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmRemoverGrupo(grupo.id); }}
                            className="btn btn-ghost btn-square btn-xs text-error"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </Tooltip>
                        {expandedGrupos.has(grupo.id) ? (
                          <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-base-content/40 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-base-content/40 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Itens do Grupo */}
                  {expandedGrupos.has(grupo.id) && (
                    <div className="p-3 space-y-2">
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                      >
                        {(() => {
                          const todosItensDoGrupo = getItensPorGrupo(grupo.id).sort((a, b) => a.ordem - b.ordem);
                          const itemIds = todosItensDoGrupo.map((item) => item.id);

                          return (
                            <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                              {Object.entries(getItensPorSecao(todosItensDoGrupo)).map(([secao, itens]) => {
                                const itensOrdenados = [...itens].sort((a, b) => a.ordem - b.ordem);

                                return (
                                  <div key={secao || 'sem-secao'}>
                                    {secao && (
                                      <div className="flex items-center gap-2 py-2 mb-2 border-b border-base-200">
                                        <span className="text-sm font-medium text-secondary">{secao}</span>
                                      </div>
                                    )}
                                    {itensOrdenados.map((item) => {
                                      const globalIndex = todosItensDoGrupo.findIndex((i) => i.id === item.id);
                                      return (
                                        <div key={item.id} ref={(el) => { itemRefs.current[item.id] = el; }}>
                                          <SortableItem
                                            item={item}
                                            index={globalIndex}
                                            onEdit={handleAbrirModalEditarItem}
                                            onRemove={(id) => setConfirmRemoverItem(id)}
                                            onDuplicate={handleDuplicarItem}
                                            isDuplicating={duplicatingItemId === item.id}
                                            isHighlighted={highlightedItemId === item.id}
                                          />
                                        </div>
                                      );
                                    })}
                                    {itens.length === 0 && (
                                      <p className="text-sm text-base-content/50 py-2">Nenhuma pergunta nesta seção</p>
                                    )}
                                  </div>
                                );
                              })}
                            </SortableContext>
                          );
                        })()}
                      </DndContext>
                      {getItensPorGrupo(grupo.id).length === 0 && (
                        <p className="text-sm text-base-content/50 py-4 text-center">Nenhuma pergunta neste grupo</p>
                      )}
                      <button
                        onClick={() => handleAbrirModalNovoItem(grupo.id)}
                        className="btn btn-ghost btn-sm w-full mt-2 border-dashed border-base-300"
                      >
                        <Plus className="w-4 h-4" /> Adicionar pergunta
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Itens sem grupo */}
              {getItensSemGrupo().length > 0 && (
                <div className="border border-base-300 rounded-lg">
                  <div className="flex items-center gap-2 sm:gap-3 p-3 bg-base-200">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-warning flex-shrink-0" />
                    <span className="font-medium text-sm sm:text-base">Perguntas sem grupo</span>
                    <span className="badge badge-warning badge-sm sm:badge-md">{getItensSemGrupo().length}</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={getItensSemGrupo()
                          .sort((a, b) => a.ordem - b.ordem)
                          .map((item) => item.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {getItensSemGrupo()
                          .sort((a, b) => a.ordem - b.ordem)
                          .map((item, idx) => (
                            <div key={item.id} ref={(el) => { itemRefs.current[item.id] = el; }}>
                              <SortableItem
                                item={item}
                                index={idx}
                                onEdit={handleAbrirModalEditarItem}
                                onRemove={(id) => setConfirmRemoverItem(id)}
                                onDuplicate={handleDuplicarItem}
                                isDuplicating={duplicatingItemId === item.id}
                                isHighlighted={highlightedItemId === item.id}
                              />
                            </div>
                          ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              )}

              {/* Estado vazio */}
              {(!template?.grupos || template.grupos.length === 0) && getItensSemGrupo().length === 0 && (
                <div className="text-center py-12">
                  <FolderOpen className="w-16 h-16 text-base-content/20 mx-auto mb-4" />
                  <p className="text-base-content/60 font-medium">Nenhum grupo ou pergunta cadastrada</p>
                  <p className="text-sm text-base-content/40 mt-1">Comece criando um grupo para organizar suas perguntas</p>
                  <button onClick={handleAbrirModalNovoGrupo} className="btn btn-primary mt-4">
                    <FolderOpen className="w-4 h-4" /> Criar Primeiro Grupo
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <FormModal
        open={showGrupoModal}
        onClose={() => { setShowGrupoModal(false); resetGrupoForm(); }}
        title={editingGrupo ? 'Editar Grupo' : 'Novo Grupo'}
        maxWidth="md"
        isDirty={Boolean(grupoForm.nome || grupoForm.descricao)}
        closeOnBackdrop={false}
        footer={
          <>
            <button className="btn btn-ghost w-full sm:w-auto" onClick={() => { setShowGrupoModal(false); resetGrupoForm(); }}>Cancelar</button>
            <button className="btn btn-primary w-full sm:w-auto" onClick={handleSalvarGrupo} disabled={saving || !grupoForm.nome}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : 'Salvar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="form-control">
            <label className="label"><span className="label-text">Nome do Grupo *</span></label>
            <input
              type="text"
              placeholder="Ex: ESTRUTURA"
              className="input input-bordered"
              value={grupoForm.nome}
              onChange={(e) => setGrupoForm({ ...grupoForm, nome: e.target.value })}
            />
          </div>
          <div className="form-control">
            <label className="label"><span className="label-text">Descrição</span></label>
            <textarea
              className="textarea textarea-bordered"
              rows={2}
              placeholder="Descrição opcional do grupo"
              value={grupoForm.descricao}
              onChange={(e) => setGrupoForm({ ...grupoForm, descricao: e.target.value })}
            />
          </div>
        </div>
      </FormModal>

      <FormModal
        open={showItemModal}
        onClose={() => { setShowItemModal(false); resetItemForm(); }}
        title={editingItem ? 'Editar Pergunta' : 'Nova Pergunta'}
        maxWidth="4xl"
        isDirty={Boolean(itemForm.pergunta)}
        closeOnBackdrop={false}
        footer={
          <>
            <button className="btn btn-ghost btn-sm sm:btn-md w-full sm:w-auto" onClick={() => { setShowItemModal(false); resetItemForm(); }}>Cancelar</button>
            <button className="btn btn-primary btn-sm sm:btn-md w-full sm:w-auto" onClick={handleSalvarItem} disabled={saving || !itemForm.pergunta}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : editingItem ? 'Salvar Alterações' : 'Adicionar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
              {/* Grupo e Seção */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-xs sm:text-sm">Grupo</span></label>
                  <select
                    className="select select-bordered select-sm sm:select-md"
                    value={itemForm.grupoId || ''}
                    onChange={(e) => setItemForm({ ...itemForm, grupoId: e.target.value || undefined })}
                  >
                    <option value="">Sem grupo</option>
                    {template?.grupos?.map((g) => (
                      <option key={g.id} value={g.id}>{g.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-xs sm:text-sm">Seção (opcional)</span></label>
                  <input
                    type="text"
                    placeholder="Ex: ÁREA DE LAVAGEM"
                    className="input input-bordered input-sm sm:input-md"
                    value={itemForm.secao}
                    onChange={(e) => setItemForm({ ...itemForm, secao: e.target.value })}
                  />
                </div>
              </div>

              {/* Pergunta */}
              <div className="form-control">
                <label className="label py-1"><span className="label-text text-xs sm:text-sm">Pergunta *</span></label>
                <textarea
                  placeholder="Ex: As paredes, piso e teto estão em boas condições?"
                  className="textarea textarea-bordered text-sm"
                  rows={2}
                  value={itemForm.pergunta}
                  onChange={(e) => setItemForm({ ...itemForm, pergunta: e.target.value })}
                />
              </div>

              {/* Categoria, Criticidade, Peso e Obrigatório */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="form-control">
                  <label className="label py-1"><span className="label-text text-xs sm:text-sm">Categoria</span></label>
                  <select
                    className="select select-bordered select-sm sm:select-md"
                    value={itemForm.categoria}
                    onChange={(e) => setItemForm({ ...itemForm, categoria: e.target.value as CategoriaItem })}
                  >
                    {Object.entries(CATEGORIA_ITEM_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs sm:text-sm flex items-center gap-1">
                      Criticidade
                      <Tooltip content="Define o grau de impacto desta pergunta na avaliação. Perguntas com criticidade alta ou crítica têm maior relevância no resultado final e podem gerar alertas automáticos de não conformidade.">
                        <HelpCircle className="w-3.5 h-3.5 text-base-content/40 cursor-help" />
                      </Tooltip>
                    </span>
                  </label>
                  <select
                    className="select select-bordered select-sm sm:select-md"
                    value={itemForm.criticidade}
                    onChange={(e) => setItemForm({ ...itemForm, criticidade: e.target.value as CriticidadeItem })}
                  >
                    {Object.entries(CRITICIDADE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                {itemForm.tipoRespostaCustomizada !== TipoRespostaCustomizada.TEXTO && (
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs sm:text-sm flex items-center gap-1">
                        Peso
                        <Tooltip content="Multiplicador aplicado à pontuação desta pergunta. Um peso maior aumenta a influência desta pergunta no cálculo da nota final da auditoria. Ex: peso 2 dobra o valor da pontuação obtida.">
                          <HelpCircle className="w-3.5 h-3.5 text-base-content/40 cursor-help" />
                        </Tooltip>
                      </span>
                    </label>
                    <input
                      type="number"
                      min="-10"
                      max="10"
                      className="input input-bordered input-sm sm:input-md"
                      value={itemForm.peso}
                      onChange={(e) => {
                        const v = e.target.value === '' ? 1 : parseInt(e.target.value, 10);
                        setItemForm({ ...itemForm, peso: Number.isNaN(v) ? 1 : v });
                      }}
                    />
                  </div>
                )}
                <div className="form-control justify-end">
                  <label className="label cursor-pointer py-1 gap-2">
                    <span className="label-text text-xs sm:text-sm">Pergunta Obrigatória</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm sm:toggle-md"
                      checked={itemForm.obrigatorio}
                      onChange={(e) => setItemForm({ ...itemForm, obrigatorio: e.target.checked })}
                    />
                  </label>
                </div>
              </div>

              {/* Legislação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs sm:text-sm flex items-center gap-1">
                      Legislação
                      <Tooltip content="Norma ou legislação de referência que fundamenta esta pergunta. Será exibida ao auditor durante a avaliação como base legal para a verificação. Ex: RDC 216/2004, NR-12, ISO 9001.">
                        <HelpCircle className="w-3.5 h-3.5 text-base-content/40 cursor-help" />
                      </Tooltip>
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: RDC 216/2004"
                    className="input input-bordered input-sm sm:input-md"
                    value={itemForm.legislacaoReferencia}
                    onChange={(e) => setItemForm({ ...itemForm, legislacaoReferencia: e.target.value })}
                  />
                </div>
                <div className="form-control">
                  <label className="label py-1">
                    <span className="label-text text-xs sm:text-sm flex items-center gap-1">
                      Artigo/Inciso
                      <Tooltip content="Artigo, parágrafo ou inciso específico da legislação informada. Permite ao auditor consultar o trecho exato da norma durante a auditoria. Ex: Art. 4.1.3, § 2º, Inciso IV.">
                        <HelpCircle className="w-3.5 h-3.5 text-base-content/40 cursor-help" />
                      </Tooltip>
                    </span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Art. 4.1.3"
                    className="input input-bordered input-sm sm:input-md"
                    value={itemForm.artigo}
                    onChange={(e) => setItemForm({ ...itemForm, artigo: e.target.value })}
                  />
                </div>
              </div>

              <div className="divider my-2 text-xs sm:text-sm">Opções de Resposta</div>

              {/* Tipo de Resposta Customizada */}
              <div className="form-control">
                <label className="label py-1">
                  <span className="label-text text-xs sm:text-sm font-medium">Tipo de Resposta</span>
                </label>
                <select
                  className="select select-bordered select-sm sm:select-md"
                  value={itemForm.tipoRespostaCustomizada || ''}
                  onChange={(e) => {
                    const valor = e.target.value ? (e.target.value as TipoRespostaCustomizada) : undefined;
                    setItemForm({
                      ...itemForm,
                      tipoRespostaCustomizada: valor,
                      usarRespostasPersonalizadas: valor !== undefined,
                      peso: valor === TipoRespostaCustomizada.TEXTO ? 0 : itemForm.peso,
                    });
                  }}
                >
                  <option value="">Padrão (Conforme/Não Conforme/N.A.)</option>
                  <option value={TipoRespostaCustomizada.TEXTO}>{TIPO_RESPOSTA_LABELS[TipoRespostaCustomizada.TEXTO]}</option>
                  <option value={TipoRespostaCustomizada.NUMERO}>{TIPO_RESPOSTA_LABELS[TipoRespostaCustomizada.NUMERO]}</option>
                  <option value={TipoRespostaCustomizada.DATA}>{TIPO_RESPOSTA_LABELS[TipoRespostaCustomizada.DATA]}</option>
                  <option value={TipoRespostaCustomizada.SELECT}>{TIPO_RESPOSTA_LABELS[TipoRespostaCustomizada.SELECT]}</option>
                </select>
                <label className="label py-0.5">
                  <span className="label-text-alt text-base-content/60 text-xs">
                    {itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT && 'Configure as opções abaixo'}
                    {itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO && 'Campo de texto livre'}
                    {itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.NUMERO && 'Campo numérico'}
                    {itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.DATA && 'Seletor de data'}
                    {!itemForm.tipoRespostaCustomizada && 'Use botões de resposta padrão'}
                  </span>
                </label>
              </div>

              {/* Toggle Respostas Personalizadas */}
              {!itemForm.tipoRespostaCustomizada && (
                <div className="form-control bg-base-200 rounded-lg p-3">
                  <label className="label cursor-pointer justify-start gap-3 py-0">
                    <input
                      type="checkbox"
                      className="toggle toggle-secondary toggle-sm"
                      checked={itemForm.usarRespostasPersonalizadas}
                      onChange={(e) => setItemForm({ ...itemForm, usarRespostasPersonalizadas: e.target.checked })}
                    />
                    <div>
                      <span className="label-text text-xs sm:text-sm font-medium">Respostas personalizadas</span>
                      <p className="text-xs text-base-content/60 mt-0.5 hidden sm:block">Padrão: Conforme, Não Conforme, Não Aplicável, Não Avaliado</p>
                    </div>
                  </label>
                </div>
              )}

              {/* Respostas Personalizadas */}
              {((itemForm.usarRespostasPersonalizadas && !itemForm.tipoRespostaCustomizada) || itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT) && (
                <div className="space-y-3 bg-base-200/50 rounded-lg p-3 sm:p-4">
                  <label className="label py-0"><span className="label-text text-xs sm:text-sm font-medium">Opções de Resposta</span></label>
                  {itemForm.opcoesResposta && itemForm.opcoesResposta.length > 0 && (
                    <div className="space-y-2">
                      {itemForm.opcoesResposta.length > 1 && (
                        <div className="flex items-center justify-end gap-2">
                          <Tooltip content="Foto obrigatória em todas">
                            <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1 cursor-pointer transition-colors text-xs ${
                              (itemForm.opcoesRespostaConfig || []).every((c) => c.fotoObrigatoria) ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-base-200'
                            }`}>
                              <Camera className={`w-3 h-3 flex-shrink-0 ${(itemForm.opcoesRespostaConfig || []).every((c) => c.fotoObrigatoria) ? 'text-primary' : 'text-base-content/40'}`} />
                              <span className="hidden sm:inline">Todas</span>
                              <input
                                type="checkbox"
                                className="checkbox checkbox-xs checkbox-primary"
                                checked={(itemForm.opcoesRespostaConfig || []).length > 0 && (itemForm.opcoesRespostaConfig || []).every((c) => c.fotoObrigatoria)}
                                onChange={(e) => handleToggleTodasOpcoes('fotoObrigatoria', e.target.checked)}
                              />
                            </label>
                          </Tooltip>
                          <Tooltip content="Observação obrigatória em todas">
                            <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1 cursor-pointer transition-colors text-xs ${
                              (itemForm.opcoesRespostaConfig || []).every((c) => c.observacaoObrigatoria) ? 'bg-secondary/10 ring-1 ring-secondary/30' : 'bg-base-200'
                            }`}>
                              <MessageSquare className={`w-3 h-3 flex-shrink-0 ${(itemForm.opcoesRespostaConfig || []).every((c) => c.observacaoObrigatoria) ? 'text-secondary' : 'text-base-content/40'}`} />
                              <span className="hidden sm:inline">Todas</span>
                              <input
                                type="checkbox"
                                className="checkbox checkbox-xs checkbox-secondary"
                                checked={(itemForm.opcoesRespostaConfig || []).length > 0 && (itemForm.opcoesRespostaConfig || []).every((c) => c.observacaoObrigatoria)}
                                onChange={(e) => handleToggleTodasOpcoes('observacaoObrigatoria', e.target.checked)}
                              />
                            </label>
                          </Tooltip>
                        </div>
                      )}
                      {itemForm.opcoesResposta.map((opcao, idx) => {
                        const config = itemForm.opcoesRespostaConfig?.find(c => c.valor === opcao);
                        const semPontuacao = isOpcaoSemPontuacao(opcao);
                        const opcoesPontuaveis = (itemForm.opcoesResposta || []).filter((op) => !isOpcaoSemPontuacao(op));
                        const idxPontuavel = opcoesPontuaveis.indexOf(opcao);
                        const configPrimeira = itemForm.opcoesRespostaConfig?.find((c) => c.valor === opcoesPontuaveis[0]);
                        const pontuacaoExibida = config?.pontuacao === null
                          ? ''
                          : (typeof config?.pontuacao === 'number'
                            ? config.pontuacao
                            : (idxPontuavel > 0 && configPrimeira?.pontuacao != null ? configPrimeira.pontuacao - idxPontuavel : ''));
                        return (
                          <div key={idx} className="bg-base-100 rounded-lg p-2.5 sm:p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="badge badge-primary badge-outline font-semibold text-xs sm:text-sm">{opcao}</span>
                              <div className="flex items-center gap-0.5">
                                <Tooltip content="Duplicar resposta">
                                  <button
                                    onClick={() => handleDuplicarResposta(opcao)}
                                    className="btn btn-ghost btn-xs btn-circle"
                                  >
                                    <Copy className="w-3 h-3" />
                                  </button>
                                </Tooltip>
                                <button
                                  onClick={() => handleRemoverOpcaoResposta(opcao)}
                                  className="btn btn-ghost btn-xs btn-circle text-error"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <Tooltip content="Pontuação atribuída a esta resposta">
                                <div className="flex items-center gap-1.5 bg-base-200 rounded-lg px-2 py-1.5">
                                  <Star className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                                  <input
                                    type="number"
                                    min={-10}
                                    max={10}
                                    className="input input-ghost input-xs w-full p-0 text-center font-medium"
                                    placeholder="—"
                                    value={pontuacaoExibida}
                                    onChange={(e) => {
                                      const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                      handleAtualizarOpcaoConfig(opcao, 'pontuacao', v === null || Number.isNaN(v) ? null : v);
                                    }}
                                  />
                                </div>
                              </Tooltip>
                              <Tooltip content="Foto obrigatória ao selecionar esta resposta">
                                <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${config?.fotoObrigatoria ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-base-200'}`}>
                                  <Camera className={`w-3.5 h-3.5 flex-shrink-0 ${config?.fotoObrigatoria ? 'text-primary' : 'text-base-content/40'}`} />
                                  <span className="text-xs truncate hidden sm:inline">Foto</span>
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-xs checkbox-primary ml-auto"
                                    checked={config?.fotoObrigatoria || false}
                                    onChange={(e) => handleAtualizarOpcaoConfig(opcao, 'fotoObrigatoria', e.target.checked)}
                                  />
                                </label>
                              </Tooltip>
                              <Tooltip content="Observação obrigatória ao selecionar esta resposta">
                                <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${config?.observacaoObrigatoria ? 'bg-secondary/10 ring-1 ring-secondary/30' : 'bg-base-200'}`}>
                                  <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${config?.observacaoObrigatoria ? 'text-secondary' : 'text-base-content/40'}`} />
                                  <span className="text-xs truncate hidden sm:inline">Obs.</span>
                                  <input
                                    type="checkbox"
                                    className="checkbox checkbox-xs checkbox-secondary ml-auto"
                                    checked={config?.observacaoObrigatoria || false}
                                    onChange={(e) => handleAtualizarOpcaoConfig(opcao, 'observacaoObrigatoria', e.target.checked)}
                                  />
                                </label>
                              </Tooltip>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nova opção de resposta"
                      className="input input-bordered input-sm flex-1"
                      value={novaOpcaoResposta}
                      onChange={(e) => setNovaOpcaoResposta(e.target.value)}
                      onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdicionarOpcaoResposta(); }}}
                    />
                    <button type="button" onClick={handleAdicionarOpcaoResposta} className="btn btn-secondary btn-sm" disabled={!novaOpcaoResposta.trim()}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <span className="text-xs text-base-content/60">Sugestões:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {RESPOSTAS_PERSONALIZADAS_SUGESTOES.filter((s) => !itemForm.opcoesResposta?.includes(s)).map((sugestao) => (
                        <button key={sugestao} type="button" onClick={() => handleAdicionarSugestao(sugestao)} className="badge badge-outline badge-sm sm:badge-md text-base-content font-bold hover:badge-primary hover:!text-white cursor-pointer transition-colors px-2 sm:px-3 py-1">
                          + {sugestao}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Respostas Padrão */}
              {!itemForm.usarRespostasPersonalizadas && !itemForm.tipoRespostaCustomizada && (
                <div className="bg-base-200/50 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-base-content/60 font-medium">Configuração das respostas padrão:</span>
                    <div className="flex items-center gap-2">
                      <Tooltip content="Foto obrigatória em todas">
                        <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1 cursor-pointer transition-colors text-xs ${
                          RESPOSTAS_PADRAO.every((r) => (itemForm.opcoesRespostaConfig || []).find((c) => c.valor === r.valor)?.fotoObrigatoria) ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-base-200'
                        }`}>
                          <Camera className={`w-3 h-3 flex-shrink-0 ${RESPOSTAS_PADRAO.every((r) => (itemForm.opcoesRespostaConfig || []).find((c) => c.valor === r.valor)?.fotoObrigatoria) ? 'text-primary' : 'text-base-content/40'}`} />
                          <span className="hidden sm:inline">Todas</span>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs checkbox-primary"
                            checked={RESPOSTAS_PADRAO.every((r) => (itemForm.opcoesRespostaConfig || []).find((c) => c.valor === r.valor)?.fotoObrigatoria)}
                            onChange={(e) => handleToggleTodasOpcoes('fotoObrigatoria', e.target.checked)}
                          />
                        </label>
                      </Tooltip>
                      <Tooltip content="Observação obrigatória em todas">
                        <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1 cursor-pointer transition-colors text-xs ${
                          RESPOSTAS_PADRAO.every((r) => (itemForm.opcoesRespostaConfig || []).find((c) => c.valor === r.valor)?.observacaoObrigatoria) ? 'bg-secondary/10 ring-1 ring-secondary/30' : 'bg-base-200'
                        }`}>
                          <MessageSquare className={`w-3 h-3 flex-shrink-0 ${RESPOSTAS_PADRAO.every((r) => (itemForm.opcoesRespostaConfig || []).find((c) => c.valor === r.valor)?.observacaoObrigatoria) ? 'text-secondary' : 'text-base-content/40'}`} />
                          <span className="hidden sm:inline">Todas</span>
                          <input
                            type="checkbox"
                            className="checkbox checkbox-xs checkbox-secondary"
                            checked={RESPOSTAS_PADRAO.every((r) => (itemForm.opcoesRespostaConfig || []).find((c) => c.valor === r.valor)?.observacaoObrigatoria)}
                            onChange={(e) => handleToggleTodasOpcoes('observacaoObrigatoria', e.target.checked)}
                          />
                        </label>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="space-y-2 mt-2">
                    {RESPOSTAS_PADRAO.map((resp) => {
                      const config = itemForm.opcoesRespostaConfig?.find(c => c.valor === resp.valor);
                      const semPontuacao = isOpcaoSemPontuacao(resp.valor);
                      const opcoesPontuaveis = RESPOSTAS_PADRAO.filter((r) => !isOpcaoSemPontuacao(r.valor));
                      const idxPontuavel = opcoesPontuaveis.findIndex((r) => r.valor === resp.valor);
                      const configPrimeira = itemForm.opcoesRespostaConfig?.find((c) => c.valor === opcoesPontuaveis[0]?.valor);
                      const pontuacaoExibida = config?.pontuacao === null
                        ? ''
                        : (typeof config?.pontuacao === 'number'
                          ? config.pontuacao
                          : (idxPontuavel > 0 && configPrimeira?.pontuacao != null ? configPrimeira.pontuacao - idxPontuavel : ''));
                      return (
                        <div key={resp.valor} className="bg-base-100 rounded-lg p-2.5 sm:p-3">
                          <div className="flex items-center justify-between mb-2 sm:mb-0 sm:float-left sm:mr-3">
                            <span className="badge badge-ghost text-xs sm:text-sm">{resp.label}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:justify-end sm:gap-3">
                            <Tooltip content="Pontuação">
                              <div className="flex items-center gap-1.5 bg-base-200 rounded-lg px-2 py-1.5">
                                <Star className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                                <input
                                  type="number"
                                  min={-10}
                                  max={10}
                                  className="input input-ghost input-xs w-full sm:w-16 p-0 text-center font-medium"
                                  placeholder="—"
                                  value={pontuacaoExibida}
                                  onChange={(e) => {
                                    const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                    handleAtualizarOpcaoConfig(resp.valor, 'pontuacao', v === null || Number.isNaN(v) ? null : v);
                                  }}
                                />
                              </div>
                            </Tooltip>
                            <Tooltip content="Foto obrigatória">
                              <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${config?.fotoObrigatoria ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-base-200'}`}>
                                <Camera className={`w-3.5 h-3.5 flex-shrink-0 ${config?.fotoObrigatoria ? 'text-primary' : 'text-base-content/40'}`} />
                                <span className="text-xs truncate hidden sm:inline">Foto</span>
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-xs checkbox-primary ml-auto"
                                  checked={config?.fotoObrigatoria || false}
                                  onChange={(e) => handleAtualizarOpcaoConfig(resp.valor, 'fotoObrigatoria', e.target.checked)}
                                />
                              </label>
                            </Tooltip>
                            <Tooltip content="Observação obrigatória">
                              <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${config?.observacaoObrigatoria ? 'bg-secondary/10 ring-1 ring-secondary/30' : 'bg-base-200'}`}>
                                <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${config?.observacaoObrigatoria ? 'text-secondary' : 'text-base-content/40'}`} />
                                <span className="text-xs truncate hidden sm:inline">Obs.</span>
                                <input
                                  type="checkbox"
                                  className="checkbox checkbox-xs checkbox-secondary ml-auto"
                                  checked={config?.observacaoObrigatoria || false}
                                  onChange={(e) => handleAtualizarOpcaoConfig(resp.valor, 'observacaoObrigatoria', e.target.checked)}
                                />
                              </label>
                            </Tooltip>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
        </div>
      </FormModal>

      <ConfirmDialog
        open={confirmRemoverGrupo !== null}
        onClose={() => setConfirmRemoverGrupo(null)}
        onConfirm={() => { if (confirmRemoverGrupo) return handleRemoverGrupo(confirmRemoverGrupo); }}
        title="Excluir Grupo"
        message="Tem certeza que deseja remover este grupo? As perguntas serão desvinculadas do grupo."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        loading={saving}
      />

      <ConfirmDialog
        open={confirmRemoverItem !== null}
        onClose={() => setConfirmRemoverItem(null)}
        onConfirm={() => { if (confirmRemoverItem) return handleRemoverItem(confirmRemoverItem); }}
        title="Excluir Pergunta"
        message="Tem certeza que deseja remover esta pergunta? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        loading={saving}
      />
    </AppLayout>
  );
}

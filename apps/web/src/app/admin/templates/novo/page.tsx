'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Save,
  Loader2,
  Plus,
  Trash2,
  ChevronLeft,
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
  TipoRespostaCustomizada,
  TIPO_ATIVIDADE_LABELS,
  CATEGORIA_ITEM_LABELS,
  CRITICIDADE_LABELS,
  TIPO_RESPOSTA_LABELS,
  CriarTemplateItemRequest,
  CriarGrupoRequest,
  type LegislacaoResumo,
  RESPOSTAS_PADRAO,
} from '@/lib/api';
import { toastService } from '@/lib/toast';
import { SeletorLegislacoes } from '@/components/legislacao/seletor-legislacoes';
import { nomesLegislacoesDoItem } from '@/lib/legislacao/legislacoes-do-item';
import { calcularPontuacoesEmSequencia, isOpcaoSemPontuacao } from '@/lib/utils';

interface ItemFormData extends CriarTemplateItemRequest {
  id?: string;
  /** Texto antigo de referência, só exibido quando o item ainda não tem legislação vinculada. */
  referenciaAnterior?: string | null;
  /** Só envia legislacaoIds ao salvar quando a seleção foi mexida (não apaga o texto legado à toa). */
  legislacaoAlterada?: boolean;
  legislacoesConhecidas?: LegislacaoResumo[];
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
    [CriticidadeItem.BAIXA]: '!bg-info/12 !text-[hsl(217_80%_45%)]',
    [CriticidadeItem.MEDIA]: '!bg-warning/15 !text-[hsl(32_95%_34%)]',
    [CriticidadeItem.ALTA]: '!bg-destructive/12 !text-[hsl(0_72%_45%)]',
    [CriticidadeItem.CRITICA]: '!border !border-destructive !bg-transparent !text-[hsl(0_72%_45%)]',
  };
  return colors[criticidade] || '!bg-muted !text-muted-foreground';
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
  const nomeLegislacao = nomesLegislacoesDoItem({ legislacoes: item.legislacoes, referenciaLegal: item.legislacaoReferencia });
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
      className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-card rounded-lg border group hover:border-primary/30 transition-all cursor-pointer ${
        isHighlighted ? 'border-info shadow-lg shadow-info/20 ring-2 ring-info/30' : 'border-muted'
      }`}
      onClick={() => onEdit(item)}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/70 hover:text-muted-foreground transition-colors flex-shrink-0 flex items-center justify-center w-6 h-6"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <span className="text-xs sm:text-sm font-bold text-muted-foreground/70 min-w-[20px] sm:min-w-[24px] flex-shrink-0">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-sm leading-relaxed break-words">{item.pergunta}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5 sm:mt-1">
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 text-[11px] bg-muted text-muted-foreground py-1">{CATEGORIA_ITEM_LABELS[item.categoria]}</span>
          <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 text-[11px] bg-muted text-foreground py-1 ${getCriticidadeBadge(item.criticidade)}`}>
            {CRITICIDADE_LABELS[item.criticidade]}
          </span>
          {nomeLegislacao && (
            <span className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-none">
              {nomeLegislacao}
            </span>
          )}
          {item.usarRespostasPersonalizadas && (
            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 text-[11px] bg-info/12 text-[hsl(217_80%_45%)] py-1">
              <Settings className="w-2.5 h-2.5 sm:w-3 sm:h-3" />Pers.
            </span>
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
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-7 w-7 px-0 hover:bg-muted text-info"
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
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-7 w-7 px-0 hover:bg-muted"
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
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-7 w-7 px-0 hover:bg-muted text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

/**
 * Página para criar um novo template com suporte a grupos e seções.
 */
export default function NovoTemplatePage() {
  const router = useRouter();
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [templateCreated, setTemplateCreated] = useState(false);
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
    legislacaoIds: [],
    referenciaAnterior: null,
    legislacaoAlterada: false,
    legislacoesConhecidas: [],
    obrigatorio: true,
    opcoesResposta: [],
    opcoesRespostaConfig: RESPOSTAS_PADRAO.map((r) => ({
      valor: r.valor,
      fotoObrigatoria: false,
      observacaoObrigatoria: false,
    })),
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
      // Recarregar template em caso de erro
      if (template) {
        loadTemplate();
      }
    }
  };

  const loadTemplate = useCallback(async () => {
    if (!template?.id) return;
    try {
      setLoading(true);
      const data = await checklistService.buscarTemplatePorId(template.id);
      setTemplate(data);
      // Expandir todos os grupos por padrão
      if (data.grupos) {
        setExpandedGrupos(new Set(data.grupos.map((g) => g.id)));
      }
    } catch {
      toastService.error('Erro ao carregar checklist');
    } finally {
      setLoading(false);
    }
  }, [template?.id]);

  // Criar template inicial
  const handleCriarTemplate = async () => {
    if (!formData.nome.trim()) {
      toastService.warning('O nome do checklist é obrigatório');
      return;
    }
    setSaving(true);
    try {
      const novoTemplate = await checklistService.criarTemplate(formData);
      setTemplate(novoTemplate);
      setTemplateCreated(true);
      toastService.success('Checklist criado com sucesso! Agora você pode adicionar grupos e perguntas.');
      // Expandir todos os grupos por padrão
      if (novoTemplate.grupos) {
        setExpandedGrupos(new Set(novoTemplate.grupos.map((g) => g.id)));
      }
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleSalvar = async () => {
    if (!template) return;
    if (!formData.nome.trim()) {
      toastService.warning('O nome do checklist é obrigatório');
      return;
    }
    setSaving(true);
    try {
      await checklistService.atualizarTemplate(template.id, formData);
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
    if (!template) {
      toastService.warning('Crie o template primeiro');
      return;
    }
    resetGrupoForm();
    setShowGrupoModal(true);
  };

  const handleAbrirModalEditarGrupo = (grupo: ChecklistGrupo) => {
    setEditingGrupo(grupo);
    setGrupoForm({ nome: grupo.nome, descricao: grupo.descricao || '' });
    setShowGrupoModal(true);
  };

  const handleSalvarGrupo = async () => {
    if (!grupoForm.nome.trim() || !template) return;
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
        const novoGrupo = await checklistService.adicionarGrupo(template.id, grupoForm);
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
      // Recarregar template para garantir sincronização
      loadTemplate();
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
      legislacaoIds: [],
      referenciaAnterior: null,
      legislacaoAlterada: false,
      legislacoesConhecidas: [],
      obrigatorio: true,
      opcoesResposta: [],
      opcoesRespostaConfig: RESPOSTAS_PADRAO.map((r) => ({
        valor: r.valor,
        fotoObrigatoria: false,
        observacaoObrigatoria: false,
      })),
      usarRespostasPersonalizadas: false,
      tipoRespostaCustomizada: undefined,
      grupoId: undefined,
      secao: '',
    });
    setNovaOpcaoResposta('');
    setEditingItem(null);
    setSelectedGrupoId(null);
  };

  const handleAbrirModalNovoItem = (grupoId?: string) => {
    if (!template) {
      toastService.warning('Crie o checklist primeiro');
      return;
    }
    resetItemForm();
    setSelectedGrupoId(grupoId || null);
    setItemForm((prev) => ({ ...prev, grupoId }));
    setShowItemModal(true);
  };

  const handleAbrirModalEditarItem = (item: TemplateItem) => {
    setEditingItem(item);
    const configs =
      (item.opcoesRespostaConfig?.length ?? 0) > 0
        ? item.opcoesRespostaConfig
        : RESPOSTAS_PADRAO.map((r) => ({
            valor: r.valor,
            fotoObrigatoria: false,
            observacaoObrigatoria: false,
          }));
    setItemForm({
      id: item.id,
      pergunta: item.pergunta,
      categoria: item.categoria,
      criticidade: item.criticidade,
      peso: item.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO ? 0 : item.peso,
      legislacaoIds: item.legislacoes?.map((l) => l.id) ?? [],
      referenciaAnterior: item.legislacoes?.length ? null : item.legislacaoReferencia ?? null,
      legislacaoAlterada: false,
      legislacoesConhecidas: item.legislacoes ?? [],
      obrigatorio: item.obrigatorio,
      opcoesResposta: item.opcoesResposta || [],
      opcoesRespostaConfig: configs,
      usarRespostasPersonalizadas: item.usarRespostasPersonalizadas || false,
      tipoRespostaCustomizada: item.tipoRespostaCustomizada,
      grupoId: item.grupoId,
      secao: item.secao || '',
    });
    setShowItemModal(true);
  };

  const handleSalvarItem = async () => {
    if (!itemForm.pergunta.trim() || !template) return;
    setSaving(true);
    try {
      const dadosItem: CriarTemplateItemRequest = {
        pergunta: itemForm.pergunta,
        categoria: itemForm.categoria,
        criticidade: itemForm.criticidade,
        peso: itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO ? 0 : itemForm.peso,
        ...(itemForm.legislacaoAlterada ? { legislacaoIds: itemForm.legislacaoIds ?? [] } : {}),
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
        const novoItem = await checklistService.adicionarItem(template.id, dadosItem);
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
      // Recarregar template para garantir sincronização
      loadTemplate();
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
      opcoesResposta: (itemForm.opcoesResposta || []).filter((o) => o !== opcao),
      opcoesRespostaConfig: (itemForm.opcoesRespostaConfig || []).filter((c) => c.valor !== opcao),
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
      const idx = configs.findIndex((c) => c.valor === valor);
      const novasConfigs =
        idx >= 0
          ? configs.map((c) => (c.valor === valor ? { ...c, [campo]: value } : c))
          : [...configs, { valor, fotoObrigatoria: false, observacaoObrigatoria: false, [campo]: value }];
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

  return (
    <AppLayout>
      {/* Header */}
      <div className="bg-card border-b border-border px-4 lg:px-8 py-4 sticky top-14 z-30">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Link href="/admin/templates" className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 w-9 px-0 rounded-full hover:bg-muted">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground">Novo Checklist</h1>
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 py-0.5 text-[11px] bg-warning/15 text-[hsl(32_95%_34%)]">Rascunho</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {templateCreated ? 'Adicione grupos e perguntas ao checklist' : 'Crie um novo checklist'}
            </p>
          </div>
          {templateCreated && (
            <button onClick={handleSalvar} disabled={saving} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90 gap-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 lg:px-8 space-y-4 pb-24">
        {/* Informações Básicas */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative flex flex-col rounded-lg border border-border bg-card shadow-sm"
        >
          <div className="flex flex-1 flex-col gap-2 p-6">
            <h2 className="flex items-center gap-2 font-display font-semibold text-base">Informações do Checklist</h2>
            <div className="space-y-4 mt-2">
              <div className="flex flex-col">
                <label className="flex items-center justify-between gap-2 py-1"><span className="text-sm font-medium text-foreground">Nome *</span></label>
                <input
                  type="text"
                  className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  disabled={templateCreated}
                />
              </div>
              <div className="flex flex-col">
                <label className="flex items-center justify-between gap-2 py-1"><span className="text-sm font-medium text-foreground">Descrição</span></label>
                <textarea
                  className="min-h-[80px] px-3 py-2 rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                  rows={2}
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  disabled={templateCreated}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="flex items-center justify-between gap-2 py-1"><span className="text-sm font-medium text-foreground">Tipo de Atividade</span></label>
                  <select
                    className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
                    value={formData.tipoAtividade}
                    onChange={(e) => setFormData({ ...formData, tipoAtividade: e.target.value as TipoAtividade })}
                    disabled={templateCreated}
                  >
                    {Object.entries(TIPO_ATIVIDADE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="flex items-center justify-between gap-2 py-1"><span className="text-sm font-medium text-foreground">Versão</span></label>
                  <input
                    type="text"
                    className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
                    value={formData.versao}
                    onChange={(e) => setFormData({ ...formData, versao: e.target.value })}
                    disabled={templateCreated}
                  />
                </div>
              </div>
              {!templateCreated && (
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleCriarTemplate}
                    disabled={saving || !formData.nome.trim()}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4" />
                        Criar Template
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Grupos e Itens - Só aparece após criar o template */}
        {templateCreated && template && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative flex flex-col rounded-lg border border-border bg-card shadow-sm"
          >
            <div className="flex flex-1 flex-col gap-2 p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display font-semibold text-base">
                  Grupos e Perguntas ({template?.grupos?.length || 0} grupos, {template?.itens?.filter(i => i.ativo !== false).length || 0} perguntas)
                </h2>
                <div className="flex gap-2">
                  <button onClick={handleAbrirModalNovoGrupo} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 bg-info text-white hover:bg-info/90 gap-1">
                    <FolderOpen className="w-4 h-4" />
                    Novo Grupo
                  </button>
                  <button onClick={() => handleAbrirModalNovoItem()} className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90 gap-1">
                    <Plus className="w-4 h-4" />
                    Nova Pergunta
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
                        : 'border-border'
                    }`}
                  >
                    {/* Header do Grupo */}
                    <div
                      className="flex items-center gap-3 p-3 bg-muted rounded-t-lg cursor-pointer hover:bg-border transition-colors"
                      onClick={() => toggleGrupoExpanded(grupo.id)}
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground/70" />
                      <FolderOpen className="w-5 h-5 text-info" />
                      <div className="flex-1">
                        <p className="font-medium">{grupo.nome}</p>
                        {grupo.descricao && <p className="text-sm text-muted-foreground">{grupo.descricao}</p>}
                      </div>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2.5 py-0.5 text-xs bg-muted text-muted-foreground">{getItensPorGrupo(grupo.id).length} perguntas</span>
                      <div className="flex items-center gap-0.5">
                        <Tooltip content="Duplicar grupo">
                          <button
                            onClick={(e) => { e.stopPropagation(); if (!duplicatingGrupoId) handleDuplicarGrupo(grupo.id); }}
                            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-7 w-7 px-0 hover:bg-muted text-info"
                            disabled={duplicatingGrupoId === grupo.id}
                          >
                            {duplicatingGrupoId === grupo.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                          </button>
                        </Tooltip>
                        <Tooltip content="Editar grupo">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAbrirModalEditarGrupo(grupo); }}
                            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-7 w-7 px-0 hover:bg-muted"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </Tooltip>
                        <Tooltip content="Remover grupo">
                          <button
                            onClick={(e) => { e.stopPropagation(); setConfirmRemoverGrupo(grupo.id); }}
                            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-7 w-7 px-0 hover:bg-muted text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </Tooltip>
                        {expandedGrupos.has(grupo.id) ? (
                          <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/70" />
                        ) : (
                          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground/70" />
                        )}
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
                                        <div className="flex items-center gap-2 py-2 mb-2 border-b border-muted">
                                          <span className="text-sm font-medium text-info">{secao}</span>
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
                                        <p className="text-sm text-muted-foreground py-2">Nenhuma pergunta nesta seção</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </SortableContext>
                            );
                          })()}
                        </DndContext>
                        {getItensPorGrupo(grupo.id).length === 0 && (
                          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma pergunta neste grupo</p>
                        )}
                        <button
                          onClick={() => handleAbrirModalNovoItem(grupo.id)}
                          className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 hover:bg-muted w-full mt-2 border-dashed border-border"
                        >
                          <Plus className="w-4 h-4" /> Adicionar pergunta
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Itens sem grupo */}
                {getItensSemGrupo().length > 0 && (
                  <div className="border border-border rounded-lg">
                    <div className="flex items-center gap-3 p-3 bg-muted">
                      <HelpCircle className="w-5 h-5 text-warning" />
                      <span className="font-medium">Perguntas sem grupo</span>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2.5 py-0.5 text-xs bg-warning/15 text-[hsl(32_95%_34%)]">{getItensSemGrupo().length}</span>
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
                    <FolderOpen className="w-16 h-16 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-muted-foreground font-medium">Nenhum grupo ou pergunta cadastrada</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">Comece criando um grupo para organizar suas perguntas</p>
                    <button onClick={handleAbrirModalNovoGrupo} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 mt-4">
                      <FolderOpen className="w-4 h-4" /> Criar Primeiro Grupo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
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
            <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 hover:bg-muted" onClick={() => { setShowGrupoModal(false); resetGrupoForm(); }}>Cancelar</button>
            <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSalvarGrupo} disabled={saving || !grupoForm.nome}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : 'Salvar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-col">
            <label className="flex items-center justify-between gap-2 py-1"><span className="text-sm font-medium text-foreground">Nome do Grupo *</span></label>
            <input
              type="text"
              placeholder="Ex: ESTRUTURA"
              className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
              value={grupoForm.nome}
              onChange={(e) => setGrupoForm({ ...grupoForm, nome: e.target.value })}
            />
          </div>
          <div className="flex flex-col">
            <label className="flex items-center justify-between gap-2 py-1"><span className="text-sm font-medium text-foreground">Descrição</span></label>
            <textarea
              className="min-h-[80px] px-3 py-2 rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
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
            <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 hover:bg-muted sm:!h-10 sm:!px-4 w-full sm:w-auto" onClick={() => { setShowItemModal(false); resetItemForm(); }}>Cancelar</button>
            <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90 sm:!h-10 sm:!px-4 w-full sm:w-auto" onClick={handleSalvarItem} disabled={saving || !itemForm.pergunta}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : editingItem ? 'Salvar Alterações' : 'Adicionar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
              {/* Grupo e Seção */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col">
                  <label className="flex items-center justify-between gap-2 py-1"><span className="font-medium text-foreground text-xs sm:text-sm">Grupo</span></label>
                  <select
                    className="rounded-md border border-input bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-9 px-2.5 text-xs sm:!h-10 sm:!px-3"
                    value={itemForm.grupoId || ''}
                    onChange={(e) => setItemForm({ ...itemForm, grupoId: e.target.value || undefined })}
                  >
                    <option value="">Sem grupo</option>
                    {template?.grupos?.map((g) => (
                      <option key={g.id} value={g.id}>{g.nome}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="flex items-center justify-between gap-2 py-1"><span className="font-medium text-foreground text-xs sm:text-sm">Seção (opcional)</span></label>
                  <input
                    type="text"
                    placeholder="Ex: ÁREA DE LAVAGEM"
                    className="rounded-md border border-input bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-9 px-2.5 text-xs sm:!h-10 sm:!px-3"
                    value={itemForm.secao}
                    onChange={(e) => setItemForm({ ...itemForm, secao: e.target.value })}
                  />
                </div>
              </div>

              {/* Pergunta */}
              <div className="flex flex-col">
                <label className="flex items-center justify-between gap-2 py-1"><span className="font-medium text-foreground text-xs sm:text-sm">Pergunta *</span></label>
                <textarea
                  placeholder="Ex: As paredes, piso e teto estão em boas condições?"
                  className="min-h-[80px] px-3 py-2 rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                  rows={2}
                  value={itemForm.pergunta}
                  onChange={(e) => setItemForm({ ...itemForm, pergunta: e.target.value })}
                />
              </div>

              {/* Categoria, Criticidade, Peso e Obrigatório */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                <div className="flex flex-col">
                  <label className="flex items-center justify-between gap-2 py-1"><span className="font-medium text-foreground text-xs sm:text-sm">Categoria</span></label>
                  <select
                    className="rounded-md border border-input bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-9 px-2.5 text-xs sm:!h-10 sm:!px-3"
                    value={itemForm.categoria}
                    onChange={(e) => setItemForm({ ...itemForm, categoria: e.target.value as CategoriaItem })}
                  >
                    {Object.entries(CATEGORIA_ITEM_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="flex items-center justify-between gap-2 py-1">
                    <span className="font-medium text-foreground text-xs sm:text-sm flex items-center gap-1">
                      Criticidade
                      <Tooltip content="Define o grau de impacto desta pergunta na avaliação. Perguntas com criticidade alta ou crítica têm maior relevância no resultado final e podem gerar alertas automáticos de não conformidade.">
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/70 cursor-help" />
                      </Tooltip>
                    </span>
                  </label>
                  <select
                    className="rounded-md border border-input bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-9 px-2.5 text-xs sm:!h-10 sm:!px-3"
                    value={itemForm.criticidade}
                    onChange={(e) => setItemForm({ ...itemForm, criticidade: e.target.value as CriticidadeItem })}
                  >
                    {Object.entries(CRITICIDADE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                {itemForm.tipoRespostaCustomizada !== TipoRespostaCustomizada.TEXTO && (
                  <div className="flex flex-col">
                    <label className="flex items-center justify-between gap-2 py-1">
                      <span className="font-medium text-foreground text-xs sm:text-sm flex items-center gap-1">
                        Peso
                        <Tooltip content="Multiplicador aplicado à pontuação desta pergunta. Um peso maior aumenta a influência desta pergunta no cálculo da nota final da auditoria. Ex: peso 2 dobra o valor da pontuação obtida.">
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/70 cursor-help" />
                        </Tooltip>
                      </span>
                    </label>
                    <input
                      type="number"
                      min="-10"
                      max="10"
                      className="rounded-md border border-input bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-9 px-2.5 text-xs sm:!h-10 sm:!px-3"
                      value={itemForm.peso}
                      onChange={(e) => {
                        const v = e.target.value === '' ? 1 : parseInt(e.target.value, 10);
                        setItemForm({ ...itemForm, peso: Number.isNaN(v) ? 1 : v });
                      }}
                    />
                  </div>
                )}
                <div className="flex flex-col justify-end">
                  <label className="flex items-center justify-between gap-2 py-1 cursor-pointer">
                    <span className="font-medium text-foreground text-xs sm:text-sm">Pergunta Obrigatória</span>
                    <input
                      type="checkbox"
                      className="relative shrink-0 cursor-pointer appearance-none rounded-full bg-muted-foreground/30 transition-colors checked:bg-primary before:absolute before:left-0.5 before:top-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform disabled:opacity-50 h-4 w-7 before:h-3 before:w-3 checked:before:translate-x-3 sm:h-5 sm:w-9 sm:before:h-4 sm:before:w-4 sm:checked:before:translate-x-4"
                      checked={itemForm.obrigatorio}
                      onChange={(e) => setItemForm({ ...itemForm, obrigatorio: e.target.checked })}
                    />
                  </label>
                </div>
              </div>

              {/* Legislação */}
              <div className="flex flex-col">
                <label className="flex items-center justify-between gap-2 py-1">
                  <span className="font-medium text-foreground text-xs sm:text-sm flex items-center gap-1">
                    Legislação
                    <Tooltip content="Normas cadastradas que fundamentam esta pergunta. Aparecem para o auditor como base legal e orientam a análise das não conformidades.">
                      <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/70 cursor-help" />
                    </Tooltip>
                  </span>
                </label>
                <SeletorLegislacoes
                  valor={itemForm.legislacaoIds ?? []}
                  onChange={(ids) => setItemForm({ ...itemForm, legislacaoIds: ids, legislacaoAlterada: true })}
                  legislacoesConhecidas={itemForm.legislacoesConhecidas}
                  referenciaAnterior={itemForm.referenciaAnterior}
                />
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border my-2 sm:text-sm">Opções de Resposta</div>

              {/* Tipo de Resposta Customizada */}
              <div className="flex flex-col">
                <label className="flex items-center justify-between gap-2 py-1">
                  <span className="font-medium text-foreground text-xs sm:text-sm">Tipo de Resposta</span>
                </label>
                <select
                  className="rounded-md border border-input bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-9 px-2.5 text-xs sm:!h-10 sm:!px-3"
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
                <label className="flex items-center justify-between gap-2 py-0.5">
                  <span className="text-xs text-muted-foreground">
                    {itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT && 'Configure as opções abaixo'}
                    {itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO && 'Campo de texto livre (não pontua)'}
                    {itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.NUMERO && 'Campo numérico'}
                    {itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.DATA && 'Seletor de data'}
                    {!itemForm.tipoRespostaCustomizada && 'Use botões de resposta padrão'}
                  </span>
                </label>
              </div>

              {/* Toggle Respostas Personalizadas */}
              {!itemForm.tipoRespostaCustomizada && (
                <div className="flex flex-col bg-muted rounded-lg p-3">
                  <label className="flex items-center cursor-pointer justify-start gap-3 py-0">
                    <input
                      type="checkbox"
                      className="relative shrink-0 cursor-pointer appearance-none rounded-full bg-muted-foreground/30 transition-colors checked:bg-primary before:absolute before:left-0.5 before:top-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform disabled:opacity-50 h-4 w-7 before:h-3 before:w-3 checked:before:translate-x-3"
                      checked={itemForm.usarRespostasPersonalizadas}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setItemForm({
                          ...itemForm,
                          usarRespostasPersonalizadas: checked,
                          opcoesRespostaConfig: checked
                            ? (itemForm.opcoesRespostaConfig || []).filter((c) =>
                                itemForm.opcoesResposta?.includes(c.valor),
                              )
                            : RESPOSTAS_PADRAO.map((r) => ({
                                valor: r.valor,
                                fotoObrigatoria: false,
                                observacaoObrigatoria: false,
                              })),
                        });
                      }}
                    />
                    <div>
                      <span className="font-medium text-foreground text-xs sm:text-sm">Respostas personalizadas</span>
                      <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">Padrão: Conforme, Não Conforme, Não Aplicável, Não Avaliado</p>
                    </div>
                  </label>
                </div>
              )}

              {/* Respostas Personalizadas */}
              {itemForm.usarRespostasPersonalizadas && (
                <div className="space-y-3 bg-muted/50 rounded-lg p-3 sm:p-4">
                  <label className="flex items-center justify-between gap-2 py-0"><span className="font-medium text-foreground text-xs sm:text-sm">Opções de Resposta</span></label>
                  {itemForm.opcoesResposta && itemForm.opcoesResposta.length > 0 && (
                    <div className="space-y-2">
                      {itemForm.opcoesResposta.length > 1 && (
                        <div className="flex items-center justify-end gap-2">
                          <Tooltip content="Foto obrigatória em todas">
                            <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1 cursor-pointer transition-colors text-xs ${
                              (itemForm.opcoesRespostaConfig || []).every((c) => c.fotoObrigatoria) ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted'
                            }`}>
                              <Camera className={`w-3 h-3 flex-shrink-0 ${(itemForm.opcoesRespostaConfig || []).every((c) => c.fotoObrigatoria) ? 'text-primary' : 'text-muted-foreground/70'}`} />
                              <span className="hidden sm:inline">Todas</span>
                              <input
                                type="checkbox"
                                className="h-3 w-3 shrink-0 cursor-pointer rounded border-input accent-[hsl(175_100%_36%)]"
                                checked={(itemForm.opcoesRespostaConfig || []).length > 0 && (itemForm.opcoesRespostaConfig || []).every((c) => c.fotoObrigatoria)}
                                onChange={(e) => handleToggleTodasOpcoes('fotoObrigatoria', e.target.checked)}
                              />
                            </label>
                          </Tooltip>
                          <Tooltip content="Observação obrigatória em todas">
                            <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1 cursor-pointer transition-colors text-xs ${
                              (itemForm.opcoesRespostaConfig || []).every((c) => c.observacaoObrigatoria) ? 'bg-info/10 ring-1 ring-info/30' : 'bg-muted'
                            }`}>
                              <MessageSquare className={`w-3 h-3 flex-shrink-0 ${(itemForm.opcoesRespostaConfig || []).every((c) => c.observacaoObrigatoria) ? 'text-info' : 'text-muted-foreground/70'}`} />
                              <span className="hidden sm:inline">Todas</span>
                              <input
                                type="checkbox"
                                className="h-3 w-3 shrink-0 cursor-pointer rounded border-input accent-[hsl(175_100%_36%)]"
                                checked={(itemForm.opcoesRespostaConfig || []).length > 0 && (itemForm.opcoesRespostaConfig || []).every((c) => c.observacaoObrigatoria)}
                                onChange={(e) => handleToggleTodasOpcoes('observacaoObrigatoria', e.target.checked)}
                              />
                            </label>
                          </Tooltip>
                        </div>
                      )}
                      {itemForm.opcoesResposta.map((opcao, idx) => {
                        const config = itemForm.opcoesRespostaConfig?.find((c) => c.valor === opcao);
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
                          <div key={idx} className="bg-card rounded-lg p-2.5 sm:p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2.5 py-0.5 text-xs text-primary border border-border bg-transparent sm:text-sm">{opcao}</span>
                              <div className="flex items-center gap-0.5">
                                <button
                                  onClick={() => handleDuplicarResposta(opcao)}
                                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-7 w-7 px-0 rounded-full hover:bg-muted"
                                  title="Duplicar resposta"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleRemoverOpcaoResposta(opcao)}
                                  className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-7 w-7 px-0 rounded-full hover:bg-muted text-destructive"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1.5" title="Pontuação">
                                <Star className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                                <input
                                  type="number"
                                  min={-10}
                                  max={10}
                                  className="rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-7 text-xs border-transparent bg-transparent w-full p-0 text-center font-medium"
                                  placeholder="—"
                                  value={pontuacaoExibida}
                                  onChange={(e) => {
                                    const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                    handleAtualizarOpcaoConfig(opcao, 'pontuacao', v === null || Number.isNaN(v) ? null : v);
                                  }}
                                />
                              </div>
                              <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${config?.fotoObrigatoria ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted'}`} title="Foto obrigatória">
                                <Camera className={`w-3.5 h-3.5 flex-shrink-0 ${config?.fotoObrigatoria ? 'text-primary' : 'text-muted-foreground/70'}`} />
                                <span className="text-xs truncate hidden sm:inline">Foto</span>
                                <input
                                  type="checkbox"
                                  className="h-3 w-3 shrink-0 cursor-pointer rounded border-input accent-[hsl(175_100%_36%)] ml-auto"
                                  checked={config?.fotoObrigatoria || false}
                                  onChange={(e) => handleAtualizarOpcaoConfig(opcao, 'fotoObrigatoria', e.target.checked)}
                                />
                              </label>
                              <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${config?.observacaoObrigatoria ? 'bg-info/10 ring-1 ring-info/30' : 'bg-muted'}`} title="Observação obrigatória">
                                <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${config?.observacaoObrigatoria ? 'text-info' : 'text-muted-foreground/70'}`} />
                                <span className="text-xs truncate hidden sm:inline">Obs.</span>
                                <input
                                  type="checkbox"
                                  className="h-3 w-3 shrink-0 cursor-pointer rounded border-input accent-[hsl(175_100%_36%)] ml-auto"
                                  checked={config?.observacaoObrigatoria || false}
                                  onChange={(e) => handleAtualizarOpcaoConfig(opcao, 'observacaoObrigatoria', e.target.checked)}
                                />
                              </label>
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
                      className="rounded-md border border-input bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-9 px-2.5 text-xs flex-1"
                      value={novaOpcaoResposta}
                      onChange={(e) => setNovaOpcaoResposta(e.target.value)}
                      onKeyPress={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAdicionarOpcaoResposta(); }}}
                    />
                    <button type="button" onClick={handleAdicionarOpcaoResposta} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 bg-info text-white hover:bg-info/90" disabled={!novaOpcaoResposta.trim()}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Sugestões:</span>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {RESPOSTAS_PERSONALIZADAS_SUGESTOES.filter((s) => !itemForm.opcoesResposta?.includes(s)).map((sugestao) => (
                        <button key={sugestao} type="button" onClick={() => handleAdicionarSugestao(sugestao)} className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11px] border border-border bg-transparent sm:!px-2.5 sm:!py-0.5 sm:!text-xs text-foreground font-bold hover:!bg-primary/12 hover:!text-white cursor-pointer transition-colors sm:px-3 py-1">
                          + {sugestao}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Respostas Padrão */}
              {!itemForm.usarRespostasPersonalizadas && (
                <div className="bg-muted/50 rounded-lg p-3 sm:p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Configuração das respostas padrão:</span>
                    <div className="flex items-center gap-2">
                      <Tooltip content="Foto obrigatória em todas">
                        <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1 cursor-pointer transition-colors text-xs ${
                          RESPOSTAS_PADRAO.every((r) => (itemForm.opcoesRespostaConfig || []).find((c) => c.valor === r.valor)?.fotoObrigatoria) ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted'
                        }`}>
                          <Camera className={`w-3 h-3 flex-shrink-0 ${RESPOSTAS_PADRAO.every((r) => (itemForm.opcoesRespostaConfig || []).find((c) => c.valor === r.valor)?.fotoObrigatoria) ? 'text-primary' : 'text-muted-foreground/70'}`} />
                          <span className="hidden sm:inline">Todas</span>
                          <input
                            type="checkbox"
                            className="h-3 w-3 shrink-0 cursor-pointer rounded border-input accent-[hsl(175_100%_36%)]"
                            checked={RESPOSTAS_PADRAO.every((r) => (itemForm.opcoesRespostaConfig || []).find((c) => c.valor === r.valor)?.fotoObrigatoria)}
                            onChange={(e) => handleToggleTodasOpcoes('fotoObrigatoria', e.target.checked)}
                          />
                        </label>
                      </Tooltip>
                      <Tooltip content="Observação obrigatória em todas">
                        <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1 cursor-pointer transition-colors text-xs ${
                          RESPOSTAS_PADRAO.every((r) => (itemForm.opcoesRespostaConfig || []).find((c) => c.valor === r.valor)?.observacaoObrigatoria) ? 'bg-info/10 ring-1 ring-info/30' : 'bg-muted'
                        }`}>
                          <MessageSquare className={`w-3 h-3 flex-shrink-0 ${RESPOSTAS_PADRAO.every((r) => (itemForm.opcoesRespostaConfig || []).find((c) => c.valor === r.valor)?.observacaoObrigatoria) ? 'text-info' : 'text-muted-foreground/70'}`} />
                          <span className="hidden sm:inline">Todas</span>
                          <input
                            type="checkbox"
                            className="h-3 w-3 shrink-0 cursor-pointer rounded border-input accent-[hsl(175_100%_36%)]"
                            checked={RESPOSTAS_PADRAO.every((r) => (itemForm.opcoesRespostaConfig || []).find((c) => c.valor === r.valor)?.observacaoObrigatoria)}
                            onChange={(e) => handleToggleTodasOpcoes('observacaoObrigatoria', e.target.checked)}
                          />
                        </label>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="space-y-2 mt-2">
                    {RESPOSTAS_PADRAO.map((resp) => {
                      const config = itemForm.opcoesRespostaConfig?.find((c) => c.valor === resp.valor);
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
                        <div key={resp.valor} className="bg-card rounded-lg p-2.5 sm:p-3">
                          <div className="flex items-center justify-between mb-2 sm:mb-0 sm:float-left sm:mr-3">
                            <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2.5 py-0.5 text-xs bg-muted text-muted-foreground sm:text-sm">{resp.label}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:justify-end sm:gap-3">
                            <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1.5" title="Pontuação">
                              <Star className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                              <input
                                type="number"
                                min={-10}
                                max={10}
                                className="rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-7 text-xs border-transparent bg-transparent w-full sm:w-16 p-0 text-center font-medium"
                                placeholder="—"
                                value={pontuacaoExibida}
                                onChange={(e) => {
                                  const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                                  handleAtualizarOpcaoConfig(resp.valor, 'pontuacao', v === null || Number.isNaN(v) ? null : v);
                                }}
                              />
                            </div>
                            <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${config?.fotoObrigatoria ? 'bg-primary/10 ring-1 ring-primary/30' : 'bg-muted'}`} title="Foto obrigatória">
                              <Camera className={`w-3.5 h-3.5 flex-shrink-0 ${config?.fotoObrigatoria ? 'text-primary' : 'text-muted-foreground/70'}`} />
                              <span className="text-xs truncate hidden sm:inline">Foto</span>
                              <input
                                type="checkbox"
                                className="h-3 w-3 shrink-0 cursor-pointer rounded border-input accent-[hsl(175_100%_36%)] ml-auto"
                                checked={config?.fotoObrigatoria || false}
                                onChange={(e) => handleAtualizarOpcaoConfig(resp.valor, 'fotoObrigatoria', e.target.checked)}
                              />
                            </label>
                            <label className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${config?.observacaoObrigatoria ? 'bg-info/10 ring-1 ring-info/30' : 'bg-muted'}`} title="Observação obrigatória">
                              <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${config?.observacaoObrigatoria ? 'text-info' : 'text-muted-foreground/70'}`} />
                              <span className="text-xs truncate hidden sm:inline">Obs.</span>
                              <input
                                type="checkbox"
                                className="h-3 w-3 shrink-0 cursor-pointer rounded border-input accent-[hsl(175_100%_36%)] ml-auto"
                                checked={config?.observacaoObrigatoria || false}
                                onChange={(e) => handleAtualizarOpcaoConfig(resp.valor, 'observacaoObrigatoria', e.target.checked)}
                              />
                            </label>
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

'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { AppLayout, Tooltip } from '@/components';
import {
  checklistService,
  ChecklistTemplate,
  TemplateItem,
  ChecklistGrupo,
  TipoAtividade,
  CategoriaItem,
  CriticidadeItem,
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
}

function SortableItem({ item, index, onEdit, onRemove }: SortableItemProps) {
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
      className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-base-100 rounded-lg border border-base-200 group hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => onEdit(item)}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-base-content/40 hover:text-base-content/60 transition-colors flex-shrink-0 mt-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-4 h-4 sm:w-5 sm:h-5" />
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
      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
          className="btn btn-ghost btn-xs text-error p-1 sm:p-2"
        >
          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </button>
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
      router.push('/templates');
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
      router.push('/templates');
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

  const handleRemoverGrupo = async (grupoId: string) => {
    if (!confirm('Tem certeza que deseja remover este grupo? Os itens serão desvinculados.')) return;
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
    setItemForm({
      id: item.id,
      pergunta: item.pergunta,
      categoria: item.categoria,
      criticidade: item.criticidade,
      peso: item.peso,
      legislacaoReferencia: item.legislacaoReferencia || '',
      artigo: item.artigo || '',
      obrigatorio: item.obrigatorio,
      opcoesResposta: item.opcoesResposta || [],
      usarRespostasPersonalizadas: item.usarRespostasPersonalizadas || false,
      tipoRespostaCustomizada: item.tipoRespostaCustomizada,
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
        peso: itemForm.peso,
        legislacaoReferencia: itemForm.legislacaoReferencia,
        artigo: itemForm.artigo,
        obrigatorio: itemForm.obrigatorio,
        opcoesResposta: itemForm.usarRespostasPersonalizadas && !itemForm.tipoRespostaCustomizada ? itemForm.opcoesResposta : (itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT ? itemForm.opcoesResposta : undefined),
        usarRespostasPersonalizadas: itemForm.usarRespostasPersonalizadas,
        tipoRespostaCustomizada: itemForm.tipoRespostaCustomizada,
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

  const handleRemoverItem = async (itemId: string) => {
    if (!confirm('Tem certeza que deseja remover este item?')) return;
    try {
      await checklistService.removerItem(itemId);
      toastService.success('Item removido com sucesso!');
      setTemplate((prevTemplate) => {
        if (!prevTemplate) return prevTemplate;
        return {
          ...prevTemplate,
          itens: (prevTemplate.itens || []).filter((item) => item.id !== itemId),
        };
      });
    } catch (error) {
      // Erro já é tratado pelo interceptor
    }
  };

  const handleAdicionarOpcaoResposta = () => {
    if (!novaOpcaoResposta.trim()) return;
    if (itemForm.opcoesResposta?.includes(novaOpcaoResposta.trim())) return;
    setItemForm({
      ...itemForm,
      opcoesResposta: [...(itemForm.opcoesResposta || []), novaOpcaoResposta.trim()],
    });
    setNovaOpcaoResposta('');
  };

  const handleRemoverOpcaoResposta = (opcao: string) => {
    setItemForm({
      ...itemForm,
      opcoesResposta: (itemForm.opcoesResposta || []).filter((o) => o !== opcao),
    });
  };

  const handleAdicionarSugestao = (sugestao: string) => {
    if (itemForm.opcoesResposta?.includes(sugestao)) return;
    setItemForm({
      ...itemForm,
      opcoesResposta: [...(itemForm.opcoesResposta || []), sugestao],
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
          <Link href="/templates" className="btn btn-ghost btn-sm btn-circle flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-base-content truncate">Editar Checklist</h1>
            <p className="text-xs sm:text-sm text-base-content/60 truncate">{template?.nome}</p>
          </div>
          <button onClick={handleSalvar} disabled={saving} className="btn btn-primary btn-sm gap-1 flex-shrink-0">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">Salvar</span>
          </button>
        </div>
      </div>

      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-4xl mx-auto pb-24">
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
                <div key={grupo.id} className="border border-base-300 rounded-lg overflow-hidden">
                  {/* Header do Grupo */}
                  <div
                    className="flex items-start sm:items-center gap-2 sm:gap-3 p-3 bg-base-200 cursor-pointer hover:bg-base-300 transition-colors"
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
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAbrirModalEditarGrupo(grupo); }}
                          className="btn btn-ghost btn-xs p-1 sm:p-2"
                        >
                          <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoverGrupo(grupo.id); }}
                          className="btn btn-ghost btn-xs text-error p-1 sm:p-2"
                        >
                          <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>
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
                                        <SortableItem
                                          key={item.id}
                                          item={item}
                                          index={globalIndex}
                                          onEdit={handleAbrirModalEditarItem}
                                          onRemove={handleRemoverItem}
                                        />
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
                <div className="border border-base-300 rounded-lg overflow-hidden">
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
                            <SortableItem
                              key={item.id}
                              item={item}
                              index={idx}
                              onEdit={handleAbrirModalEditarItem}
                              onRemove={handleRemoverItem}
                            />
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

      {/* Modal Grupo */}
      {showGrupoModal && (
        <div className="modal modal-open z-50">
          <div 
            className="modal-box max-w-md w-full mx-4 sm:mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-4">{editingGrupo ? 'Editar Grupo' : 'Novo Grupo'}</h3>
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
            <div className="modal-action flex-col sm:flex-row gap-2">
              <button className="btn btn-ghost w-full sm:w-auto" onClick={() => { setShowGrupoModal(false); resetGrupoForm(); }}>Cancelar</button>
              <button className="btn btn-primary w-full sm:w-auto" onClick={handleSalvarGrupo} disabled={saving || !grupoForm.nome}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : 'Salvar'}
              </button>
            </div>
          </div>
          <div 
            className="modal-backdrop" 
            onClick={(e) => {
              // Não fecha ao clicar fora - removido para evitar perda de dados
              e.stopPropagation();
            }}
          ></div>
        </div>
      )}

      {/* Modal Item */}
      {showItemModal && (
        <div className="modal modal-open z-50">
          <div className="modal-box max-w-2xl w-full mx-4 sm:mx-auto max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4">{editingItem ? 'Editar Pergunta' : 'Nova Pergunta'}</h3>
            <div className="space-y-4">
              {/* Grupo e Seção */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label"><span className="label-text">Grupo</span></label>
                  <select
                    className="select select-bordered"
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
                  <label className="label"><span className="label-text">Seção (opcional)</span></label>
                  <input
                    type="text"
                    placeholder="Ex: ÁREA DE LAVAGEM"
                    className="input input-bordered"
                    value={itemForm.secao}
                    onChange={(e) => setItemForm({ ...itemForm, secao: e.target.value })}
                  />
                </div>
              </div>

              {/* Pergunta */}
              <div className="form-control">
                <label className="label"><span className="label-text">Pergunta *</span></label>
                <textarea
                  placeholder="Ex: As paredes, piso e teto estão em boas condições?"
                  className="textarea textarea-bordered"
                  rows={3}
                  value={itemForm.pergunta}
                  onChange={(e) => setItemForm({ ...itemForm, pergunta: e.target.value })}
                />
              </div>

              {/* Categoria e Criticidade */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label"><span className="label-text">Categoria</span></label>
                  <select
                    className="select select-bordered"
                    value={itemForm.categoria}
                    onChange={(e) => setItemForm({ ...itemForm, categoria: e.target.value as CategoriaItem })}
                  >
                    {Object.entries(CATEGORIA_ITEM_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Criticidade</span></label>
                  <select
                    className="select select-bordered"
                    value={itemForm.criticidade}
                    onChange={(e) => setItemForm({ ...itemForm, criticidade: e.target.value as CriticidadeItem })}
                  >
                    {Object.entries(CRITICIDADE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Peso e Obrigatório */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label"><span className="label-text">Peso</span></label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="input input-bordered"
                    value={itemForm.peso}
                    onChange={(e) => setItemForm({ ...itemForm, peso: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">Obrigatório</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={itemForm.obrigatorio}
                      onChange={(e) => setItemForm({ ...itemForm, obrigatorio: e.target.checked })}
                    />
                  </label>
                </div>
              </div>

              {/* Legislação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label"><span className="label-text">Legislação</span></label>
                  <input
                    type="text"
                    placeholder="Ex: RDC 216/2004"
                    className="input input-bordered"
                    value={itemForm.legislacaoReferencia}
                    onChange={(e) => setItemForm({ ...itemForm, legislacaoReferencia: e.target.value })}
                  />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Artigo/Inciso</span></label>
                  <input
                    type="text"
                    placeholder="Ex: Art. 4.1.3"
                    className="input input-bordered"
                    value={itemForm.artigo}
                    onChange={(e) => setItemForm({ ...itemForm, artigo: e.target.value })}
                  />
                </div>
              </div>

              <div className="divider">Opções de Resposta</div>

              {/* Tipo de Resposta Customizada */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Tipo de Resposta</span>
                </label>
                <select
                  className="select select-bordered"
                  value={itemForm.tipoRespostaCustomizada || ''}
                  onChange={(e) => {
                    const valor = e.target.value ? (e.target.value as TipoRespostaCustomizada) : undefined;
                    setItemForm({
                      ...itemForm,
                      tipoRespostaCustomizada: valor,
                      usarRespostasPersonalizadas: valor !== undefined,
                    });
                  }}
                >
                  <option value="">Padrão (Botões: Conforme/Não Conforme/Não Aplicável)</option>
                  <option value={TipoRespostaCustomizada.TEXTO}>{TIPO_RESPOSTA_LABELS[TipoRespostaCustomizada.TEXTO]}</option>
                  <option value={TipoRespostaCustomizada.NUMERO}>{TIPO_RESPOSTA_LABELS[TipoRespostaCustomizada.NUMERO]}</option>
                  <option value={TipoRespostaCustomizada.DATA}>{TIPO_RESPOSTA_LABELS[TipoRespostaCustomizada.DATA]}</option>
                  <option value={TipoRespostaCustomizada.SELECT}>{TIPO_RESPOSTA_LABELS[TipoRespostaCustomizada.SELECT]}</option>
                </select>
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    {itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT && 'Configure as opções abaixo'}
                    {itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO && 'Campo de texto livre'}
                    {itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.NUMERO && 'Campo numérico'}
                    {itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.DATA && 'Seletor de data'}
                    {!itemForm.tipoRespostaCustomizada && 'Use botões de resposta padrão'}
                  </span>
                </label>
              </div>

              {/* Toggle Respostas Personalizadas (apenas para botões) */}
              {!itemForm.tipoRespostaCustomizada && (
                <div className="form-control bg-base-200 rounded-lg p-4">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input
                      type="checkbox"
                      className="toggle toggle-secondary"
                      checked={itemForm.usarRespostasPersonalizadas}
                      onChange={(e) => setItemForm({ ...itemForm, usarRespostasPersonalizadas: e.target.checked })}
                    />
                    <div>
                      <span className="label-text font-medium">Usar respostas personalizadas</span>
                      <p className="text-xs text-base-content/60 mt-0.5">Padrão: Conforme, Não Conforme, Não Aplicável, Não Avaliado</p>
                    </div>
                  </label>
                </div>
              )}

              {/* Respostas Personalizadas (botões ou opções para select) */}
              {/* Mostra opções apenas para SELECT ou quando usarRespostasPersonalizadas está ativo sem tipo customizado */}
              {((itemForm.usarRespostasPersonalizadas && !itemForm.tipoRespostaCustomizada) || itemForm.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT) && (
                <div className="space-y-3 bg-base-200/50 rounded-lg p-4">
                  <label className="label"><span className="label-text font-medium">Opções de Resposta</span></label>
                  {itemForm.opcoesResposta && itemForm.opcoesResposta.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {itemForm.opcoesResposta.map((opcao, idx) => (
                        <div key={idx} className="badge badge-lg gap-1 pr-1 border-2 border-primary">
                          {opcao}
                          <button onClick={() => handleRemoverOpcaoResposta(opcao)} className="btn btn-ghost btn-xs btn-circle">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
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
                    <div className="flex flex-wrap gap-2 mt-2">
                      {RESPOSTAS_PERSONALIZADAS_SUGESTOES.filter((s) => !itemForm.opcoesResposta?.includes(s)).map((sugestao) => (
                        <button key={sugestao} type="button" onClick={() => handleAdicionarSugestao(sugestao)} className="badge badge-outline badge-md text-base-content font-bold hover:badge-primary hover:!text-white cursor-pointer transition-colors px-4 py-2">
                          + {sugestao}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {!itemForm.usarRespostasPersonalizadas && (
                <div className="bg-base-200/50 rounded-lg p-4">
                  <span className="text-xs text-base-content/60">Respostas padrão:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {RESPOSTAS_PADRAO.map((resp) => (
                      <span key={resp.valor} className="badge badge-ghost">{resp.label}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-action flex-col sm:flex-row gap-2">
              <button className="btn btn-ghost w-full sm:w-auto" onClick={() => { setShowItemModal(false); resetItemForm(); }}>Cancelar</button>
              <button className="btn btn-primary w-full sm:w-auto" onClick={handleSalvarItem} disabled={saving || !itemForm.pergunta}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</> : editingItem ? 'Salvar Alterações' : 'Adicionar'}
              </button>
            </div>
          </div>
          <div 
            className="modal-backdrop" 
            onClick={(e) => {
              // Não fecha ao clicar fora - removido para evitar perda de dados
              e.stopPropagation();
            }}
          ></div>
        </div>
      )}
    </AppLayout>
  );
}

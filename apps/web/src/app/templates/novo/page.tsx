'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
import { AppLayout } from '@/components';
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
} from '@/lib/api';
import { toastService } from '@/lib/toast';

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
      className="flex items-start gap-3 p-3 bg-base-100 rounded-lg border border-base-200 group hover:border-primary/30 transition-colors cursor-pointer"
      onClick={() => onEdit(item)}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-base-content/40 hover:text-base-content/60 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-5 h-5" />
      </div>
      <span className="text-sm font-bold text-base-content/40 min-w-[24px]">{index + 1}.</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{item.pergunta}</p>
        <div className="flex flex-wrap items-center gap-1 mt-1">
          <span className="badge badge-ghost badge-xs">{CATEGORIA_ITEM_LABELS[item.categoria]}</span>
          <span className={`badge badge-xs ${getCriticidadeBadge(item.criticidade)}`}>
            {CRITICIDADE_LABELS[item.criticidade]}
          </span>
          {item.legislacaoReferencia && (
            <span className="text-xs text-base-content/50">{item.legislacaoReferencia}</span>
          )}
          {item.usarRespostasPersonalizadas && (
            <span className="badge badge-secondary badge-xs gap-1">
              <Settings className="w-3 h-3" />Pers.
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item.id);
          }}
          className="btn btn-ghost btn-xs text-error"
        >
          <Trash2 className="w-4 h-4" />
        </button>
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
    legislacaoReferencia: '',
    artigo: '',
    obrigatorio: true,
    opcoesResposta: [],
    usarRespostasPersonalizadas: false,
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
        peso: itemForm.peso,
        legislacaoReferencia: itemForm.legislacaoReferencia,
        artigo: itemForm.artigo,
        obrigatorio: itemForm.obrigatorio,
        opcoesResposta: itemForm.usarRespostasPersonalizadas ? itemForm.opcoesResposta : undefined,
        usarRespostasPersonalizadas: itemForm.usarRespostasPersonalizadas,
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

  return (
    <AppLayout>
      {/* Header */}
      <div className="bg-base-100 border-b border-base-300 px-4 lg:px-8 py-4 sticky top-16 z-30">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Link href="/templates" className="btn btn-ghost btn-sm btn-circle">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-base-content">Novo Checklist</h1>
            <p className="text-sm text-base-content/60">
              {templateCreated ? 'Adicione grupos e perguntas ao checklist' : 'Crie um novo checklist'}
            </p>
          </div>
          {templateCreated && (
            <button onClick={handleSalvar} disabled={saving} className="btn btn-primary btn-sm gap-1">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-4xl mx-auto pb-24">
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
                  disabled={templateCreated}
                />
              </div>
              <div className="form-control">
                <label className="label"><span className="label-text">Descrição</span></label>
                <textarea
                  className="textarea textarea-bordered"
                  rows={2}
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  disabled={templateCreated}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label"><span className="label-text">Tipo de Atividade</span></label>
                  <select
                    className="select select-bordered"
                    value={formData.tipoAtividade}
                    onChange={(e) => setFormData({ ...formData, tipoAtividade: e.target.value as TipoAtividade })}
                    disabled={templateCreated}
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
                    disabled={templateCreated}
                  />
                </div>
              </div>
              {!templateCreated && (
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleCriarTemplate}
                    disabled={saving || !formData.nome.trim()}
                    className="btn btn-primary gap-2"
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
            className="card bg-base-100 shadow-sm border border-base-300"
          >
            <div className="card-body">
              <div className="flex items-center justify-between">
                <h2 className="card-title text-base">
                  Grupos e Perguntas ({template?.grupos?.length || 0} grupos, {template?.itens?.filter(i => i.ativo !== false).length || 0} perguntas)
                </h2>
                <div className="flex gap-2">
                  <button onClick={handleAbrirModalNovoGrupo} className="btn btn-secondary btn-sm gap-1">
                    <FolderOpen className="w-4 h-4" />
                    Novo Grupo
                  </button>
                  <button onClick={() => handleAbrirModalNovoItem()} className="btn btn-primary btn-sm gap-1">
                    <Plus className="w-4 h-4" />
                    Nova Pergunta
                  </button>
                </div>
              </div>

              <div className="space-y-4 mt-4">
                {/* Grupos */}
                {template?.grupos?.map((grupo) => (
                  <div key={grupo.id} className="border border-base-300 rounded-lg overflow-hidden">
                    {/* Header do Grupo */}
                    <div
                      className="flex items-center gap-3 p-3 bg-base-200 cursor-pointer hover:bg-base-300 transition-colors"
                      onClick={() => toggleGrupoExpanded(grupo.id)}
                    >
                      <GripVertical className="w-4 h-4 text-base-content/40" />
                      <FolderOpen className="w-5 h-5 text-secondary" />
                      <div className="flex-1">
                        <p className="font-medium">{grupo.nome}</p>
                        {grupo.descricao && <p className="text-sm text-base-content/60">{grupo.descricao}</p>}
                      </div>
                      <span className="badge badge-ghost">{getItensPorGrupo(grupo.id).length} perguntas</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAbrirModalEditarGrupo(grupo); }}
                          className="btn btn-ghost btn-xs"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoverGrupo(grupo.id); }}
                          className="btn btn-ghost btn-xs text-error"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {expandedGrupos.has(grupo.id) ? (
                          <ChevronUp className="w-5 h-5 text-base-content/40" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-base-content/40" />
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
                    <div className="flex items-center gap-3 p-3 bg-base-200">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                      <span className="font-medium">Perguntas sem grupo</span>
                      <span className="badge badge-warning">{getItensSemGrupo().length}</span>
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
        )}
      </div>

      {/* Modal Grupo */}
      {showGrupoModal && (
        <div 
          className="modal modal-open"
          onClick={(e) => {
            // Não fecha ao clicar fora - removido para evitar perda de dados
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
          <div className="modal-box max-w-md">
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
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setShowGrupoModal(false); resetGrupoForm(); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSalvarGrupo} disabled={saving || !grupoForm.nome}>
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
        <div 
          className="modal modal-open"
          onClick={(e) => {
            // Não fecha ao clicar fora - removido para evitar perda de dados
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
          <div className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4">{editingItem ? 'Editar Pergunta' : 'Nova Pergunta'}</h3>
            <div className="space-y-4">
              {/* Grupo e Seção */}
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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

              {/* Toggle Respostas Personalizadas */}
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

              {/* Respostas Personalizadas */}
              {itemForm.usarRespostasPersonalizadas && (
                <div className="space-y-3 bg-base-200/50 rounded-lg p-4">
                  <label className="label"><span className="label-text font-medium">Opções de Resposta</span></label>
                  {itemForm.opcoesResposta && itemForm.opcoesResposta.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {itemForm.opcoesResposta.map((opcao, idx) => (
                        <div key={idx} className="badge badge-lg gap-1 pr-1">
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
                    <div className="flex flex-wrap gap-1 mt-1">
                      {RESPOSTAS_PERSONALIZADAS_SUGESTOES.filter((s) => !itemForm.opcoesResposta?.includes(s)).map((sugestao) => (
                        <button key={sugestao} type="button" onClick={() => handleAdicionarSugestao(sugestao)} className="badge badge-outline badge-sm hover:badge-secondary cursor-pointer">
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

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setShowItemModal(false); resetItemForm(); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleSalvarItem} disabled={saving || !itemForm.pergunta}>
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


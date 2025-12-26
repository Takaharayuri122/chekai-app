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
 * Página para editar um template existente com suporte a grupos e seções.
 */
export default function EditarTemplatePage() {
  const router = useRouter();
  const params = useParams();
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
    grupoId: undefined,
    secao: '',
  });
  const [novaOpcaoResposta, setNovaOpcaoResposta] = useState('');

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
    loadTemplate();
  }, [loadTemplate]);

  const handleSalvar = async () => {
    if (!formData.nome.trim()) {
      setErro('O nome do template é obrigatório');
      return;
    }
    setSaving(true);
    try {
      await checklistService.atualizarTemplate(templateId, formData);
      router.push('/templates');
    } catch {
      setErro('Erro ao salvar template');
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
        await checklistService.atualizarGrupo(editingGrupo.id, grupoForm);
      } else {
        await checklistService.adicionarGrupo(templateId, grupoForm);
      }
      await loadTemplate();
      setShowGrupoModal(false);
      resetGrupoForm();
    } catch {
      setErro('Erro ao salvar grupo');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoverGrupo = async (grupoId: string) => {
    if (!confirm('Tem certeza que deseja remover este grupo? Os itens serão desvinculados.')) return;
    try {
      await checklistService.removerGrupo(grupoId);
      await loadTemplate();
    } catch {
      setErro('Erro ao remover grupo');
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
        opcoesResposta: itemForm.usarRespostasPersonalizadas ? itemForm.opcoesResposta : undefined,
        usarRespostasPersonalizadas: itemForm.usarRespostasPersonalizadas,
        grupoId: itemForm.grupoId || undefined,
        secao: itemForm.secao || undefined,
      };
      if (editingItem) {
        await checklistService.atualizarItem(editingItem.id, dadosItem);
      } else {
        await checklistService.adicionarItem(templateId, dadosItem);
      }
      await loadTemplate();
      setShowItemModal(false);
      resetItemForm();
    } catch {
      setErro('Erro ao salvar item');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoverItem = async (itemId: string) => {
    if (!confirm('Tem certeza que deseja remover este item?')) return;
    try {
      await checklistService.removerItem(itemId);
      await loadTemplate();
    } catch {
      setErro('Erro ao remover item');
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

  const getCriticidadeBadge = (criticidade: CriticidadeItem) => {
    const colors: Record<CriticidadeItem, string> = {
      [CriticidadeItem.BAIXA]: 'badge-info',
      [CriticidadeItem.MEDIA]: 'badge-warning',
      [CriticidadeItem.ALTA]: 'badge-error',
      [CriticidadeItem.CRITICA]: 'badge-error badge-outline',
    };
    return colors[criticidade] || 'badge-ghost';
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
      <div className="bg-base-100 border-b border-base-300 px-4 lg:px-8 py-4 sticky top-16 z-30">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <Link href="/templates" className="btn btn-ghost btn-sm btn-circle">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-base-content">Editar Template</h1>
            <p className="text-sm text-base-content/60 truncate">{template?.nome}</p>
          </div>
          <button onClick={handleSalvar} disabled={saving} className="btn btn-primary btn-sm gap-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
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
            <h2 className="card-title text-base">Informações do Template</h2>
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
              <div className="grid grid-cols-2 gap-4">
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
                      {Object.entries(getItensPorSecao(getItensPorGrupo(grupo.id))).map(([secao, itens]) => (
                        <div key={secao || 'sem-secao'}>
                          {secao && (
                            <div className="flex items-center gap-2 py-2 mb-2 border-b border-base-200">
                              <span className="text-sm font-medium text-secondary">{secao}</span>
                            </div>
                          )}
                          {itens.sort((a, b) => a.ordem - b.ordem).map((item, idx) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-3 p-3 bg-base-100 rounded-lg border border-base-200 group hover:border-primary/30 transition-colors cursor-pointer"
                              onClick={() => handleAbrirModalEditarItem(item)}
                            >
                              <span className="text-sm font-bold text-base-content/40 min-w-[24px]">{idx + 1}.</span>
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
                                <button onClick={(e) => { e.stopPropagation(); handleRemoverItem(item.id); }} className="btn btn-ghost btn-xs text-error">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {itens.length === 0 && (
                            <p className="text-sm text-base-content/50 py-2">Nenhuma pergunta nesta seção</p>
                          )}
                        </div>
                      ))}
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
                    {getItensSemGrupo().map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 bg-base-100 rounded-lg border border-base-200 group hover:border-primary/30 transition-colors cursor-pointer"
                        onClick={() => handleAbrirModalEditarItem(item)}
                      >
                        <span className="text-sm font-bold text-base-content/40 min-w-[24px]">{idx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{item.pergunta}</p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            <span className="badge badge-ghost badge-xs">{CATEGORIA_ITEM_LABELS[item.categoria]}</span>
                            <span className={`badge badge-xs ${getCriticidadeBadge(item.criticidade)}`}>
                              {CRITICIDADE_LABELS[item.criticidade]}
                            </span>
                          </div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleRemoverItem(item.id); }} className="btn btn-ghost btn-xs text-error opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
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
        <div className="modal modal-open">
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
          <div className="modal-backdrop" onClick={() => { setShowGrupoModal(false); resetGrupoForm(); }}></div>
        </div>
      )}

      {/* Modal Item */}
      {showItemModal && (
        <div className="modal modal-open">
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
          <div className="modal-backdrop" onClick={() => { setShowItemModal(false); resetItemForm(); }}></div>
        </div>
      )}
    </AppLayout>
  );
}

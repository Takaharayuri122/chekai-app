'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FileText,
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
} from 'lucide-react';
import { AppLayout } from '@/components';
import {
  checklistService,
  ChecklistTemplate,
  TemplateItem,
  TipoAtividade,
  CategoriaItem,
  CriticidadeItem,
  TIPO_ATIVIDADE_LABELS,
  CATEGORIA_ITEM_LABELS,
  CRITICIDADE_LABELS,
  CriarTemplateItemRequest,
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
 * Página para editar um template existente.
 */
export default function EditarTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  const [template, setTemplate] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipoAtividade: TipoAtividade.OUTRO,
    versao: '1.0',
  });

  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<TemplateItem | null>(null);
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
    });
    setNovaOpcaoResposta('');
    setEditingItem(null);
  };

  const handleAbrirModalNovoItem = () => {
    resetItemForm();
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
      };
      if (editingItem) {
        await checklistService.atualizarItem(editingItem.id, dadosItem);
      } else {
        await checklistService.adicionarItem(templateId, dadosItem);
      }
      await loadTemplate();
      setShowItemModal(false);
      resetItemForm();
    } catch (err) {
      console.error('Erro ao salvar item:', err);
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
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <Link
            href="/templates"
            className="btn btn-ghost btn-sm btn-circle"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-base-content">
              Editar Template
            </h1>
            <p className="text-sm text-base-content/60 truncate">
              {template?.nome}
            </p>
          </div>
          <button
            onClick={handleSalvar}
            disabled={saving}
            className="btn btn-primary btn-sm gap-1"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Salvar
          </button>
        </div>
      </div>

      <div className="px-4 py-6 lg:px-8 space-y-6 max-w-3xl mx-auto pb-24">
        {/* Erro */}
        {erro && (
          <div className="alert alert-error">
            <span>{erro}</span>
            <button
              onClick={() => setErro('')}
              className="btn btn-ghost btn-sm"
            >
              ✕
            </button>
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
                <label className="label">
                  <span className="label-text">Nome *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Descrição</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  rows={2}
                  value={formData.descricao}
                  onChange={(e) =>
                    setFormData({ ...formData, descricao: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Tipo de Atividade</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={formData.tipoAtividade}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tipoAtividade: e.target.value as TipoAtividade,
                      })
                    }
                  >
                    {Object.entries(TIPO_ATIVIDADE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Versão</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={formData.versao}
                    onChange={(e) =>
                      setFormData({ ...formData, versao: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Itens do Checklist */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card bg-base-100 shadow-sm border border-base-300"
        >
          <div className="card-body">
            <div className="flex items-center justify-between">
              <h2 className="card-title text-base">
                Itens do Checklist ({template?.itens?.filter(i => i.ativo !== false).length || 0})
              </h2>
              <button
                onClick={handleAbrirModalNovoItem}
                className="btn btn-primary btn-sm gap-1"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
            </div>

            {!template?.itens || template.itens.filter(i => i.ativo !== false).length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-12 h-12 text-warning mx-auto mb-3" />
                <p className="text-base-content/60">
                  Nenhum item cadastrado
                </p>
                <p className="text-sm text-base-content/40 mt-1">
                  Adicione perguntas para formar o checklist
                </p>
              </div>
            ) : (
              <div className="space-y-2 mt-4">
                {template.itens
                  .filter(i => i.ativo !== false)
                  .sort((a, b) => a.ordem - b.ordem)
                  .map((item: TemplateItem, idx: number) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 p-3 bg-base-200/50 rounded-lg group hover:bg-base-200 transition-colors cursor-pointer"
                      onClick={() => handleAbrirModalEditarItem(item)}
                    >
                      <div className="flex items-center gap-2 text-base-content/40 pt-0.5">
                        <GripVertical className="w-4 h-4" />
                        <span className="text-sm font-bold min-w-[20px]">
                          {idx + 1}.
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-base-content">
                          {item.pergunta}
                        </p>
                        <div className="flex flex-wrap items-center gap-1 mt-1.5">
                          <span className="badge badge-ghost badge-xs">
                            {CATEGORIA_ITEM_LABELS[item.categoria] || item.categoria}
                          </span>
                          <span className={`badge badge-xs ${getCriticidadeBadge(item.criticidade)}`}>
                            {CRITICIDADE_LABELS[item.criticidade] || item.criticidade}
                          </span>
                          {item.legislacaoReferencia && (
                            <span className="text-xs text-base-content/50">
                              {item.legislacaoReferencia}
                            </span>
                          )}
                          {item.usarRespostasPersonalizadas && (
                            <span className="badge badge-secondary badge-xs gap-1">
                              <Settings className="w-3 h-3" />
                              Resp. Personalizadas
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAbrirModalEditarItem(item);
                          }}
                          className="btn btn-ghost btn-xs"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoverItem(item.id);
                          }}
                          className="btn btn-ghost btn-xs text-error"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Modal Novo/Editar Item */}
      {showItemModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4">
              {editingItem ? 'Editar Item' : 'Novo Item'}
            </h3>
            <div className="space-y-4">
              {/* Pergunta */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Pergunta *</span>
                </label>
                <textarea
                  placeholder="Ex: Os manipuladores utilizam EPIs adequados?"
                  className="textarea textarea-bordered"
                  rows={3}
                  value={itemForm.pergunta}
                  onChange={(e) =>
                    setItemForm({ ...itemForm, pergunta: e.target.value })
                  }
                />
              </div>

              {/* Categoria e Criticidade */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Categoria</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={itemForm.categoria}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        categoria: e.target.value as CategoriaItem,
                      })
                    }
                  >
                    {Object.entries(CATEGORIA_ITEM_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Criticidade</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={itemForm.criticidade}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        criticidade: e.target.value as CriticidadeItem,
                      })
                    }
                  >
                    {Object.entries(CRITICIDADE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Peso e Obrigatório */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Peso</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="input input-bordered"
                    value={itemForm.peso}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        peso: parseInt(e.target.value) || 1,
                      })
                    }
                  />
                </div>
                <div className="form-control">
                  <label className="label cursor-pointer">
                    <span className="label-text">Obrigatório</span>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={itemForm.obrigatorio}
                      onChange={(e) =>
                        setItemForm({
                          ...itemForm,
                          obrigatorio: e.target.checked,
                        })
                      }
                    />
                  </label>
                </div>
              </div>

              {/* Legislação */}
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Legislação</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: RDC 216/2004"
                    className="input input-bordered"
                    value={itemForm.legislacaoReferencia}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        legislacaoReferencia: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Artigo/Inciso</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Art. 4.1.3"
                    className="input input-bordered"
                    value={itemForm.artigo}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, artigo: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="divider">Opções de Resposta</div>

              {/* Toggle Respostas Personalizadas */}
              <div className="form-control bg-base-200 rounded-lg p-4">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="toggle toggle-secondary"
                    checked={itemForm.usarRespostasPersonalizadas}
                    onChange={(e) =>
                      setItemForm({
                        ...itemForm,
                        usarRespostasPersonalizadas: e.target.checked,
                      })
                    }
                  />
                  <div>
                    <span className="label-text font-medium">
                      Usar respostas personalizadas
                    </span>
                    <p className="text-xs text-base-content/60 mt-0.5">
                      Por padrão: Conforme, Não Conforme, Não Aplicável, Não Avaliado
                    </p>
                  </div>
                </label>
              </div>

              {/* Respostas Personalizadas */}
              {itemForm.usarRespostasPersonalizadas && (
                <div className="space-y-3 bg-base-200/50 rounded-lg p-4">
                  <label className="label">
                    <span className="label-text font-medium">Opções de Resposta</span>
                  </label>

                  {/* Lista de opções */}
                  {itemForm.opcoesResposta && itemForm.opcoesResposta.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {itemForm.opcoesResposta.map((opcao, idx) => (
                        <div
                          key={idx}
                          className="badge badge-lg gap-1 pr-1"
                        >
                          {opcao}
                          <button
                            onClick={() => handleRemoverOpcaoResposta(opcao)}
                            className="btn btn-ghost btn-xs btn-circle"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Adicionar nova opção */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nova opção de resposta"
                      className="input input-bordered input-sm flex-1"
                      value={novaOpcaoResposta}
                      onChange={(e) => setNovaOpcaoResposta(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAdicionarOpcaoResposta();
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleAdicionarOpcaoResposta}
                      className="btn btn-secondary btn-sm"
                      disabled={!novaOpcaoResposta.trim()}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Sugestões */}
                  <div>
                    <span className="text-xs text-base-content/60">Sugestões:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {RESPOSTAS_PERSONALIZADAS_SUGESTOES
                        .filter((s) => !itemForm.opcoesResposta?.includes(s))
                        .map((sugestao) => (
                          <button
                            key={sugestao}
                            type="button"
                            onClick={() => handleAdicionarSugestao(sugestao)}
                            className="badge badge-outline badge-sm hover:badge-secondary cursor-pointer"
                          >
                            + {sugestao}
                          </button>
                        ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Respostas Padrão (info) */}
              {!itemForm.usarRespostasPersonalizadas && (
                <div className="bg-base-200/50 rounded-lg p-4">
                  <span className="text-xs text-base-content/60">Respostas padrão:</span>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {RESPOSTAS_PADRAO.map((resp) => (
                      <span key={resp.valor} className="badge badge-ghost">
                        {resp.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowItemModal(false);
                  resetItemForm();
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSalvarItem}
                disabled={saving || !itemForm.pergunta}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : editingItem ? (
                  'Salvar Alterações'
                ) : (
                  'Adicionar'
                )}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => {
              setShowItemModal(false);
              resetItemForm();
            }}
          ></div>
        </div>
      )}
    </AppLayout>
  );
}

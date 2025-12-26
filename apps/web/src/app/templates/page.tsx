'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FileText,
  Plus,
  ChevronDown,
  ChevronUp,
  Tag,
  List,
  AlertTriangle,
  Loader2,
  Upload,
} from 'lucide-react';
import { AppLayout, PageHeader, EmptyState } from '@/components';
import {
  checklistService,
  ChecklistTemplate,
  TipoAtividade,
  TIPO_ATIVIDADE_LABELS,
  CategoriaItem,
  CriticidadeItem,
  CATEGORIA_ITEM_LABELS,
  CRITICIDADE_LABELS,
  CriarTemplateRequest,
  CriarTemplateItemRequest,
} from '@/lib/api';

/**
 * Página de listagem e gerenciamento de templates de checklist.
 */
export default function TemplatesPage() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [templateForm, setTemplateForm] = useState<CriarTemplateRequest>({
    nome: '',
    descricao: '',
    tipoAtividade: TipoAtividade.OUTRO,
    versao: '1.0',
  });

  const [itemForm, setItemForm] = useState<CriarTemplateItemRequest>({
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

  useEffect(() => {
    carregarTemplates();
  }, []);

  const carregarTemplates = async () => {
    try {
      const response = await checklistService.listarTemplates();
      setTemplates(response.items || []);
    } catch {
      // Erro silencioso
    } finally {
      setLoading(false);
    }
  };

  const handleCriarTemplate = async () => {
    if (!templateForm.nome) return;
    setSaving(true);
    try {
      const novoTemplate = await checklistService.criarTemplate(templateForm);
      setTemplates((prevTemplates) => [novoTemplate, ...prevTemplates]);
      setShowModal(false);
      setTemplateForm({
        nome: '',
        descricao: '',
        tipoAtividade: TipoAtividade.OUTRO,
        versao: '1.0',
      });
    } catch {
      // Erro silencioso
    } finally {
      setSaving(false);
    }
  };

  const handleAdicionarItem = async () => {
    if (!showItemModal || !itemForm.pergunta) return;
    setSaving(true);
    try {
      const dadosItem = {
        ...itemForm,
        opcoesResposta: itemForm.usarRespostasPersonalizadas ? itemForm.opcoesResposta : undefined,
      };
      const novoItem = await checklistService.adicionarItem(showItemModal, dadosItem);
      setTemplates((prevTemplates) =>
        prevTemplates.map((template) =>
          template.id === showItemModal
            ? {
                ...template,
                itens: [...(template.itens || []), novoItem],
              }
            : template
        )
      );
      setShowItemModal(null);
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
    } catch {
      // Erro silencioso
    } finally {
      setSaving(false);
    }
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

  return (
    <AppLayout>
      <PageHeader
        title="Templates"
        subtitle="Modelos de checklist para auditorias"
        action={
          <div className="flex gap-2">
            <Link
              href="/templates/importar"
              className="btn btn-ghost btn-sm gap-1"
            >
              <Upload className="w-4 h-4" />
              Importar
            </Link>
            <button
              onClick={() => setShowModal(true)}
              className="btn btn-primary btn-sm gap-1"
            >
              <Plus className="w-4 h-4" />
              Novo
            </button>
          </div>
        }
      />

      <div className="px-4 py-4 lg:px-8 space-y-4 max-w-3xl mx-auto">
        {loading ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum template cadastrado"
            description="Crie seu primeiro template de checklist para usar nas auditorias."
            actionLabel="Criar Template"
            actionHref="#"
          />
        ) : (
          <div className="space-y-3">
            {templates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="card bg-base-100 shadow-sm border border-base-300"
              >
                <div className="card-body p-0">
                  {/* Template Header */}
                  <button
                    onClick={() =>
                      setExpandedTemplate(
                        expandedTemplate === template.id ? null : template.id
                      )
                    }
                    className="flex items-center gap-4 p-4 w-full text-left hover:bg-base-200/50 transition-colors"
                  >
                    <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center">
                      <FileText className="w-6 h-6 text-secondary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-base-content truncate">
                        {template.nome}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="badge badge-ghost badge-sm">
                          <Tag className="w-3 h-3 mr-1" />
                          {TIPO_ATIVIDADE_LABELS[template.tipoAtividade] || template.tipoAtividade}
                        </span>
                        <span className="badge badge-ghost badge-sm">
                          <List className="w-3 h-3 mr-1" />
                          {template.itens?.filter((i) => i.ativo !== false).length || 0} itens
                        </span>
                        <span className="text-xs text-base-content/50">
                          v{template.versao}
                        </span>
                      </div>
                    </div>
                    {expandedTemplate === template.id ? (
                      <ChevronUp className="w-5 h-5 text-base-content/40" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-base-content/40" />
                    )}
                  </button>

                  {/* Itens do Template */}
                  {expandedTemplate === template.id && (
                    <div className="border-t border-base-200">
                      {template.descricao && (
                        <div className="px-4 py-3 bg-base-200/30 border-b border-base-200">
                          <p className="text-sm text-base-content/70">
                            {template.descricao}
                          </p>
                        </div>
                      )}
                      <div className="p-3 bg-base-200/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-base-content/70">
                            Itens do Checklist
                          </span>
                          <button
                            onClick={() => setShowItemModal(template.id)}
                            className="btn btn-ghost btn-xs gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Adicionar
                          </button>
                        </div>
                        {!template.itens || template.itens.length === 0 ? (
                          <div className="text-center py-6">
                            <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-2" />
                            <p className="text-sm text-base-content/50">
                              Nenhum item cadastrado
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {template.itens
                              .sort((a, b) => a.ordem - b.ordem)
                              .map((item, idx) => (
                                <div
                                  key={item.id}
                                  className="flex items-start gap-3 p-3 bg-base-100 rounded-lg"
                                >
                                  <span className="text-sm font-bold text-base-content/40 min-w-[24px]">
                                    {idx + 1}.
                                  </span>
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
                                    </div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                      <div className="p-3 border-t border-base-200 flex justify-end">
                        <Link
                          href={`/templates/${template.id}`}
                          className="btn btn-ghost btn-sm"
                        >
                          Editar Template
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Novo Template */}
      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Novo Template</h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Nome *</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Checklist RDC 216 - Restaurantes"
                  className="input input-bordered"
                  value={templateForm.nome}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, nome: e.target.value })
                  }
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Descrição</span>
                </label>
                <textarea
                  placeholder="Descreva o objetivo deste template..."
                  className="textarea textarea-bordered"
                  rows={2}
                  value={templateForm.descricao}
                  onChange={(e) =>
                    setTemplateForm({ ...templateForm, descricao: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Tipo de Atividade</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={templateForm.tipoAtividade}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
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
                    placeholder="1.0"
                    className="input input-bordered"
                    value={templateForm.versao}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, versao: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCriarTemplate}
                disabled={saving || !templateForm.nome}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar'
                )}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowModal(false)}></div>
        </div>
      )}

      {/* Modal Novo Item */}
      {showItemModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-lg">
            <h3 className="font-bold text-lg mb-4">Novo Item do Checklist</h3>
            <div className="space-y-4">
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
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Legislação de Referência</span>
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
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowItemModal(null)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAdicionarItem}
                disabled={saving || !itemForm.pergunta}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Adicionar'
                )}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setShowItemModal(null)}
          ></div>
        </div>
      )}
    </AppLayout>
  );
}

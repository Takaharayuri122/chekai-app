'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  MapPin,
  ChevronDown,
  ChevronUp,
  Loader2,
  Edit,
  Trash2,
  ImagePlus,
} from 'lucide-react';
import { AppLayout, PageHeader, EmptyState } from '@/components';
import { LogoCropperModal } from '@/components/ui/logo-cropper-modal';
import {
  clienteService,
  unidadeService,
  Cliente,
  TipoAtividade,
  TIPO_ATIVIDADE_LABELS,
} from '@/lib/api';
import { toastService } from '@/lib/toast';
import { useAuthStore } from '@/lib/store';

export default function ClientesPage() {
  const { isGestor, isMaster } = useAuthStore();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showUnidadeModal, setShowUnidadeModal] = useState<string | null>(null);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [editingUnidade, setEditingUnidade] = useState<{ clienteId: string; unidadeId: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageUrl, setCropperImageUrl] = useState<string>('');
  const [pendingLogoBlob, setPendingLogoBlob] = useState<Blob | null>(null);
  const [pendingLogoPreviewUrl, setPendingLogoPreviewUrl] = useState<string>('');
  const [pendingLogoRemover, setPendingLogoRemover] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const clearPendingLogo = () => {
    if (pendingLogoPreviewUrl) URL.revokeObjectURL(pendingLogoPreviewUrl);
    setPendingLogoBlob(null);
    setPendingLogoPreviewUrl('');
    setPendingLogoRemover(false);
  };

  // Form state
  const [clienteForm, setClienteForm] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    telefone: '',
    email: '',
    tipoAtividade: TipoAtividade.OUTRO,
  });

  const [unidadeForm, setUnidadeForm] = useState({
    nome: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
  });

  useEffect(() => {
    carregarClientes();
  }, []);

  const carregarClientes = async () => {
    try {
      const response = await clienteService.listar();
      setClientes(response.items || []);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  };

  // Função para aplicar máscara de CNPJ
  const aplicarMascaraCNPJ = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 14) {
      return apenasNumeros
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return valor;
  };

  // Função para remover máscara do CNPJ
  const removerMascaraCNPJ = (valor: string) => {
    return valor.replace(/\D/g, '');
  };

  const aplicarMascaraTelefone = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 10) {
      return apenasNumeros
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    if (apenasNumeros.length <= 11) {
      return apenasNumeros
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return valor;
  };

  const removerMascaraTelefone = (valor: string) => valor.replace(/\D/g, '');

  const emailValido = (valor: string) => {
    if (!valor.trim()) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
  };

  // Função para formatar CNPJ para exibição
  const formatarCNPJ = (cnpj: string) => {
    if (!cnpj) return '';
    const apenasNumeros = cnpj.replace(/\D/g, '');
    if (apenasNumeros.length === 14) {
      return aplicarMascaraCNPJ(apenasNumeros);
    }
    return cnpj;
  };

  const handleCriarCliente = async () => {
    const telefoneNumeros = removerMascaraTelefone(clienteForm.telefone);
    if (!clienteForm.razaoSocial || !clienteForm.cnpj || !clienteForm.telefone || telefoneNumeros.length < 10) return;
    if (clienteForm.email?.trim() && !emailValido(clienteForm.email)) return;
    setSaving(true);
    try {
      const dadosParaEnviar = {
        ...clienteForm,
        cnpj: removerMascaraCNPJ(clienteForm.cnpj),
        telefone: removerMascaraTelefone(clienteForm.telefone),
        email: clienteForm.email?.trim() || undefined,
      };
      const novoCliente = await clienteService.criar(dadosParaEnviar);
      if (pendingLogoBlob) {
        const file = new File([pendingLogoBlob], 'logo-cliente.jpg', { type: 'image/jpeg' });
        await clienteService.uploadLogo(novoCliente.id, file);
      }
      toastService.success('Cliente cadastrado com sucesso!');
      await carregarClientes();
      clearPendingLogo();
      setShowModal(false);
      setClienteForm({
        razaoSocial: '',
        nomeFantasia: '',
        cnpj: '',
        telefone: '',
        email: '',
        tipoAtividade: TipoAtividade.OUTRO,
      });
    } catch {
      // Erro já tratado pelo interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleCriarUnidade = async () => {
    if (!showUnidadeModal || !unidadeForm.nome || !unidadeForm.endereco) return;
    setSaving(true);

    try {
      if (editingUnidade) {
        await unidadeService.atualizar(editingUnidade.unidadeId, unidadeForm);
        toastService.success('Unidade atualizada com sucesso!');
        setEditingUnidade(null);
      } else {
        await clienteService.criarUnidade(showUnidadeModal, unidadeForm);
        toastService.success('Unidade cadastrada com sucesso!');
      }
      await carregarClientes();
      setShowUnidadeModal(null);
      setUnidadeForm({ nome: '', endereco: '', cidade: '', estado: '', cep: '' });
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleEditarCliente = (cliente: Cliente) => {
    setEditingCliente(cliente);
    const telefoneBruto = cliente.telefone || '';
    setClienteForm({
      razaoSocial: cliente.razaoSocial,
      nomeFantasia: cliente.nomeFantasia || '',
      cnpj: formatarCNPJ(cliente.cnpj),
      telefone: telefoneBruto ? aplicarMascaraTelefone(telefoneBruto) : '',
      email: cliente.email || '',
      tipoAtividade: cliente.tipoAtividade,
    });
    clearPendingLogo();
    setShowModal(true);
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toastService.error('Selecione uma imagem (JPEG, PNG, WebP ou GIF)');
      e.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toastService.error('A imagem deve ter no máximo 10MB para edição');
      e.target.value = '';
      return;
    }
    setPendingLogoRemover(false);
    const url = URL.createObjectURL(file);
    setCropperImageUrl(url);
    setCropperOpen(true);
    e.target.value = '';
  };

  const handleCropperClose = () => {
    if (cropperImageUrl) URL.revokeObjectURL(cropperImageUrl);
    setCropperOpen(false);
    setCropperImageUrl('');
  };

  const handleCropperConfirm = (blob: Blob) => {
    if (pendingLogoPreviewUrl) URL.revokeObjectURL(pendingLogoPreviewUrl);
    setPendingLogoBlob(blob);
    setPendingLogoPreviewUrl(URL.createObjectURL(blob));
    setCropperOpen(false);
    if (cropperImageUrl) URL.revokeObjectURL(cropperImageUrl);
    setCropperImageUrl('');
  };

  const handleRemoverLogoNoModal = () => {
    if (pendingLogoBlob || pendingLogoPreviewUrl) {
      if (pendingLogoPreviewUrl) URL.revokeObjectURL(pendingLogoPreviewUrl);
      setPendingLogoBlob(null);
      setPendingLogoPreviewUrl('');
    }
    setPendingLogoRemover(true);
  };

  const handleEditarUnidade = (clienteId: string, unidadeId: string) => {
    const cliente = clientes.find((c) => c.id === clienteId);
    const unidade = cliente?.unidades.find((u) => u.id === unidadeId);
    if (unidade) {
      setEditingUnidade({ clienteId, unidadeId });
      setUnidadeForm({
        nome: unidade.nome,
        endereco: unidade.endereco,
        cidade: unidade.cidade,
        estado: unidade.estado,
        cep: unidade.cep || '',
      });
      setShowUnidadeModal(clienteId);
    }
  };

  const handleAtualizarCliente = async () => {
    const telefoneNumeros = removerMascaraTelefone(clienteForm.telefone);
    if (!editingCliente || !clienteForm.razaoSocial || !clienteForm.cnpj || !clienteForm.telefone || telefoneNumeros.length < 10) return;
    if (clienteForm.email?.trim() && !emailValido(clienteForm.email)) return;
    setSaving(true);
    try {
      const dadosParaEnviar = {
        ...clienteForm,
        cnpj: removerMascaraCNPJ(clienteForm.cnpj),
        telefone: removerMascaraTelefone(clienteForm.telefone),
        email: clienteForm.email?.trim() || undefined,
      };
      await clienteService.atualizar(editingCliente.id, dadosParaEnviar);
      if (pendingLogoBlob) {
        const file = new File([pendingLogoBlob], 'logo-cliente.jpg', { type: 'image/jpeg' });
        await clienteService.uploadLogo(editingCliente.id, file);
      }
      if (pendingLogoRemover) {
        await clienteService.removerLogo(editingCliente.id);
      }
      toastService.success('Cliente atualizado com sucesso!');
      await carregarClientes();
      clearPendingLogo();
      setShowModal(false);
      setEditingCliente(null);
      setClienteForm({
        razaoSocial: '',
        nomeFantasia: '',
        cnpj: '',
        telefone: '',
        email: '',
        tipoAtividade: TipoAtividade.OUTRO,
      });
    } catch {
      // Erro já tratado pelo interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleRemoverCliente = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este cliente? Esta ação não pode ser desfeita.')) return;
    setDeletingId(id);
    try {
      await clienteService.remover(id);
      toastService.success('Cliente removido com sucesso!');
      await carregarClientes();
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setDeletingId(null);
    }
  };

  const handleRemoverUnidade = async (clienteId: string, unidadeId: string) => {
    if (!confirm('Tem certeza que deseja remover esta unidade? Esta ação não pode ser desfeita.')) return;
    try {
      await unidadeService.remover(unidadeId);
      toastService.success('Unidade removida com sucesso!');
      await carregarClientes();
    } catch (error) {
      // Erro já é tratado pelo interceptor
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Clientes"
        subtitle="Gerencie seus clientes e unidades"
        action={
          <button
            onClick={() => {
              clearPendingLogo();
              setShowModal(true);
            }}
            className="btn btn-primary btn-sm gap-1"
          >
            <Plus className="w-4 h-4" />
            Novo
          </button>
        }
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {loading ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          </div>
        ) : clientes.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhum cliente cadastrado"
            description="Cadastre seu primeiro cliente para começar."
            actionLabel="Cadastrar Cliente"
            actionOnClick={() => {
              clearPendingLogo();
              setShowModal(true);
            }}
          />
        ) : (
          <div className="space-y-3">
            {clientes.map((cliente, index) => (
              <motion.div
                key={cliente.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="card bg-base-100 shadow-sm border border-base-300"
              >
                <div className="card-body p-0">
                  {/* Cliente Header */}
                  <button
                    onClick={() =>
                      setExpandedCliente(
                        expandedCliente === cliente.id ? null : cliente.id
                      )
                    }
                    className="flex items-center gap-4 p-4 w-full text-left hover:bg-base-200/50 transition-colors"
                  >
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-base-content truncate">
                        {cliente.nomeFantasia || cliente.razaoSocial}
                      </p>
                      <p className="text-sm text-base-content/60">
                        {formatarCNPJ(cliente.cnpj)} • {TIPO_ATIVIDADE_LABELS[cliente.tipoAtividade] || cliente.tipoAtividade} • {cliente.unidades?.length || 0} unidade(s)
                      </p>
                    </div>
                    {expandedCliente === cliente.id ? (
                      <ChevronUp className="w-5 h-5 text-base-content/40" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-base-content/40" />
                    )}
                  </button>

                  {/* Unidades */}
                  {expandedCliente === cliente.id && (
                    <div className="border-t border-base-200">
                      <div className="p-3 bg-base-200/30">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-base-content/70">
                            Unidades
                          </span>
                          <button
                            onClick={() => {
                              setEditingUnidade(null);
                              setShowUnidadeModal(cliente.id);
                            }}
                            className="btn btn-ghost btn-xs gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Adicionar
                          </button>
                        </div>
                        {!cliente.unidades || cliente.unidades.length === 0 ? (
                          <p className="text-sm text-base-content/50 py-2">
                            Nenhuma unidade cadastrada
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {cliente.unidades.map((unidade) => (
                              <div
                                key={unidade.id}
                                className="flex items-center gap-3 p-3 bg-base-100 rounded-lg group"
                              >
                                <MapPin className="w-4 h-4 text-secondary" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {unidade.nome}
                                  </p>
                                  <p className="text-xs text-base-content/60 truncate">
                                    {unidade.cidade}, {unidade.estado}
                                  </p>
                                </div>
                                {(isGestor() || isMaster()) && (
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => handleEditarUnidade(cliente.id, unidade.id)}
                                      className="btn btn-ghost btn-xs"
                                      title="Editar unidade"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleRemoverUnidade(cliente.id, unidade.id)}
                                      className="btn btn-ghost btn-xs text-error"
                                      title="Remover unidade"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {(isGestor() || isMaster()) && (
                        <div className="p-3 border-t border-base-200 flex justify-end gap-2">
                          <button
                            onClick={() => handleEditarCliente(cliente)}
                            className="btn btn-ghost btn-sm gap-1"
                          >
                            <Edit className="w-4 h-4" />
                            Editar Cliente
                          </button>
                          <button
                            onClick={() => handleRemoverCliente(cliente.id)}
                            disabled={deletingId === cliente.id}
                            className="btn btn-error btn-sm gap-1"
                          >
                            {deletingId === cliente.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Remover
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Novo Cliente */}
      {showModal && (
        <div 
          className="modal modal-open"
          onClick={(e) => {
            // Não fecha ao clicar fora - removido para evitar perda de dados
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
            </h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Razão Social *</span>
                </label>
                <input
                  type="text"
                  placeholder="Razão social da empresa"
                  className="input input-bordered"
                  value={clienteForm.razaoSocial}
                  onChange={(e) =>
                    setClienteForm({ ...clienteForm, razaoSocial: e.target.value })
                  }
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Nome Fantasia</span>
                </label>
                <input
                  type="text"
                  placeholder="Nome fantasia"
                  className="input input-bordered"
                  value={clienteForm.nomeFantasia}
                  onChange={(e) =>
                    setClienteForm({ ...clienteForm, nomeFantasia: e.target.value })
                  }
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">CNPJ *</span>
                </label>
                <input
                  type="text"
                  placeholder="00.000.000/0000-00"
                  className="input input-bordered"
                  value={clienteForm.cnpj}
                  onChange={(e) => {
                    const valorFormatado = aplicarMascaraCNPJ(e.target.value);
                    setClienteForm({ ...clienteForm, cnpj: valorFormatado });
                  }}
                  maxLength={18}
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Tipo de Atividade</span>
                </label>
                <select
                  className="select select-bordered"
                  value={clienteForm.tipoAtividade}
                  onChange={(e) =>
                    setClienteForm({
                      ...clienteForm,
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
                <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Telefone *</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    className="input input-bordered"
                    value={clienteForm.telefone}
                    onChange={(e) => {
                      const valorFormatado = aplicarMascaraTelefone(e.target.value);
                      setClienteForm({ ...clienteForm, telefone: valorFormatado });
                    }}
                    maxLength={15}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">E-mail (opcional)</span>
                    {clienteForm.email && !emailValido(clienteForm.email) && (
                      <span className="label-text-alt text-error">E-mail inválido</span>
                    )}
                  </label>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    className={`input input-bordered ${clienteForm.email && !emailValido(clienteForm.email) ? 'input-error' : ''}`}
                    value={clienteForm.email}
                    onChange={(e) =>
                      setClienteForm({ ...clienteForm, email: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="form-control pt-2 border-t border-base-200">
                <label className="label">
                  <span className="label-text">Logo do cliente</span>
                </label>
                <p className="text-sm text-base-content/60 mb-3">
                  A logo aparece no cabeçalho dos relatórios em formato quadrado.
                </p>
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => handleLogoFileSelect(e)}
                />
                {!pendingLogoRemover && (pendingLogoPreviewUrl || (editingCliente?.logoUrl && !pendingLogoBlob)) ? (
                  <div className="flex flex-col items-start gap-3">
                    <div className="w-40 h-40 rounded-lg border border-base-300 overflow-hidden bg-base-200 flex-shrink-0">
                      <img
                        src={pendingLogoPreviewUrl || editingCliente?.logoUrl || ''}
                        alt="Logo do cliente"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-outline btn-sm gap-2"
                        onClick={() => logoFileInputRef.current?.click()}
                      >
                        <ImagePlus className="w-4 h-4" />
                        Alterar imagem
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm gap-2 text-error hover:bg-error/10"
                        onClick={handleRemoverLogoNoModal}
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover imagem
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    className="w-full h-24 border-2 border-dashed border-base-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <ImagePlus className="w-8 h-8 text-base-content/40" />
                    <span className="text-sm text-base-content/60">
                      Clique para adicionar imagem da logo
                    </span>
                  </button>
                )}
              </div>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  clearPendingLogo();
                  setShowModal(false);
                  setEditingCliente(null);
                  setClienteForm({
                    razaoSocial: '',
                    nomeFantasia: '',
                    cnpj: '',
                    telefone: '',
                    email: '',
                    tipoAtividade: TipoAtividade.OUTRO,
                  });
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={editingCliente ? handleAtualizarCliente : handleCriarCliente}
                disabled={
                  saving ||
                  !clienteForm.razaoSocial ||
                  !clienteForm.cnpj ||
                  !clienteForm.telefone ||
                  removerMascaraTelefone(clienteForm.telefone).length < 10 ||
                  (clienteForm.email?.trim() ? !emailValido(clienteForm.email) : false)
                }
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  editingCliente ? 'Atualizar' : 'Salvar'
                )}
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

      <LogoCropperModal
        open={cropperOpen}
        imageSource={cropperImageUrl}
        onClose={handleCropperClose}
        onConfirm={handleCropperConfirm}
        title="Ajustar imagem da logo do cliente"
      />

      {/* Modal Nova Unidade */}
      {showUnidadeModal && (
        <div 
          className="modal modal-open"
          onClick={(e) => {
            // Não fecha ao clicar fora - removido para evitar perda de dados
            if (e.target === e.currentTarget) {
              e.stopPropagation();
            }
          }}
        >
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">
              {editingUnidade ? 'Editar Unidade' : 'Nova Unidade'}
            </h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Nome *</span>
                </label>
                <input
                  type="text"
                  placeholder="Nome da unidade"
                  className="input input-bordered"
                  value={unidadeForm.nome}
                  onChange={(e) =>
                    setUnidadeForm({ ...unidadeForm, nome: e.target.value })
                  }
                />
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Endereço *</span>
                </label>
                <input
                  type="text"
                  placeholder="Rua, número, bairro"
                  className="input input-bordered"
                  value={unidadeForm.endereco}
                  onChange={(e) =>
                    setUnidadeForm({ ...unidadeForm, endereco: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Cidade *</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Cidade"
                    className="input input-bordered"
                    value={unidadeForm.cidade}
                    onChange={(e) =>
                      setUnidadeForm({ ...unidadeForm, cidade: e.target.value })
                    }
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Estado *</span>
                  </label>
                  <input
                    type="text"
                    placeholder="UF"
                    className="input input-bordered"
                    maxLength={2}
                    value={unidadeForm.estado}
                    onChange={(e) =>
                      setUnidadeForm({
                        ...unidadeForm,
                        estado: e.target.value.toUpperCase(),
                      })
                    }
                  />
                </div>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">CEP</span>
                </label>
                <input
                  type="text"
                  placeholder="00000-000"
                  className="input input-bordered"
                  value={unidadeForm.cep}
                  onChange={(e) =>
                    setUnidadeForm({ ...unidadeForm, cep: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowUnidadeModal(null);
                  setEditingUnidade(null);
                  setUnidadeForm({ nome: '', endereco: '', cidade: '', estado: '', cep: '' });
                }}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCriarUnidade}
                disabled={
                  saving ||
                  !unidadeForm.nome ||
                  !unidadeForm.endereco ||
                  !unidadeForm.cidade ||
                  !unidadeForm.estado
                }
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  editingUnidade ? 'Atualizar' : 'Salvar'
                )}
              </button>
            </div>
          </div>
          <div
            className="modal-backdrop"
            onClick={() => setShowUnidadeModal(null)}
          ></div>
        </div>
      )}
    </AppLayout>
  );
}

'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Building2,
  Plus,
  MapPin,
  Loader2,
  Edit,
  Trash2,
  ImagePlus,
  Check,
  ChevronDown,
  X,
  Users,
} from 'lucide-react';
import {
  AppLayout,
  PageHeader,
  ConfirmDialog,
  FormModal,
  CrudFiltros,
  CrudTable,
  type ColunaTabela,
  type AcaoTabela,
} from '@/components';
import { LogoCropperModal } from '@/components/ui/logo-cropper-modal';
import {
  clienteService,
  unidadeService,
  usuarioService,
  Cliente,
  Unidade,
  Usuario,
  TipoAtividade,
  PerfilUsuario,
  TIPO_ATIVIDADE_LABELS,
  type CriarUnidadeInline,
} from '@/lib/api';
import { toastService } from '@/lib/toast';
import { useAuthStore } from '@/lib/store';

interface UnidadePendente extends CriarUnidadeInline {
  tempId: string;
}

interface FiltrosCliente {
  nome: string;
  tipoAtividade: string;
}

const FILTROS_INICIAIS: FiltrosCliente = { nome: '', tipoAtividade: '' };

const INLINE_UNIDADE_INICIAL = {
  nome: '',
  endereco: '',
  cidade: '',
  estado: '',
  cep: '',
  email: '',
  responsavel: '',
  whatsapp: '',
  auditorIds: [] as string[],
};

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

const removerMascaraCNPJ = (valor: string) => valor.replace(/\D/g, '');

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

const formatarCNPJ = (cnpj: string) => {
  if (!cnpj) return '';
  const apenasNumeros = cnpj.replace(/\D/g, '');
  if (apenasNumeros.length === 14) return aplicarMascaraCNPJ(apenasNumeros);
  return cnpj;
};

const emailValido = (valor: string) => {
  if (!valor.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
};

const OPCOES_TIPO_ATIVIDADE = Object.entries(TIPO_ATIVIDADE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

function MultiSelectAuditores({
  auditores,
  selecionados,
  onChange,
  label,
  size = 'md',
}: {
  auditores: Usuario[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, []);

  const toggleAuditor = (id: string) => {
    onChange(
      selecionados.includes(id)
        ? selecionados.filter((s) => s !== id)
        : [...selecionados, id],
    );
  };

  const nomesSelecionados = auditores
    .filter((a) => selecionados.includes(a.id))
    .map((a) => a.nome);

  const inputClass = size === 'sm' ? 'input-sm text-xs' : '';
  const labelClass = size === 'sm' ? 'text-xs' : '';

  return (
    <div className="form-control" ref={ref}>
      <label className="label py-1">
        <span className={`label-text ${labelClass}`}>{label}</span>
      </label>
      <div className="relative">
        <button
          type="button"
          className={`input input-bordered w-full flex items-center justify-between gap-2 ${inputClass}`}
          onClick={() => setAberto(!aberto)}
        >
          <span className="truncate text-left flex-1">
            {nomesSelecionados.length > 0
              ? nomesSelecionados.join(', ')
              : 'Selecionar auditores...'}
          </span>
          <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
        </button>
        {aberto && (
          <div className="absolute z-50 mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {auditores.length === 0 ? (
              <div className="p-3 text-sm text-base-content/50 text-center">Nenhum auditor disponível</div>
            ) : (
              auditores.map((auditor) => (
                <label
                  key={auditor.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-base-200 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm checkbox-primary"
                    checked={selecionados.includes(auditor.id)}
                    onChange={() => toggleAuditor(auditor.id)}
                  />
                  <span className="text-sm">{auditor.nome}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>
      {nomesSelecionados.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {auditores
            .filter((a) => selecionados.includes(a.id))
            .map((a) => (
              <span key={a.id} className="badge badge-sm badge-primary gap-1">
                {a.nome}
                <button type="button" onClick={() => toggleAuditor(a.id)}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

export default function ClientesPage() {
  const { isGestor, isMaster } = useAuthStore();

  const [todosClientes, setTodosClientes] = useState<Cliente[]>([]);
  const [clientesFiltrados, setClientesFiltrados] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [auditores, setAuditores] = useState<Usuario[]>([]);
  const [showAvisoTrocaAuditor, setShowAvisoTrocaAuditor] = useState(false);
  const [avisoTrocaInfo, setAvisoTrocaInfo] = useState<{ quantidade: number } | null>(null);
  const [dadosPendentesUpdate, setDadosPendentesUpdate] = useState<Record<string, unknown> | null>(null);

  const [unidadesPendentes, setUnidadesPendentes] = useState<UnidadePendente[]>([]);
  const [showInlineUnidadeForm, setShowInlineUnidadeForm] = useState(false);
  const [editingInlineUnidadeId, setEditingInlineUnidadeId] = useState<string | null>(null);
  const [inlineUnidadeForm, setInlineUnidadeForm] = useState({ ...INLINE_UNIDADE_INICIAL });
  const [editingUnidadeId, setEditingUnidadeId] = useState<string | null>(null);
  const [editUnidadeForm, setEditUnidadeForm] = useState({ ...INLINE_UNIDADE_INICIAL });
  const [savingUnidade, setSavingUnidade] = useState(false);

  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageUrl, setCropperImageUrl] = useState('');
  const [pendingLogoBlob, setPendingLogoBlob] = useState<Blob | null>(null);
  const [pendingLogoPreviewUrl, setPendingLogoPreviewUrl] = useState('');
  const [pendingLogoRemover, setPendingLogoRemover] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const [clienteForm, setClienteForm] = useState({
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    telefone: '',
    email: '',
    tipoAtividade: TipoAtividade.OUTRO,
    auditorIds: [] as string[],
  });

  const clienteFormInicial = {
    razaoSocial: '',
    nomeFantasia: '',
    cnpj: '',
    telefone: '',
    email: '',
    tipoAtividade: TipoAtividade.OUTRO,
    auditorIds: [] as string[],
  };

  const clearPendingLogo = () => {
    if (pendingLogoPreviewUrl) URL.revokeObjectURL(pendingLogoPreviewUrl);
    setPendingLogoBlob(null);
    setPendingLogoPreviewUrl('');
    setPendingLogoRemover(false);
  };

  const carregarAuditores = async () => {
    try {
      const response = await usuarioService.listar(1, 100, PerfilUsuario.AUDITOR);
      setAuditores(response.items || []);
    } catch {
      // interceptor
    }
  };

  useEffect(() => {
    carregarAuditores();
  }, []);

  const carregarClientes = async () => {
    setLoading(true);
    try {
      const response = await clienteService.listar(1, 100);
      setTodosClientes(response.items || []);
      setClientesFiltrados(response.items || []);
    } catch {
      // interceptor
    } finally {
      setLoading(false);
    }
  };

  const handlePesquisar = (filtros: FiltrosCliente) => {
    const filtrados = todosClientes.filter((c) => {
      if (filtros.nome) {
        const nome = (c.nomeFantasia || c.razaoSocial).toLowerCase();
        if (!nome.includes(filtros.nome.toLowerCase())) return false;
      }
      if (filtros.tipoAtividade && c.tipoAtividade !== filtros.tipoAtividade) return false;
      return true;
    });
    setClientesFiltrados(filtrados);
  };

  const handleNovoCliente = () => {
    setEditingCliente(null);
    setClienteForm(clienteFormInicial);
    setUnidadesPendentes([]);
    setShowInlineUnidadeForm(false);
    setEditingInlineUnidadeId(null);
    setInlineUnidadeForm({ ...INLINE_UNIDADE_INICIAL });
    setEditingUnidadeId(null);
    setEditUnidadeForm({ ...INLINE_UNIDADE_INICIAL });
    clearPendingLogo();
    setShowModal(true);
  };

  const handleEditarCliente = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setClienteForm({
      razaoSocial: cliente.razaoSocial,
      nomeFantasia: cliente.nomeFantasia || '',
      cnpj: formatarCNPJ(cliente.cnpj),
      telefone: cliente.telefone ? aplicarMascaraTelefone(cliente.telefone) : '',
      email: cliente.email || '',
      tipoAtividade: cliente.tipoAtividade,
      auditorIds: (cliente.auditores || []).map((a) => a.id),
    });
    setUnidadesPendentes([]);
    setShowInlineUnidadeForm(false);
    setEditingInlineUnidadeId(null);
    setInlineUnidadeForm({ ...INLINE_UNIDADE_INICIAL });
    clearPendingLogo();
    setShowModal(true);
  };

  const montarDadosCliente = () => {
    const base = {
      ...clienteForm,
      cnpj: removerMascaraCNPJ(clienteForm.cnpj),
      telefone: removerMascaraTelefone(clienteForm.telefone),
      email: clienteForm.email?.trim() || undefined,
      auditorIds: clienteForm.auditorIds.length > 0 ? clienteForm.auditorIds : undefined,
    };
    if (!editingCliente) {
      return {
        ...base,
        unidades: unidadesPendentes.map(({ tempId, ...u }) => ({
          ...u,
          whatsapp: u.whatsapp ? removerMascaraTelefone(u.whatsapp) : undefined,
        })),
      };
    }
    return { ...base, auditorIds: clienteForm.auditorIds };
  };

  const salvarClienteComDados = async (dados: Record<string, unknown>, confirmado = false) => {
    setSaving(true);
    try {
      if (editingCliente) {
        const payload = confirmado ? { ...dados, confirmado: true } : dados;
        const resultado = await clienteService.atualizar(editingCliente.id, payload);
        if (resultado.warning?.temAuditoriasAbertas && !confirmado) {
          setAvisoTrocaInfo({ quantidade: resultado.warning.quantidade });
          setDadosPendentesUpdate(dados);
          setShowAvisoTrocaAuditor(true);
          return;
        }
        if (pendingLogoBlob) {
          const file = new File([pendingLogoBlob], 'logo-cliente.jpg', { type: 'image/jpeg' });
          await clienteService.uploadLogo(editingCliente.id, file);
        }
        if (pendingLogoRemover) await clienteService.removerLogo(editingCliente.id);
        toastService.success('Cliente atualizado com sucesso!');
      } else {
        const novo = await clienteService.criar(dados as unknown as Parameters<typeof clienteService.criar>[0]);
        if (pendingLogoBlob) {
          const file = new File([pendingLogoBlob], 'logo-cliente.jpg', { type: 'image/jpeg' });
          await clienteService.uploadLogo(novo.id, file);
        }
        toastService.success('Cliente cadastrado com sucesso!');
      }
      await carregarClientes();
      clearPendingLogo();
      setShowModal(false);
      setEditingCliente(null);
      setClienteForm(clienteFormInicial);
      setUnidadesPendentes([]);
      setEditingUnidadeId(null);
      setEditUnidadeForm({ ...INLINE_UNIDADE_INICIAL });
    } catch {
      // interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleSalvarCliente = async () => {
    const telefoneNumeros = removerMascaraTelefone(clienteForm.telefone);
    if (!clienteForm.razaoSocial || !clienteForm.cnpj || !clienteForm.telefone || telefoneNumeros.length < 10) return;
    if (clienteForm.email?.trim() && !emailValido(clienteForm.email)) return;
    if (!editingCliente && unidadesPendentes.length === 0) return;
    await salvarClienteComDados(montarDadosCliente());
  };

  const handleAdicionarInlineUnidade = () => {
    setEditingInlineUnidadeId(null);
    setInlineUnidadeForm({ ...INLINE_UNIDADE_INICIAL });
    setShowInlineUnidadeForm(true);
  };

  const handleSalvarInlineUnidade = async () => {
    if (!inlineUnidadeForm.nome || !inlineUnidadeForm.endereco || !inlineUnidadeForm.cidade || !inlineUnidadeForm.estado) return;
    if (!inlineUnidadeForm.email || !inlineUnidadeForm.responsavel) return;
    if (editingCliente && !editingInlineUnidadeId) {
      setSavingUnidade(true);
      try {
        await clienteService.criarUnidade(editingCliente.id, {
          nome: inlineUnidadeForm.nome,
          endereco: inlineUnidadeForm.endereco,
          cidade: inlineUnidadeForm.cidade || undefined,
          estado: inlineUnidadeForm.estado || undefined,
          cep: inlineUnidadeForm.cep || undefined,
          email: inlineUnidadeForm.email,
          responsavel: inlineUnidadeForm.responsavel,
          whatsapp: inlineUnidadeForm.whatsapp ? removerMascaraTelefone(inlineUnidadeForm.whatsapp) : undefined,
          auditorIds: inlineUnidadeForm.auditorIds,
        });
        const clienteAtualizado = await clienteService.buscarPorId(editingCliente.id);
        setEditingCliente(clienteAtualizado);
        setShowInlineUnidadeForm(false);
        setInlineUnidadeForm({ ...INLINE_UNIDADE_INICIAL });
        toastService.success('Unidade adicionada com sucesso!');
      } catch {
        // interceptor
      } finally {
        setSavingUnidade(false);
      }
      return;
    }
    if (editingInlineUnidadeId) {
      setUnidadesPendentes((prev) =>
        prev.map((u) => (u.tempId === editingInlineUnidadeId ? { ...inlineUnidadeForm, tempId: u.tempId } : u)),
      );
    } else {
      setUnidadesPendentes((prev) => [...prev, { ...inlineUnidadeForm, tempId: crypto.randomUUID() }]);
    }
    setShowInlineUnidadeForm(false);
    setEditingInlineUnidadeId(null);
    setInlineUnidadeForm({ ...INLINE_UNIDADE_INICIAL });
  };

  const handleEditarInlineUnidade = (tempId: string) => {
    const unidade = unidadesPendentes.find((u) => u.tempId === tempId);
    if (!unidade) return;
    setEditingInlineUnidadeId(tempId);
    setInlineUnidadeForm({
      nome: unidade.nome,
      endereco: unidade.endereco,
      cidade: unidade.cidade || '',
      estado: unidade.estado || '',
      cep: unidade.cep || '',
      email: unidade.email || '',
      responsavel: unidade.responsavel || '',
      whatsapp: unidade.whatsapp || '',
      auditorIds: unidade.auditorIds || [],
    });
    setShowInlineUnidadeForm(true);
  };

  const handleRemoverInlineUnidade = (tempId: string) => {
    setUnidadesPendentes((prev) => prev.filter((u) => u.tempId !== tempId));
  };

  const handleEditarUnidadeExistente = (unidade: Unidade) => {
    setEditingUnidadeId(unidade.id);
    setEditUnidadeForm({
      nome: unidade.nome,
      endereco: unidade.endereco,
      cidade: unidade.cidade || '',
      estado: unidade.estado || '',
      cep: unidade.cep || '',
      email: unidade.email || '',
      responsavel: unidade.responsavel || '',
      whatsapp: unidade.whatsapp ? aplicarMascaraTelefone(unidade.whatsapp) : '',
      auditorIds: (unidade.auditores || []).map((a) => a.id),
    });
  };

  const handleCancelarEditUnidade = () => {
    setEditingUnidadeId(null);
    setEditUnidadeForm({ ...INLINE_UNIDADE_INICIAL });
  };

  const handleSalvarUnidadeExistente = async () => {
    if (!editingUnidadeId || !editingCliente) return;
    if (!editUnidadeForm.nome || !editUnidadeForm.endereco || !editUnidadeForm.email || !editUnidadeForm.responsavel) return;
    setSavingUnidade(true);
    try {
      await unidadeService.atualizar(editingUnidadeId, {
        nome: editUnidadeForm.nome,
        endereco: editUnidadeForm.endereco,
        cidade: editUnidadeForm.cidade || undefined,
        estado: editUnidadeForm.estado || undefined,
        cep: editUnidadeForm.cep || undefined,
        email: editUnidadeForm.email,
        responsavel: editUnidadeForm.responsavel,
        whatsapp: editUnidadeForm.whatsapp ? removerMascaraTelefone(editUnidadeForm.whatsapp) : undefined,
        auditorIds: editUnidadeForm.auditorIds,
        clienteId: editingCliente.id,
      });
      const clienteAtualizado = await clienteService.buscarPorId(editingCliente.id);
      setEditingCliente(clienteAtualizado);
      setEditingUnidadeId(null);
      setEditUnidadeForm({ ...INLINE_UNIDADE_INICIAL });
      toastService.success('Unidade atualizada com sucesso!');
    } catch {
      // interceptor
    } finally {
      setSavingUnidade(false);
    }
  };

  const handleConfirmarTrocaAuditor = async () => {
    if (!dadosPendentesUpdate) return;
    setShowAvisoTrocaAuditor(false);
    await salvarClienteComDados(dadosPendentesUpdate, true);
    setDadosPendentesUpdate(null);
    setAvisoTrocaInfo(null);
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteConfirm) return;
    setIsDeleting(true);
    try {
      await clienteService.remover(showDeleteConfirm);
      toastService.success('Cliente removido com sucesso!');
      await carregarClientes();
      setShowDeleteConfirm(null);
    } catch {
      // interceptor
    } finally {
      setIsDeleting(false);
    }
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
      toastService.error('A imagem deve ter no máximo 10MB');
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
    if (pendingLogoPreviewUrl) URL.revokeObjectURL(pendingLogoPreviewUrl);
    setPendingLogoBlob(null);
    setPendingLogoPreviewUrl('');
    setPendingLogoRemover(true);
  };

  const auditoresSelecionadosCliente = auditores.filter((a) =>
    clienteForm.auditorIds.includes(a.id),
  );

  const colunas: ColunaTabela<Cliente>[] = [
    {
      label: 'Cliente',
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-base-content truncate">
              {c.nomeFantasia || c.razaoSocial}
            </div>
            <div className="text-xs text-base-content/50">{formatarCNPJ(c.cnpj)}</div>
          </div>
        </div>
      ),
    },
    {
      label: 'Tipo',
      render: (c) => (
        <span className="badge badge-outline badge-sm">
          {TIPO_ATIVIDADE_LABELS[c.tipoAtividade]}
        </span>
      ),
    },
    {
      label: 'Auditores',
      render: (c) => (
        <div className="flex items-center gap-1">
          <Users className="w-3.5 h-3.5 text-base-content/50" />
          <span className="badge badge-sm badge-ghost">
            {c.auditores?.length || 0}
          </span>
        </div>
      ),
    },
    {
      label: 'Unidades',
      render: (c) => (
        <span className="badge badge-sm badge-ghost">
          {c.unidades?.length || 0}
        </span>
      ),
    },
  ];

  const acoes: AcaoTabela<Cliente>[] = [
    { label: 'Editar', icon: Edit, onClick: handleEditarCliente },
    {
      label: 'Remover',
      icon: Trash2,
      onClick: (c) => setShowDeleteConfirm(c.id),
      className: 'text-error',
      isVisivel: () => isGestor() || isMaster(),
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Clientes"
        subtitle="Gerencie seus clientes e unidades"
        action={
          <button className="btn btn-primary gap-2" onClick={handleNovoCliente}>
            <Plus className="w-4 h-4" />
            Novo Cliente
          </button>
        }
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        <CrudFiltros
          campos={[
            { key: 'nome', label: 'Nome', tipo: 'text', placeholder: 'Buscar por nome...' },
            {
              key: 'tipoAtividade',
              label: 'Tipo de Atividade',
              tipo: 'select',
              opcoes: OPCOES_TIPO_ATIVIDADE,
            },
          ]}
          valoresIniciais={FILTROS_INICIAIS}
          onPesquisar={handlePesquisar}
          onLimpar={() => carregarClientes()}
        />

        <CrudTable
          colunas={colunas}
          dados={clientesFiltrados}
          acoes={acoes}
          keyExtractor={(c) => c.id}
          loading={loading}
          emptyState={{
            icon: Building2,
            title: 'Nenhum cliente encontrado',
            description: 'Ajuste os filtros ou cadastre um novo cliente.',
            actionLabel: 'Novo Cliente',
            actionOnClick: handleNovoCliente,
          }}
        />
      </div>

      <FormModal
        open={showModal}
        onClose={() => {
          clearPendingLogo();
          setShowModal(false);
          setEditingCliente(null);
          setClienteForm(clienteFormInicial);
          setUnidadesPendentes([]);
        }}
        title={editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
        maxWidth="4xl"
        isDirty={Boolean(clienteForm.razaoSocial || clienteForm.cnpj || clienteForm.telefone || unidadesPendentes.length > 0)}
        closeOnBackdrop={false}
        footer={
          <>
            <button
              className="btn btn-ghost"
              onClick={() => {
                clearPendingLogo();
                setShowModal(false);
                setEditingCliente(null);
                setClienteForm(clienteFormInicial);
                setUnidadesPendentes([]);
              }}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleSalvarCliente}
              disabled={
                saving ||
                !clienteForm.razaoSocial ||
                !clienteForm.cnpj ||
                !clienteForm.telefone ||
                removerMascaraTelefone(clienteForm.telefone).length < 10 ||
                (clienteForm.email?.trim() ? !emailValido(clienteForm.email) : false) ||
                (!editingCliente && unidadesPendentes.length === 0)
              }
            >
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              ) : (
                editingCliente ? 'Atualizar' : 'Salvar'
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label"><span className="label-text">Razão Social *</span></label>
                  <input
                    type="text"
                    placeholder="Razão social da empresa"
                    className="input input-bordered"
                    value={clienteForm.razaoSocial}
                    onChange={(e) => setClienteForm({ ...clienteForm, razaoSocial: e.target.value })}
                  />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Nome Fantasia</span></label>
                  <input
                    type="text"
                    placeholder="Nome fantasia"
                    className="input input-bordered"
                    value={clienteForm.nomeFantasia}
                    onChange={(e) => setClienteForm({ ...clienteForm, nomeFantasia: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label"><span className="label-text">CNPJ *</span></label>
                  <input
                    type="text"
                    placeholder="00.000.000/0000-00"
                    className="input input-bordered"
                    value={clienteForm.cnpj}
                    onChange={(e) => setClienteForm({ ...clienteForm, cnpj: aplicarMascaraCNPJ(e.target.value) })}
                    maxLength={18}
                  />
                </div>
                <div className="form-control">
                  <label className="label"><span className="label-text">Tipo de Atividade</span></label>
                  <select
                    className="select select-bordered"
                    value={clienteForm.tipoAtividade}
                    onChange={(e) => setClienteForm({ ...clienteForm, tipoAtividade: e.target.value as TipoAtividade })}
                  >
                    {Object.entries(TIPO_ATIVIDADE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="form-control">
                  <label className="label"><span className="label-text">Telefone *</span></label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    className="input input-bordered"
                    value={clienteForm.telefone}
                    onChange={(e) => setClienteForm({ ...clienteForm, telefone: aplicarMascaraTelefone(e.target.value) })}
                    maxLength={15}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">E-mail</span>
                    {clienteForm.email && !emailValido(clienteForm.email) && (
                      <span className="label-text-alt text-error">Inválido</span>
                    )}
                  </label>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    className={`input input-bordered ${clienteForm.email && !emailValido(clienteForm.email) ? 'input-error' : ''}`}
                    value={clienteForm.email}
                    onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })}
                  />
                </div>
              </div>
              {(isGestor() || isMaster()) && (
                <MultiSelectAuditores
                  auditores={auditores}
                  selecionados={clienteForm.auditorIds}
                  onChange={(ids) => setClienteForm({ ...clienteForm, auditorIds: ids })}
                  label="Auditores Responsáveis"
                />
              )}
              <div className="form-control pt-2 border-t border-base-200">
                <label className="label"><span className="label-text">Logo do cliente</span></label>
                <p className="text-sm text-base-content/60 mb-3">
                  A logo aparece no cabeçalho dos relatórios em formato quadrado.
                </p>
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleLogoFileSelect}
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
                      <button type="button" className="btn btn-outline btn-sm gap-2" onClick={() => logoFileInputRef.current?.click()}>
                        <ImagePlus className="w-4 h-4" />
                        Alterar imagem
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm gap-2 text-error hover:bg-error/10" onClick={handleRemoverLogoNoModal}>
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
                    <span className="text-sm text-base-content/60">Clique para adicionar imagem da logo</span>
                  </button>
                )}
              </div>

              {/* Seção de Unidades */}
              <div className="pt-2 border-t border-base-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="label-text font-medium">Unidades *</span>
                    {!editingCliente && (
                      <span className="badge badge-sm badge-ghost">{unidadesPendentes.length}</span>
                    )}
                    {editingCliente && (
                      <span className="badge badge-sm badge-ghost">{editingCliente.unidades?.length || 0}</span>
                    )}
                  </div>
                  {!showInlineUnidadeForm && !editingUnidadeId && (
                    <button type="button" className="btn btn-outline btn-sm gap-1" onClick={handleAdicionarInlineUnidade}>
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar
                    </button>
                  )}
                </div>

                {editingCliente ? (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {!editingCliente.unidades || editingCliente.unidades.length === 0 ? (
                      <p className="text-sm text-base-content/50 py-4 text-center">
                        Nenhuma unidade cadastrada.
                      </p>
                    ) : (
                      editingCliente.unidades.map((unidade) => (
                        <div key={unidade.id}>
                          {editingUnidadeId === unidade.id ? (
                            <div className="p-3 border border-primary/30 rounded-lg bg-base-200/20 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="form-control">
                                  <label className="label py-1"><span className="label-text text-xs">Nome *</span></label>
                                  <input
                                    type="text"
                                    placeholder="Nome da unidade"
                                    className="input input-bordered input-sm"
                                    value={editUnidadeForm.nome}
                                    onChange={(e) => setEditUnidadeForm({ ...editUnidadeForm, nome: e.target.value })}
                                  />
                                </div>
                                <div className="form-control">
                                  <label className="label py-1"><span className="label-text text-xs">Endereço *</span></label>
                                  <input
                                    type="text"
                                    placeholder="Rua, número, bairro"
                                    className="input input-bordered input-sm"
                                    value={editUnidadeForm.endereco}
                                    onChange={(e) => setEditUnidadeForm({ ...editUnidadeForm, endereco: e.target.value })}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="form-control">
                                  <label className="label py-1"><span className="label-text text-xs">Cidade *</span></label>
                                  <input
                                    type="text"
                                    placeholder="Cidade"
                                    className="input input-bordered input-sm"
                                    value={editUnidadeForm.cidade}
                                    onChange={(e) => setEditUnidadeForm({ ...editUnidadeForm, cidade: e.target.value })}
                                  />
                                </div>
                                <div className="form-control">
                                  <label className="label py-1"><span className="label-text text-xs">Estado *</span></label>
                                  <input
                                    type="text"
                                    placeholder="UF"
                                    className="input input-bordered input-sm"
                                    maxLength={2}
                                    value={editUnidadeForm.estado}
                                    onChange={(e) => setEditUnidadeForm({ ...editUnidadeForm, estado: e.target.value.toUpperCase() })}
                                  />
                                </div>
                                <div className="form-control">
                                  <label className="label py-1"><span className="label-text text-xs">CEP</span></label>
                                  <input
                                    type="text"
                                    placeholder="00000-000"
                                    className="input input-bordered input-sm"
                                    value={editUnidadeForm.cep}
                                    onChange={(e) => setEditUnidadeForm({ ...editUnidadeForm, cep: e.target.value })}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="form-control">
                                  <label className="label py-1"><span className="label-text text-xs">E-mail da Unidade *</span></label>
                                  <input
                                    type="email"
                                    placeholder="email@unidade.com"
                                    className={`input input-bordered input-sm ${editUnidadeForm.email && !emailValido(editUnidadeForm.email) ? 'input-error' : ''}`}
                                    value={editUnidadeForm.email}
                                    onChange={(e) => setEditUnidadeForm({ ...editUnidadeForm, email: e.target.value })}
                                  />
                                </div>
                                <div className="form-control">
                                  <label className="label py-1"><span className="label-text text-xs">Responsável *</span></label>
                                  <input
                                    type="text"
                                    placeholder="Nome do responsável"
                                    className="input input-bordered input-sm"
                                    value={editUnidadeForm.responsavel}
                                    onChange={(e) => setEditUnidadeForm({ ...editUnidadeForm, responsavel: e.target.value })}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="form-control">
                                  <label className="label py-1"><span className="label-text text-xs">WhatsApp</span></label>
                                  <input
                                    type="tel"
                                    placeholder="(00) 00000-0000"
                                    className="input input-bordered input-sm"
                                    value={editUnidadeForm.whatsapp}
                                    onChange={(e) => setEditUnidadeForm({ ...editUnidadeForm, whatsapp: aplicarMascaraTelefone(e.target.value) })}
                                    maxLength={15}
                                  />
                                </div>
                              </div>
                              {auditoresSelecionadosCliente.length > 0 && (
                                <MultiSelectAuditores
                                  auditores={auditoresSelecionadosCliente}
                                  selecionados={editUnidadeForm.auditorIds}
                                  onChange={(ids) => setEditUnidadeForm({ ...editUnidadeForm, auditorIds: ids })}
                                  label="Auditores da Unidade"
                                  size="sm"
                                />
                              )}
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  onClick={handleCancelarEditUnidade}
                                  disabled={savingUnidade}
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm gap-1"
                                  onClick={handleSalvarUnidadeExistente}
                                  disabled={
                                    savingUnidade ||
                                    !editUnidadeForm.nome ||
                                    !editUnidadeForm.endereco ||
                                    !editUnidadeForm.email ||
                                    !editUnidadeForm.responsavel ||
                                    (editUnidadeForm.email ? !emailValido(editUnidadeForm.email) : false)
                                  }
                                >
                                  {savingUnidade ? (
                                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</>
                                  ) : (
                                    <><Check className="w-3.5 h-3.5" /> Salvar</>
                                  )}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2.5 bg-base-200/30 rounded-lg space-y-1 group">
                              <div className="flex items-center gap-3">
                                <MapPin className="w-4 h-4 text-secondary shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{unidade.nome}</p>
                                  <p className="text-xs text-base-content/60 truncate">
                                    {unidade.endereco} — {unidade.cidade}, {unidade.estado}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleEditarUnidadeExistente(unidade)}
                                  className="btn btn-ghost btn-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="ml-7 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-base-content/60">
                                {unidade.responsavel && <span>Responsável: {unidade.responsavel}</span>}
                                {unidade.email && <span>E-mail: {unidade.email}</span>}
                                {unidade.whatsapp && <span>WhatsApp: {aplicarMascaraTelefone(unidade.whatsapp)}</span>}
                              </div>
                              {unidade.auditores && unidade.auditores.length > 0 && (
                                <div className="ml-7 flex flex-wrap gap-1">
                                  {unidade.auditores.map((a) => (
                                    <span key={a.id} className="badge badge-xs badge-outline">{a.nome}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    {showInlineUnidadeForm && (
                      <div className="mt-3 p-3 border border-base-300 rounded-lg bg-base-200/20 space-y-3">
                        <p className="text-xs font-medium text-base-content/70">Nova unidade</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">Nome *</span></label>
                            <input
                              type="text"
                              placeholder="Nome da unidade"
                              className="input input-bordered input-sm"
                              value={inlineUnidadeForm.nome}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, nome: e.target.value })}
                            />
                          </div>
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">Endereço *</span></label>
                            <input
                              type="text"
                              placeholder="Rua, número, bairro"
                              className="input input-bordered input-sm"
                              value={inlineUnidadeForm.endereco}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, endereco: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">Cidade *</span></label>
                            <input
                              type="text"
                              placeholder="Cidade"
                              className="input input-bordered input-sm"
                              value={inlineUnidadeForm.cidade}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, cidade: e.target.value })}
                            />
                          </div>
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">Estado *</span></label>
                            <input
                              type="text"
                              placeholder="UF"
                              className="input input-bordered input-sm"
                              maxLength={2}
                              value={inlineUnidadeForm.estado}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, estado: e.target.value.toUpperCase() })}
                            />
                          </div>
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">CEP</span></label>
                            <input
                              type="text"
                              placeholder="00000-000"
                              className="input input-bordered input-sm"
                              value={inlineUnidadeForm.cep}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, cep: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">E-mail da Unidade *</span></label>
                            <input
                              type="email"
                              placeholder="email@unidade.com"
                              className={`input input-bordered input-sm ${inlineUnidadeForm.email && !emailValido(inlineUnidadeForm.email) ? 'input-error' : ''}`}
                              value={inlineUnidadeForm.email}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, email: e.target.value })}
                            />
                          </div>
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">Responsável *</span></label>
                            <input
                              type="text"
                              placeholder="Nome do responsável"
                              className="input input-bordered input-sm"
                              value={inlineUnidadeForm.responsavel}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, responsavel: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">WhatsApp</span></label>
                            <input
                              type="tel"
                              placeholder="(00) 00000-0000"
                              className="input input-bordered input-sm"
                              value={inlineUnidadeForm.whatsapp}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, whatsapp: aplicarMascaraTelefone(e.target.value) })}
                              maxLength={15}
                            />
                          </div>
                        </div>
                        {auditoresSelecionadosCliente.length > 0 && (
                          <MultiSelectAuditores
                            auditores={auditoresSelecionadosCliente}
                            selecionados={inlineUnidadeForm.auditorIds || []}
                            onChange={(ids) => setInlineUnidadeForm({ ...inlineUnidadeForm, auditorIds: ids })}
                            label="Auditores da Unidade"
                            size="sm"
                          />
                        )}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setShowInlineUnidadeForm(false);
                              setEditingInlineUnidadeId(null);
                              setInlineUnidadeForm({ ...INLINE_UNIDADE_INICIAL });
                            }}
                            disabled={savingUnidade}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm gap-1"
                            onClick={() => handleSalvarInlineUnidade()}
                            disabled={
                              savingUnidade ||
                              !inlineUnidadeForm.nome ||
                              !inlineUnidadeForm.endereco ||
                              !inlineUnidadeForm.cidade ||
                              !inlineUnidadeForm.estado ||
                              !inlineUnidadeForm.email ||
                              !inlineUnidadeForm.responsavel ||
                              (inlineUnidadeForm.email ? !emailValido(inlineUnidadeForm.email) : false)
                            }
                          >
                            {savingUnidade ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</>
                            ) : (
                              <><Check className="w-3.5 h-3.5" /> Adicionar</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                    {!showInlineUnidadeForm && (editingCliente?.unidades?.length || 0) > 0 && (
                      <button type="button" className="btn btn-outline btn-sm gap-1 mt-2" onClick={handleAdicionarInlineUnidade}>
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar outra unidade
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {unidadesPendentes.length === 0 && !showInlineUnidadeForm && (
                        <p className="text-sm text-base-content/50 py-4 text-center">
                          Nenhuma unidade adicionada. Adicione pelo menos uma unidade para salvar o cliente.
                        </p>
                      )}
                      {unidadesPendentes.map((unidade) => (
                        <div key={unidade.tempId} className="p-2.5 bg-base-200/30 rounded-lg group space-y-1">
                          <div className="flex items-center gap-3">
                            <MapPin className="w-4 h-4 text-secondary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{unidade.nome}</p>
                              <p className="text-xs text-base-content/60 truncate">
                                {unidade.endereco}{unidade.cidade ? ` — ${unidade.cidade}` : ''}{unidade.estado ? `, ${unidade.estado}` : ''}
                              </p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={() => handleEditarInlineUnidade(unidade.tempId)} className="btn btn-ghost btn-xs">
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button type="button" onClick={() => handleRemoverInlineUnidade(unidade.tempId)} className="btn btn-ghost btn-xs text-error">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="ml-7 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-base-content/60">
                            {unidade.responsavel && <span>Responsável: {unidade.responsavel}</span>}
                            {unidade.email && <span>E-mail: {unidade.email}</span>}
                            {unidade.whatsapp && <span>WhatsApp: {aplicarMascaraTelefone(unidade.whatsapp)}</span>}
                          </div>
                          {unidade.auditorIds && unidade.auditorIds.length > 0 && (
                            <div className="ml-7 flex flex-wrap gap-1">
                              {auditores
                                .filter((a) => unidade.auditorIds?.includes(a.id))
                                .map((a) => (
                                  <span key={a.id} className="badge badge-xs badge-outline">{a.nome}</span>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {showInlineUnidadeForm && (
                      <div className="mt-3 p-3 border border-base-300 rounded-lg bg-base-200/20 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">Nome *</span></label>
                            <input
                              type="text"
                              placeholder="Nome da unidade"
                              className="input input-bordered input-sm"
                              value={inlineUnidadeForm.nome}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, nome: e.target.value })}
                            />
                          </div>
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">Endereço *</span></label>
                            <input
                              type="text"
                              placeholder="Rua, número, bairro"
                              className="input input-bordered input-sm"
                              value={inlineUnidadeForm.endereco}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, endereco: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">Cidade *</span></label>
                            <input
                              type="text"
                              placeholder="Cidade"
                              className="input input-bordered input-sm"
                              value={inlineUnidadeForm.cidade}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, cidade: e.target.value })}
                            />
                          </div>
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">Estado *</span></label>
                            <input
                              type="text"
                              placeholder="UF"
                              className="input input-bordered input-sm"
                              maxLength={2}
                              value={inlineUnidadeForm.estado}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, estado: e.target.value.toUpperCase() })}
                            />
                          </div>
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">CEP</span></label>
                            <input
                              type="text"
                              placeholder="00000-000"
                              className="input input-bordered input-sm"
                              value={inlineUnidadeForm.cep}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, cep: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">E-mail da Unidade *</span></label>
                            <input
                              type="email"
                              placeholder="email@unidade.com"
                              className={`input input-bordered input-sm ${inlineUnidadeForm.email && !emailValido(inlineUnidadeForm.email) ? 'input-error' : ''}`}
                              value={inlineUnidadeForm.email}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, email: e.target.value })}
                            />
                          </div>
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">Responsável *</span></label>
                            <input
                              type="text"
                              placeholder="Nome do responsável"
                              className="input input-bordered input-sm"
                              value={inlineUnidadeForm.responsavel}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, responsavel: e.target.value })}
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="form-control">
                            <label className="label py-1"><span className="label-text text-xs">WhatsApp</span></label>
                            <input
                              type="tel"
                              placeholder="(00) 00000-0000"
                              className="input input-bordered input-sm"
                              value={inlineUnidadeForm.whatsapp}
                              onChange={(e) => setInlineUnidadeForm({ ...inlineUnidadeForm, whatsapp: aplicarMascaraTelefone(e.target.value) })}
                              maxLength={15}
                            />
                          </div>
                        </div>
                        {auditoresSelecionadosCliente.length > 0 && (
                          <MultiSelectAuditores
                            auditores={auditoresSelecionadosCliente}
                            selecionados={inlineUnidadeForm.auditorIds}
                            onChange={(ids) => setInlineUnidadeForm({ ...inlineUnidadeForm, auditorIds: ids })}
                            label="Auditores da Unidade"
                            size="sm"
                          />
                        )}
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              setShowInlineUnidadeForm(false);
                              setEditingInlineUnidadeId(null);
                              setInlineUnidadeForm({ ...INLINE_UNIDADE_INICIAL });
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm gap-1"
                            onClick={handleSalvarInlineUnidade}
                            disabled={
                              !inlineUnidadeForm.nome ||
                              !inlineUnidadeForm.endereco ||
                              !inlineUnidadeForm.cidade ||
                              !inlineUnidadeForm.estado ||
                              !inlineUnidadeForm.email ||
                              !inlineUnidadeForm.responsavel ||
                              (inlineUnidadeForm.email ? !emailValido(inlineUnidadeForm.email) : false)
                            }
                          >
                            <Check className="w-3.5 h-3.5" />
                            {editingInlineUnidadeId ? 'Atualizar' : 'Adicionar'}
                          </button>
                        </div>
                      </div>
                    )}
                    {!showInlineUnidadeForm && unidadesPendentes.length > 0 && (
                      <button type="button" className="btn btn-outline btn-sm gap-1 mt-2" onClick={handleAdicionarInlineUnidade}>
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar outra unidade
                      </button>
                    )}
                  </>
                )}
              </div>
        </div>
      </FormModal>

      <LogoCropperModal
        open={cropperOpen}
        imageSource={cropperImageUrl}
        onClose={handleCropperClose}
        onConfirm={handleCropperConfirm}
        title="Ajustar imagem da logo do cliente"
      />

      <ConfirmDialog
        open={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Remover Cliente"
        message="Tem certeza que deseja remover este cliente? Todas as unidades vinculadas também serão removidas. Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="danger"
        loading={isDeleting}
      />

      <ConfirmDialog
        open={showAvisoTrocaAuditor}
        onClose={() => {
          setShowAvisoTrocaAuditor(false);
          setDadosPendentesUpdate(null);
          setAvisoTrocaInfo(null);
        }}
        onConfirm={handleConfirmarTrocaAuditor}
        title="Auditorias em andamento"
        message={
          avisoTrocaInfo
            ? `Existem ${avisoTrocaInfo.quantidade} auditoria(s) em andamento com auditores que estão sendo removidos deste cliente. Eles poderão finalizá-las, mas não poderão iniciar novas auditorias.`
            : ''
        }
        confirmLabel="Continuar"
        cancelLabel="Cancelar"
        variant="warning"
        loading={saving}
      />
    </AppLayout>
  );
}

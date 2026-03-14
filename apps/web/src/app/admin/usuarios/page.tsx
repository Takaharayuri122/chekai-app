'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Plus,
  Loader2,
  Shield,
  UserCheck,
  Edit,
  Trash2,
  Search,
  Filter,
  Send,
} from 'lucide-react';
import { AppLayout, PageHeader, EmptyState, ConfirmDialog, FormModal } from '@/components';
import {
  usuarioService,
  planoService,
  Usuario,
  Plano,
  PerfilUsuario,
  StatusUsuario,
  CriarUsuarioRequest,
} from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';

const PERFIL_LABELS: Record<PerfilUsuario, string> = {
  [PerfilUsuario.MASTER]: 'Master',
  [PerfilUsuario.GESTOR]: 'Gestor',
  [PerfilUsuario.AUDITOR]: 'Auditor',
};

const PERFIL_ICONS: Record<PerfilUsuario, typeof User> = {
  [PerfilUsuario.MASTER]: Shield,
  [PerfilUsuario.GESTOR]: UserCheck,
  [PerfilUsuario.AUDITOR]: User,
};

const STATUS_CONFIG: Record<StatusUsuario, { label: string; className: string }> = {
  [StatusUsuario.ATIVO]: { label: 'Ativo', className: 'badge-success' },
  [StatusUsuario.NAO_CONFIRMADO]: { label: 'Não Confirmado', className: 'badge-warning' },
  [StatusUsuario.INATIVO]: { label: 'Inativo', className: 'badge-error' },
};

export default function UsuariosPage() {
  const router = useRouter();
  const { isMaster, isGestor, usuario } = useAuthStore();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [gestores, setGestores] = useState<Usuario[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [saving, setSaving] = useState(false);
  const [filtroPerfil, setFiltroPerfil] = useState<PerfilUsuario | 'todos'>('todos');
  const [busca, setBusca] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reenviandoConviteId, setReenviandoConviteId] = useState<string | null>(null);

  const [usuarioForm, setUsuarioForm] = useState<CriarUsuarioRequest>({
    nome: '',
    email: '',
    telefone: '',
    perfil: isGestor() ? PerfilUsuario.AUDITOR : PerfilUsuario.GESTOR,
    gestorId: isGestor() && !isMaster() ? usuario?.id : undefined,
  });

  useEffect(() => {
    if (!isMaster() && !isGestor()) {
      router.push('/admin/dashboard');
      return;
    }
    carregarUsuarios();
  }, [isMaster, isGestor, router]);

  useEffect(() => {
    if (showModal && !editingUsuario && isGestor() && !isMaster() && usuario?.id) {
      if (usuarioForm.perfil === PerfilUsuario.AUDITOR && !usuarioForm.gestorId) {
        setUsuarioForm(prev => ({
          ...prev,
          gestorId: usuario.id,
        }));
      }
    }
  }, [showModal, editingUsuario, isGestor, isMaster, usuario?.id, usuarioForm.perfil, usuarioForm.gestorId]);

  const aplicarMascaraTelefone = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 10) {
      return apenasNumeros
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    } else if (apenasNumeros.length <= 11) {
      return apenasNumeros
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return valor;
  };

  const removerMascaraTelefone = (valor: string) => {
    return valor.replace(/\D/g, '');
  };

  const carregarUsuarios = async () => {
    try {
      const response = await usuarioService.listar(1, 100);
      setUsuarios(response.items || []);
      const gestoresResponse = await usuarioService.listar(1, 100, PerfilUsuario.GESTOR);
      setGestores(gestoresResponse.items || []);
      if (isMaster()) {
        const planosResponse = await planoService.listar(1, 100);
        setPlanos((planosResponse.items || []).filter((p) => p.ativo));
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleCriarUsuario = async () => {
    if (!usuarioForm.nome || !usuarioForm.email) return;
    if (!usuarioForm.telefone) {
      toastService.warning('O WhatsApp é obrigatório');
      return;
    }
    setSaving(true);
    try {
      if (editingUsuario) {
        const dadosParaEnviar: Partial<CriarUsuarioRequest> = {
          ...usuarioForm,
          telefone: usuarioForm.telefone ? removerMascaraTelefone(usuarioForm.telefone) : undefined,
        };
        await usuarioService.atualizar(editingUsuario.id, dadosParaEnviar);
        toastService.success('Usuário atualizado com sucesso!');
      } else {
        const dadosParaEnviar: CriarUsuarioRequest = {
          ...usuarioForm,
          gestorId: isGestor() && !isMaster() && usuarioForm.perfil === PerfilUsuario.AUDITOR
            ? (usuarioForm.gestorId || usuario?.id)
            : usuarioForm.gestorId,
        };
        await usuarioService.criar(dadosParaEnviar);
        toastService.success('Convite enviado com sucesso!');
      }
      await carregarUsuarios();
      handleFecharModal();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  const handleEditarUsuario = (usuarioItem: Usuario) => {
    if (isGestor() && !isMaster()) {
      if (usuarioItem.gestorId !== usuario?.id && usuarioItem.id !== usuario?.id) {
        toastService.error('Você só pode editar seus próprios auditores');
        return;
      }
      if (usuarioItem.perfil !== PerfilUsuario.AUDITOR) {
        toastService.error('Você só pode editar auditores');
        return;
      }
    }
    setEditingUsuario(usuarioItem);
    setUsuarioForm({
      nome: usuarioItem.nome,
      email: usuarioItem.email,
      telefone: usuarioItem.telefone ? aplicarMascaraTelefone(usuarioItem.telefone) : '',
      perfil: usuarioItem.perfil,
      gestorId: usuarioItem.gestorId || undefined,
    });
    setShowModal(true);
  };

  const handleFecharModal = () => {
    setShowModal(false);
    setEditingUsuario(null);
    setUsuarioForm({
      nome: '',
      email: '',
      telefone: '',
      perfil: isGestor() ? PerfilUsuario.AUDITOR : PerfilUsuario.GESTOR,
      gestorId: isGestor() && !isMaster() ? usuario?.id : undefined,
    });
  };

  const handleDeleteClick = (id: string) => {
    setShowDeleteConfirm(id);
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteConfirm) return;
    try {
      setDeletingId(showDeleteConfirm);
      await usuarioService.remover(showDeleteConfirm);
      toastService.success('Usuário removido com sucesso!');
      await carregarUsuarios();
      setShowDeleteConfirm(null);
    } catch {
    } finally {
      setDeletingId(null);
    }
  };

  const handleReenviarConvite = async (id: string) => {
    setReenviandoConviteId(id);
    try {
      await usuarioService.reenviarConvite(id);
      toastService.success('Convite reenviado com sucesso!');
    } catch {
    } finally {
      setReenviandoConviteId(null);
    }
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    const matchPerfil = filtroPerfil === 'todos' || u.perfil === filtroPerfil;
    const matchBusca =
      !busca ||
      u.nome.toLowerCase().includes(busca.toLowerCase()) ||
      u.email.toLowerCase().includes(busca.toLowerCase());
    return matchPerfil && matchBusca;
  });

  if (!isMaster() && !isGestor()) {
    return null;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Usuários"
        subtitle="Gerencie usuários do sistema"
        action={
          <button
            className="btn btn-primary gap-2"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-4 h-4" />
            Convidar Usuário
          </button>
        }
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              className="input input-bordered w-full pl-10"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="dropdown dropdown-end sm:dropdown-bottom">
            <div tabIndex={0} role="button" className="btn btn-outline gap-2">
              <Filter className="w-4 h-4" />
              {filtroPerfil !== 'todos' && PERFIL_LABELS[filtroPerfil]}
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52 border border-base-300"
            >
              <li>
                <button
                  className={filtroPerfil === 'todos' ? 'active' : ''}
                  onClick={() => setFiltroPerfil('todos')}
                >
                  Todos os perfis
                </button>
              </li>
              {Object.values(PerfilUsuario).map((perfil) => (
                <li key={perfil}>
                  <button
                    className={filtroPerfil === perfil ? 'active' : ''}
                    onClick={() => setFiltroPerfil(perfil)}
                  >
                    {PERFIL_LABELS[perfil]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {loading ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <EmptyState
            icon={User}
            title="Nenhum usuário encontrado"
            description={
              busca || filtroPerfil !== 'todos'
                ? 'Tente ajustar os filtros de busca.'
                : 'Comece convidando um novo usuário'
            }
            actionLabel={!busca && filtroPerfil === 'todos' ? 'Convidar Usuário' : undefined}
            actionOnClick={() => setShowModal(true)}
          />
        ) : (
          <div className="card bg-base-100 shadow-sm border border-base-300 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>E-mail</th>
                    <th>Perfil</th>
                    <th>WhatsApp</th>
                    <th>Status</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((usuarioItem) => {
                    const Icon = PERFIL_ICONS[usuarioItem.perfil];
                    const statusConfig = STATUS_CONFIG[usuarioItem.status] || STATUS_CONFIG[StatusUsuario.ATIVO];
                    return (
                      <tr key={usuarioItem.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="avatar placeholder">
                              <div className="bg-primary text-primary-content rounded-full w-10">
                                <Icon className="w-5 h-5" />
                              </div>
                            </div>
                            <div className="font-medium">{usuarioItem.nome}</div>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm">{usuarioItem.email}</span>
                        </td>
                        <td>
                          <span className="badge badge-outline">
                            {PERFIL_LABELS[usuarioItem.perfil]}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm text-base-content/60">
                            {usuarioItem.telefone ? aplicarMascaraTelefone(usuarioItem.telefone) : '-'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge badge-sm ${statusConfig.className}`}>
                            {statusConfig.label}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            {usuarioItem.status === StatusUsuario.NAO_CONFIRMADO && (
                              <button
                                className="btn btn-ghost btn-xs gap-1 text-info"
                                onClick={() => handleReenviarConvite(usuarioItem.id)}
                                disabled={reenviandoConviteId === usuarioItem.id}
                                title="Reenviar convite"
                              >
                                {reenviandoConviteId === usuarioItem.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Send className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            {(!isGestor() || isMaster() || (usuarioItem.gestorId === usuario?.id && usuarioItem.perfil === PerfilUsuario.AUDITOR)) && (
                              <button
                                className="btn btn-ghost btn-xs gap-1"
                                onClick={() => handleEditarUsuario(usuarioItem)}
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {(!isGestor() || isMaster()) && (
                              <button
                                className="btn btn-ghost btn-xs gap-1 text-error"
                                onClick={() => handleDeleteClick(usuarioItem.id)}
                                disabled={deletingId === usuarioItem.id}
                                title="Remover"
                              >
                                {deletingId === usuarioItem.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <FormModal
        open={showModal}
        onClose={handleFecharModal}
        title={editingUsuario ? 'Editar Usuário' : 'Convidar Usuário'}
        maxWidth="2xl"
        isDirty={Boolean(usuarioForm.nome || usuarioForm.email || usuarioForm.telefone)}
        footer={
          <>
            <button
              className="btn btn-ghost"
              onClick={handleFecharModal}
            >
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              onClick={handleCriarUsuario}
              disabled={
                saving ||
                !usuarioForm.nome ||
                !usuarioForm.email ||
                !usuarioForm.telefone ||
                (usuarioForm.perfil === PerfilUsuario.AUDITOR &&
                 !usuarioForm.gestorId &&
                 !(isGestor() && !isMaster() && !editingUsuario && usuario?.id)) ||
                (isMaster() && usuarioForm.perfil === PerfilUsuario.GESTOR && !editingUsuario && !usuarioForm.planoId)
              }
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingUsuario ? (
                'Salvar'
              ) : (
                'Enviar Convite'
              )}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text">Nome</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={usuarioForm.nome}
              onChange={(e) =>
                setUsuarioForm({ ...usuarioForm, nome: e.target.value })
              }
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">E-mail</span>
            </label>
            <input
              type="email"
              className="input input-bordered"
              value={usuarioForm.email}
              onChange={(e) =>
                setUsuarioForm({ ...usuarioForm, email: e.target.value })
              }
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">Perfil</span>
            </label>
            <select
              className="select select-bordered"
              value={usuarioForm.perfil}
              disabled={isGestor() && !isMaster() && !editingUsuario}
              onChange={(e) => {
                const novoPerfil = e.target.value as PerfilUsuario;
                const perfilFinal = isGestor() && !isMaster() && !editingUsuario
                  ? PerfilUsuario.AUDITOR
                  : novoPerfil;
                const novoGestorId = perfilFinal === PerfilUsuario.AUDITOR && isGestor() && !isMaster() && !editingUsuario
                  ? usuario?.id
                  : perfilFinal === PerfilUsuario.AUDITOR
                    ? usuarioForm.gestorId
                    : undefined;
                setUsuarioForm({
                  ...usuarioForm,
                  perfil: perfilFinal,
                  gestorId: novoGestorId,
                });
              }}
            >
              {Object.values(PerfilUsuario).map((perfil) => {
                if (isGestor() && !isMaster() && !editingUsuario && perfil !== PerfilUsuario.AUDITOR) {
                  return null;
                }
                return (
                  <option key={perfil} value={perfil}>
                    {PERFIL_LABELS[perfil]}
                  </option>
                );
              })}
            </select>
            {isGestor() && !isMaster() && !editingUsuario && (
              <label className="label">
                <span className="label-text-alt text-base-content/60">
                  Gestores só podem criar usuários com perfil Auditor
                </span>
              </label>
            )}
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text">WhatsApp *</span>
            </label>
            <input
              type="tel"
              className="input input-bordered"
              placeholder="(00) 00000-0000"
              value={usuarioForm.telefone || ''}
              onChange={(e) => {
                const valorFormatado = aplicarMascaraTelefone(e.target.value);
                setUsuarioForm({ ...usuarioForm, telefone: valorFormatado });
              }}
              maxLength={15}
              required
            />
          </div>
          {usuarioForm.perfil === PerfilUsuario.AUDITOR && (
            <div className="form-control">
              <label className="label">
                <span className="label-text">Gestor Responsável *</span>
              </label>
              <select
                className="select select-bordered"
                value={usuarioForm.gestorId || ''}
                disabled={isGestor() && !isMaster() && !editingUsuario}
                onChange={(e) =>
                  setUsuarioForm({
                    ...usuarioForm,
                    gestorId: e.target.value || undefined,
                  })
                }
                required={!(isGestor() && !isMaster() && !editingUsuario)}
              >
                <option value="">Selecione um gestor</option>
                {gestores.map((gestor) => (
                  <option key={gestor.id} value={gestor.id}>
                    {gestor.nome} ({gestor.email})
                  </option>
                ))}
              </select>
              {isGestor() && !isMaster() && !editingUsuario && (
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    O auditor será automaticamente vinculado a você
                  </span>
                </label>
              )}
            </div>
          )}
          {isMaster() && usuarioForm.perfil === PerfilUsuario.GESTOR && !editingUsuario && (
            <div className="form-control">
              <label className="label">
                <span className="label-text">Plano / Assinatura *</span>
              </label>
              <select
                className="select select-bordered"
                value={usuarioForm.planoId || ''}
                onChange={(e) =>
                  setUsuarioForm({
                    ...usuarioForm,
                    planoId: e.target.value || undefined,
                  })
                }
                required
              >
                <option value="">Selecione um plano</option>
                {planos.map((plano) => (
                  <option key={plano.id} value={plano.id}>
                    {plano.nome}
                  </option>
                ))}
              </select>
            </div>
          )}
          {!editingUsuario && (
            <div className="alert alert-info">
              <Send className="w-4 h-4" />
              <span className="text-sm">Um convite será enviado por e-mail para que o usuário aceite e configure seu acesso.</span>
            </div>
          )}
        </div>
      </FormModal>

      <ConfirmDialog
        open={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Remover Usuário"
        message="Tem certeza que deseja remover este usuário? Esta ação não pode ser desfeita. O usuário só pode ser removido se não houver auditorias, outros usuários ou clientes vinculados a ele."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deletingId !== null}
      />
    </AppLayout>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Plus,
  Loader2,
  Shield,
  UserCheck,
  Building2,
  Eye,
  EyeOff,
  Edit,
  Trash2,
  Search,
  Filter,
} from 'lucide-react';
import { AppLayout, PageHeader, EmptyState } from '@/components';
import {
  usuarioService,
  Usuario,
  PerfilUsuario,
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

export default function UsuariosPage() {
  const router = useRouter();
  const { isMaster, isGestor, usuario } = useAuthStore();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [gestores, setGestores] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState<Usuario | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [filtroPerfil, setFiltroPerfil] = useState<PerfilUsuario | 'todos'>('todos');
  const [busca, setBusca] = useState('');

  const [usuarioForm, setUsuarioForm] = useState<CriarUsuarioRequest>({
    nome: '',
    email: '',
    senha: '',
    telefone: '',
    perfil: isGestor() ? PerfilUsuario.AUDITOR : PerfilUsuario.GESTOR,
    gestorId: isGestor() && !isMaster() ? usuario?.id : undefined,
  });

  useEffect(() => {
    if (!isMaster() && !isGestor()) {
      router.push('/dashboard');
      return;
    }
    carregarUsuarios();
  }, [isMaster, isGestor, router]);

  // Garante que gestorId está preenchido quando Gestor abre o modal para criar
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

  // Função para aplicar máscara de telefone
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

  // Função para remover máscara do telefone
  const removerMascaraTelefone = (valor: string) => {
    return valor.replace(/\D/g, '');
  };

  const carregarUsuarios = async () => {
    try {
      const response = await usuarioService.listar(1, 100);
      setUsuarios(response.items || []);
      // Carregar gestores para o select
      const gestoresResponse = await usuarioService.listar(1, 100, PerfilUsuario.GESTOR);
      setGestores(gestoresResponse.items || []);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  };

  const handleCriarUsuario = async () => {
    if (!usuarioForm.nome || !usuarioForm.email) return;
    if (!editingUsuario && !usuarioForm.senha) return;
    if (!usuarioForm.telefone) {
      toastService.warning('O WhatsApp é obrigatório');
      return;
    }
    setSaving(true);

    try {
      if (editingUsuario) {
        const dadosParaEnviar: Partial<CriarUsuarioRequest> = { 
          ...usuarioForm,
          // Remove máscara do telefone antes de enviar
          telefone: usuarioForm.telefone ? removerMascaraTelefone(usuarioForm.telefone) : undefined,
        };
        // Se não forneceu senha, remover do payload
        if (!dadosParaEnviar.senha) {
          const { senha, ...dadosSemSenha } = dadosParaEnviar;
          await usuarioService.atualizar(editingUsuario.id, dadosSemSenha);
        } else {
          await usuarioService.atualizar(editingUsuario.id, dadosParaEnviar);
        }
        toastService.success('Usuário atualizado com sucesso!');
      } else {
        const dadosParaEnviar: CriarUsuarioRequest = { 
          ...usuarioForm,
          // Garante que gestorId está preenchido quando Gestor cria Auditor
          gestorId: isGestor() && !isMaster() && usuarioForm.perfil === PerfilUsuario.AUDITOR
            ? (usuarioForm.gestorId || usuario?.id)
            : usuarioForm.gestorId,
        };
        await usuarioService.criar(dadosParaEnviar);
        toastService.success('Usuário criado com sucesso!');
      }
      await carregarUsuarios();
      handleFecharModal();
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setSaving(false);
    }
  };

  const handleEditarUsuario = (usuarioItem: Usuario) => {
    // Gestor só pode editar seus próprios auditores
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
      senha: '',
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
      senha: '',
      telefone: '',
      perfil: isGestor() ? PerfilUsuario.AUDITOR : PerfilUsuario.GESTOR,
      gestorId: isGestor() && !isMaster() ? usuario?.id : undefined,
    });
  };

  const handleRemoverUsuario = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este usuário?')) return;

    try {
      await usuarioService.remover(id);
      toastService.success('Usuário removido com sucesso!');
      await carregarUsuarios();
    } catch (error) {
      // Erro já é tratado pelo interceptor
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
            Novo Usuário
          </button>
        }
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {/* Filtros e Busca */}
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

        {/* Tabela */}
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
                : 'Comece criando um novo usuário'
            }
            actionLabel={!busca && filtroPerfil === 'todos' ? 'Novo Usuário' : undefined}
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
                          {usuarioItem.ativo ? (
                            <span className="badge badge-success badge-sm">Ativo</span>
                          ) : (
                            <span className="badge badge-error badge-sm">Inativo</span>
                          )}
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            {/* Gestor só pode editar seus próprios auditores */}
                            {(!isGestor() || isMaster() || (usuarioItem.gestorId === usuario?.id && usuarioItem.perfil === PerfilUsuario.AUDITOR)) && (
                              <button
                                className="btn btn-ghost btn-xs gap-1"
                                onClick={() => handleEditarUsuario(usuarioItem)}
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {/* Gestor não pode remover usuários */}
                            {(!isGestor() || isMaster()) && (
                              <button
                                className="btn btn-ghost btn-xs gap-1 text-error"
                                onClick={() => handleRemoverUsuario(usuarioItem.id)}
                                title="Remover"
                              >
                                <Trash2 className="w-4 h-4" />
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

      {/* Modal de criação/edição */}
      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl">
            <h3 className="font-bold text-lg mb-4">
              {editingUsuario ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>
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
                  <span className="label-text">Senha {editingUsuario && '(deixe em branco para manter)'}</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input input-bordered w-full pr-10"
                    value={usuarioForm.senha}
                    onChange={(e) =>
                      setUsuarioForm({ ...usuarioForm, senha: e.target.value })
                    }
                    placeholder={editingUsuario ? 'Deixe em branco para manter a senha atual' : ''}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
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
                    // Se for Gestor criando, força AUDITOR
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
                    // Gestor só pode criar Auditores
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
            </div>
            <div className="modal-action">
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
                  (!editingUsuario && !usuarioForm.senha) ||
                  !usuarioForm.telefone ||
                  (usuarioForm.perfil === PerfilUsuario.AUDITOR && 
                   !usuarioForm.gestorId && 
                   !(isGestor() && !isMaster() && !editingUsuario && usuario?.id))
                }
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : editingUsuario ? (
                  'Salvar'
                ) : (
                  'Criar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}


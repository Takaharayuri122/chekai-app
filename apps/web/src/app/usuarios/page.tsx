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

const PERFIL_LABELS: Record<PerfilUsuario, string> = {
  [PerfilUsuario.MASTER]: 'Master',
  [PerfilUsuario.ANALISTA]: 'Analista',
  [PerfilUsuario.AUDITOR]: 'Auditor',
  [PerfilUsuario.EMPRESA]: 'Empresa',
};

const PERFIL_ICONS: Record<PerfilUsuario, typeof User> = {
  [PerfilUsuario.MASTER]: Shield,
  [PerfilUsuario.ANALISTA]: UserCheck,
  [PerfilUsuario.AUDITOR]: User,
  [PerfilUsuario.EMPRESA]: Building2,
};

export default function UsuariosPage() {
  const router = useRouter();
  const { isMaster } = useAuthStore();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [analistas, setAnalistas] = useState<Usuario[]>([]);
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
    perfil: PerfilUsuario.ANALISTA,
  });

  useEffect(() => {
    if (!isMaster()) {
      router.push('/dashboard');
      return;
    }
    carregarUsuarios();
  }, [isMaster, router]);

  const carregarUsuarios = async () => {
    try {
      const response = await usuarioService.listar(1, 100);
      setUsuarios(response.items || []);
      // Carregar analistas para o select
      const analistasResponse = await usuarioService.listar(1, 100, PerfilUsuario.ANALISTA);
      setAnalistas(analistasResponse.items || []);
    } catch {
      // Erro silencioso
    } finally {
      setLoading(false);
    }
  };

  const handleCriarUsuario = async () => {
    if (!usuarioForm.nome || !usuarioForm.email) return;
    if (!editingUsuario && !usuarioForm.senha) return;
    setSaving(true);

    try {
      const dadosParaEnviar = { ...usuarioForm };
      // Se estiver editando e não forneceu senha, remover do payload
      if (editingUsuario && !dadosParaEnviar.senha) {
        delete dadosParaEnviar.senha;
      }
      
      if (editingUsuario) {
        await usuarioService.atualizar(editingUsuario.id, dadosParaEnviar);
      } else {
        await usuarioService.criar(dadosParaEnviar);
      }
      await carregarUsuarios();
      handleFecharModal();
    } catch {
      // Erro silencioso
    } finally {
      setSaving(false);
    }
  };

  const handleEditarUsuario = (usuario: Usuario) => {
    setEditingUsuario(usuario);
    setUsuarioForm({
      nome: usuario.nome,
      email: usuario.email,
      senha: '',
      telefone: usuario.telefone || '',
      perfil: usuario.perfil,
      analistaId: usuario.analistaId || undefined,
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
      perfil: PerfilUsuario.ANALISTA,
    });
  };

  const handleRemoverUsuario = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este usuário?')) return;

    try {
      await usuarioService.remover(id);
      await carregarUsuarios();
    } catch {
      // Erro silencioso
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

  if (!isMaster()) {
    return null;
  }

  return (
    <AppLayout>
      <PageHeader
        title="Usuários"
        description="Gerencie usuários do sistema"
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
                    <th>Telefone</th>
                    <th>Status</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosFiltrados.map((usuario) => {
                    const Icon = PERFIL_ICONS[usuario.perfil];
                    return (
                      <tr key={usuario.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="avatar placeholder">
                              <div className="bg-primary text-primary-content rounded-full w-10">
                                <Icon className="w-5 h-5" />
                              </div>
                            </div>
                            <div className="font-medium">{usuario.nome}</div>
                          </div>
                        </td>
                        <td>
                          <span className="text-sm">{usuario.email}</span>
                        </td>
                        <td>
                          <span className="badge badge-outline">
                            {PERFIL_LABELS[usuario.perfil]}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm text-base-content/60">
                            {usuario.telefone || '-'}
                          </span>
                        </td>
                        <td>
                          {usuario.ativo ? (
                            <span className="badge badge-success badge-sm">Ativo</span>
                          ) : (
                            <span className="badge badge-error badge-sm">Inativo</span>
                          )}
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <button
                              className="btn btn-ghost btn-xs gap-1"
                              onClick={() => handleEditarUsuario(usuario)}
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              className="btn btn-ghost btn-xs gap-1 text-error"
                              onClick={() => handleRemoverUsuario(usuario.id)}
                              title="Remover"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
                  onChange={(e) => {
                    const novoPerfil = e.target.value as PerfilUsuario;
                    setUsuarioForm({
                      ...usuarioForm,
                      perfil: novoPerfil,
                      analistaId: novoPerfil === PerfilUsuario.AUDITOR ? usuarioForm.analistaId : undefined,
                    });
                  }}
                >
                  {Object.values(PerfilUsuario).map((perfil) => (
                    <option key={perfil} value={perfil}>
                      {PERFIL_LABELS[perfil]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Telefone (opcional)</span>
                </label>
                <input
                  type="tel"
                  className="input input-bordered"
                  value={usuarioForm.telefone || ''}
                  onChange={(e) =>
                    setUsuarioForm({ ...usuarioForm, telefone: e.target.value })
                  }
                />
              </div>
              {usuarioForm.perfil === PerfilUsuario.AUDITOR && (
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Analista Responsável *</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={usuarioForm.analistaId || ''}
                    onChange={(e) =>
                      setUsuarioForm({
                        ...usuarioForm,
                        analistaId: e.target.value || undefined,
                      })
                    }
                    required
                  >
                    <option value="">Selecione um analista</option>
                    {analistas.map((analista) => (
                      <option key={analista.id} value={analista.id}>
                        {analista.nome} ({analista.email})
                      </option>
                    ))}
                  </select>
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
                  (usuarioForm.perfil === PerfilUsuario.AUDITOR && !usuarioForm.analistaId)
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


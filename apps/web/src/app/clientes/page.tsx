'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Plus,
  MapPin,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { AppLayout, PageHeader, EmptyState } from '@/components';
import {
  clienteService,
  Cliente,
  TipoAtividade,
  TIPO_ATIVIDADE_LABELS,
} from '@/lib/api';

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCliente, setExpandedCliente] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showUnidadeModal, setShowUnidadeModal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
    } catch {
      // Erro silencioso
    } finally {
      setLoading(false);
    }
  };

  const handleCriarCliente = async () => {
    if (!clienteForm.razaoSocial || !clienteForm.cnpj) return;
    setSaving(true);

    try {
      await clienteService.criar(clienteForm);
      await carregarClientes();
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
      // Erro silencioso
    } finally {
      setSaving(false);
    }
  };

  const handleCriarUnidade = async () => {
    if (!showUnidadeModal || !unidadeForm.nome || !unidadeForm.endereco) return;
    setSaving(true);

    try {
      await clienteService.criarUnidade(showUnidadeModal, unidadeForm);
      await carregarClientes();
      setShowUnidadeModal(null);
      setUnidadeForm({ nome: '', endereco: '', cidade: '', estado: '', cep: '' });
    } catch {
      // Erro silencioso
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <PageHeader
        title="Clientes"
        subtitle="Gerencie seus clientes e unidades"
        action={
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-primary btn-sm gap-1"
          >
            <Plus className="w-4 h-4" />
            Novo
          </button>
        }
      />

      <div className="px-4 py-4 lg:px-8 space-y-4 max-w-3xl mx-auto">
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
            actionHref="#"
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
                        {cliente.cnpj} • {TIPO_ATIVIDADE_LABELS[cliente.tipoAtividade] || cliente.tipoAtividade} • {cliente.unidades?.length || 0} unidade(s)
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
                            onClick={() => setShowUnidadeModal(cliente.id)}
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
                                className="flex items-center gap-3 p-3 bg-base-100 rounded-lg"
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
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
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
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Novo Cliente</h3>
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
                  onChange={(e) =>
                    setClienteForm({ ...clienteForm, cnpj: e.target.value })
                  }
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
                    <span className="label-text">Telefone</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    className="input input-bordered"
                    value={clienteForm.telefone}
                    onChange={(e) =>
                      setClienteForm({ ...clienteForm, telefone: e.target.value })
                    }
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">E-mail</span>
                  </label>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    className="input input-bordered"
                    value={clienteForm.email}
                    onChange={(e) =>
                      setClienteForm({ ...clienteForm, email: e.target.value })
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
                onClick={handleCriarCliente}
                disabled={saving || !clienteForm.razaoSocial || !clienteForm.cnpj}
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

      {/* Modal Nova Unidade */}
      {showUnidadeModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Nova Unidade</h3>
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
                onClick={() => setShowUnidadeModal(null)}
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
                  'Salvar'
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

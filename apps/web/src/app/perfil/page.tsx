'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Shield, LogOut, Save, Loader2 } from 'lucide-react';
import { AppLayout, PageHeader } from '@/components';
import { useAuthStore } from '@/lib/store';

export default function PerfilPage() {
  const { usuario, logout } = useAuthStore();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nome: usuario?.nome || '',
    email: usuario?.email || '',
    telefone: usuario?.telefone || '',
  });

  const handleSave = async () => {
    setSaving(true);
    // Simular salvamento
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  return (
    <AppLayout>
      <PageHeader title="Meu Perfil" subtitle="Gerencie suas informações" />

      <div className="px-4 py-6 lg:px-8 max-w-xl mx-auto space-y-6">
        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center"
        >
          <div className="avatar placeholder mb-4">
            <div className="bg-primary text-primary-content rounded-full w-24">
              <span className="text-3xl">{usuario?.nome?.charAt(0) || 'U'}</span>
            </div>
          </div>
          <h2 className="text-xl font-bold text-base-content">{usuario?.nome}</h2>
          <p className="text-sm text-base-content/60">{usuario?.email}</p>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card bg-base-100 shadow-sm border border-base-300"
        >
          <div className="card-body space-y-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Nome</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40" />
                <input
                  type="text"
                  className="input input-bordered w-full pl-10"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">E-mail</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40" />
                <input
                  type="email"
                  className="input input-bordered w-full pl-10"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Telefone</span>
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40" />
                <input
                  type="tel"
                  className="input input-bordered w-full pl-10"
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                />
              </div>
            </div>

            <button
              className="btn btn-primary w-full mt-4"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </motion.div>

        {/* Security */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card bg-base-100 shadow-sm border border-base-300"
        >
          <div className="card-body">
            <h3 className="font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Segurança
            </h3>
            <div className="divider my-2"></div>
            <button className="btn btn-ghost justify-start">
              Alterar senha
            </button>
          </div>
        </motion.div>

        {/* Logout */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            className="btn btn-error btn-outline w-full gap-2"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Sair da conta
          </button>
        </motion.div>
      </div>
    </AppLayout>
  );
}


'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Shield, LogOut, Save, Loader2, ImagePlus, Trash2 } from 'lucide-react';
import { AppLayout, PageHeader } from '@/components';
import { LogoCropperModal } from '@/components/ui/logo-cropper-modal';
import { useAuthStore } from '@/lib/store';
import { usuarioService } from '@/lib/api';
import { toastService } from '@/lib/toast';

export default function PerfilPage() {
  const { usuario, logout, setAuth, isGestor } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImageUrl, setCropperImageUrl] = useState('');
  const [perfilCompleto, setPerfilCompleto] = useState<typeof usuario>(usuario);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (usuario?.id) {
      usuarioService
        .buscarPorId(usuario.id)
        .then((u) => setPerfilCompleto(u))
        .catch(() => setPerfilCompleto(usuario));
    } else {
      setPerfilCompleto(usuario);
    }
  }, [usuario?.id]);

  const exibirUsuario = perfilCompleto ?? usuario;
  const [form, setForm] = useState({
    nome: usuario?.nome || '',
    email: usuario?.email || '',
    telefone: usuario?.telefone || '',
  });

  const handleSave = async () => {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
  };

  const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !usuario?.id) return;
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

  const handleCropperConfirm = async (blob: Blob) => {
    if (!usuario?.id) return;
    const file = new File([blob], 'logo-consultoria.jpg', { type: 'image/jpeg' });
    setUploadingLogo(true);
    try {
      const updated = await usuarioService.uploadLogo(usuario.id, file);
      setPerfilCompleto(updated);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) setAuth(token, { ...usuario, ...updated });
      toastService.success('Logo da consultoria atualizada. Ela aparecerá nos relatórios em formato quadrado.');
    } catch {
      // Erro já tratado pelo interceptor
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoverLogo = async () => {
    if (!usuario?.id) return;
    setRemovingLogo(true);
    try {
      const updated = await usuarioService.removerLogo(usuario.id);
      setPerfilCompleto(updated);
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (token) setAuth(token, { ...usuario, ...updated });
      toastService.success('Logo da consultoria removida.');
    } catch {
      // Erro já tratado pelo interceptor
    } finally {
      setRemovingLogo(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  return (
    <AppLayout>
      <PageHeader title="Meu Perfil" subtitle="Gerencie suas informações" />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {/* Avatar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center"
        >
          <div className="avatar placeholder mb-4">
            <div className="bg-primary text-primary-content rounded-full w-24 overflow-hidden">
              {exibirUsuario?.logoUrl ? (
                <img
                  src={exibirUsuario.logoUrl}
                  alt="Logo"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-3xl">{exibirUsuario?.nome?.charAt(0) || 'U'}</span>
              )}
            </div>
          </div>
          <h2 className="text-xl font-bold text-base-content">{exibirUsuario?.nome}</h2>
          <p className="text-sm text-base-content/60">{exibirUsuario?.email}</p>
        </motion.div>

        {isGestor() && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="card bg-base-100 shadow-sm border border-base-300"
          >
            <div className="card-body">
              <h3 className="font-semibold flex items-center gap-2">
                <ImagePlus className="w-5 h-5 text-primary" />
                Logo da consultoria
              </h3>
              <p className="text-sm text-base-content/60 mb-3">
                A logo aparece no cabeçalho dos relatórios em formato quadrado. Ao enviar, você poderá recortar e posicionar.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleLogoFileSelect}
              />
              {exibirUsuario?.logoUrl ? (
                <div className="flex flex-col items-start gap-3">
                  <div className="w-40 h-40 rounded-lg border border-base-300 overflow-hidden bg-base-200 flex-shrink-0">
                    <img
                      src={exibirUsuario.logoUrl}
                      alt="Logo da consultoria"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-outline btn-sm gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingLogo || removingLogo}
                    >
                      {uploadingLogo ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ImagePlus className="w-4 h-4" />
                      )}
                      Alterar imagem
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm gap-2 text-error hover:bg-error/10"
                      onClick={handleRemoverLogo}
                      disabled={uploadingLogo || removingLogo}
                    >
                      {removingLogo ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Remover imagem
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingLogo || removingLogo}
                  className="w-full h-24 border-2 border-dashed border-base-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  {uploadingLogo ? (
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  ) : (
                    <ImagePlus className="w-8 h-8 text-base-content/40" />
                  )}
                  <span className="text-sm text-base-content/60">
                    Clique para adicionar imagem da logo
                  </span>
                </button>
              )}
            </div>
          </motion.div>
        )}

        <LogoCropperModal
          open={cropperOpen}
          imageSource={cropperImageUrl}
          onClose={handleCropperClose}
          onConfirm={handleCropperConfirm}
          title="Ajustar imagem da logo da consultoria"
        />

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


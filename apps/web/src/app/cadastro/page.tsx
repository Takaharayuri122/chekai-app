'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { ClipboardCheck, Mail, Lock, User, Phone, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { authService } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

const cadastroSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  telefone: z.string().optional(),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
  confirmarSenha: z.string(),
}).refine((data) => data.senha === data.confirmarSenha, {
  message: 'As senhas não coincidem',
  path: ['confirmarSenha'],
});

type CadastroFormData = z.infer<typeof cadastroSchema>;

export default function CadastroPage() {
  const router = useRouter();
  const { setToken, setUsuario } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CadastroFormData>({
    resolver: zodResolver(cadastroSchema),
  });

  const onSubmit = async (data: CadastroFormData) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await authService.cadastrar({
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        senha: data.senha,
      });
      
      if (response?.accessToken || response?.access_token) {
        setToken(response.accessToken || response.access_token || '');
        if (response.usuario) {
          setUsuario(response.usuario);
        }
        router.push('/dashboard');
      } else {
        setError('Resposta inválida do servidor. Tente fazer login manualmente.');
      }
    } catch (error: any) {
      console.error('Erro ao cadastrar:', error);
      let errorMessage = 'Erro ao criar conta. Verifique os dados e tente novamente.';
      
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.data?.message) {
        errorMessage = error.response.data.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Mensagens específicas por código de erro
      if (error.response?.status === 409) {
        errorMessage = 'Este e-mail já está cadastrado. Tente fazer login.';
      } else if (error.response?.status === 400) {
        errorMessage = 'Dados inválidos. Verifique as informações e tente novamente.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-base-100 via-base-200 to-base-100">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="card bg-base-100 shadow-xl border border-base-300">
          <div className="card-body p-8">
            {/* Logo */}
            <div className="text-center mb-6">
              <Link href="/" className="inline-block">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
                    <ClipboardCheck className="w-7 h-7 text-primary-content" />
                  </div>
                </div>
              </Link>
              <h1 className="text-2xl font-bold text-base-content">Criar conta</h1>
              <p className="text-sm text-base-content/60 mt-1">
                Comece a usar o Meta App gratuitamente
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="alert alert-error mb-4">
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Nome completo</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40" />
                  <input
                    type="text"
                    placeholder="Seu nome"
                    className={`input input-bordered w-full pl-10 ${errors.nome ? 'input-error' : ''}`}
                    {...register('nome')}
                  />
                </div>
                {errors.nome && (
                  <label className="label">
                    <span className="label-text-alt text-error">{errors.nome.message}</span>
                  </label>
                )}
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">E-mail</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40" />
                  <input
                    type="email"
                    placeholder="seu@email.com"
                    className={`input input-bordered w-full pl-10 ${errors.email ? 'input-error' : ''}`}
                    {...register('email')}
                  />
                </div>
                {errors.email && (
                  <label className="label">
                    <span className="label-text-alt text-error">{errors.email.message}</span>
                  </label>
                )}
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Telefone (opcional)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40" />
                  <input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    className="input input-bordered w-full pl-10"
                    {...register('telefone')}
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Senha</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`input input-bordered w-full pl-10 pr-10 ${errors.senha ? 'input-error' : ''}`}
                    {...register('senha')}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.senha && (
                  <label className="label">
                    <span className="label-text-alt text-error">{errors.senha.message}</span>
                  </label>
                )}
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Confirmar senha</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className={`input input-bordered w-full pl-10 ${errors.confirmarSenha ? 'input-error' : ''}`}
                    {...register('confirmarSenha')}
                  />
                </div>
                {errors.confirmarSenha && (
                  <label className="label">
                    <span className="label-text-alt text-error">{errors.confirmarSenha.message}</span>
                  </label>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary w-full mt-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Criar conta'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="divider text-xs text-base-content/40">ou</div>

            <p className="text-center text-sm text-base-content/60">
              Já tem uma conta?{' '}
              <Link href="/login" className="link link-primary font-medium">
                Entre aqui
              </Link>
            </p>

            <Link
              href="/"
              className="btn btn-ghost btn-sm gap-2 mt-4 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao início
            </Link>
          </div>
        </div>
      </motion.div>
    </main>
  );
}

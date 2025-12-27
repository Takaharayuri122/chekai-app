'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { authService } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';

const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);

    try {
      const response = await authService.login(data.email, data.senha);
      setAuth(response.accessToken, response.usuario);
      toastService.success('Login realizado com sucesso!');
      router.push('/dashboard');
    } catch (error) {
      // Erro já é tratado pelo interceptor - toast será exibido automaticamente
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
              <Link href="/" className="inline-block mb-4">
                <Image
                  src="/images/logo-large.png"
                  alt="ChekAI"
                  width={280}
                  height={74}
                  className="h-auto w-full max-w-[280px] mx-auto"
                  priority
                />
              </Link>
              <h1 className="text-2xl font-bold text-base-content font-display">Bem-vindo de volta</h1>
              <p className="text-sm text-base-content/60 mt-1">
                Entre para continuar suas auditorias
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

              <button
                type="submit"
                className="btn btn-primary w-full mt-6"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="divider text-xs text-base-content/40">ou</div>

            <p className="text-center text-sm text-base-content/60">
              Não tem uma conta?{' '}
              <Link href="/cadastro" className="link link-primary font-medium">
                Cadastre-se
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

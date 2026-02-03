'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowLeft, Clock, RefreshCw } from 'lucide-react';
import { authService } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';
import { analyticsEvents } from '@/lib/analytics';

const emailSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

const otpSchema = z.object({
  codigo: z.string().length(6, 'O código deve ter 6 dígitos'),
});

type EmailFormData = z.infer<typeof emailSchema>;
type OtpFormData = z.infer<typeof otpSchema>;

const OTP_EXPIRATION_TIME = 10 * 60 * 1000;

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [otpExpired, setOtpExpired] = useState(false);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
  });

  useEffect(() => {
    if (step === 'otp' && timeRemaining !== null) {
      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 1000) {
            setOtpExpired(true);
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [step, timeRemaining]);

  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const onEmailSubmit = async (data: EmailFormData) => {
    setIsLoading(true);
    try {
      await authService.solicitarOtp(data.email);
      setEmail(data.email);
      setStep('otp');
      setTimeRemaining(OTP_EXPIRATION_TIME);
      setOtpExpired(false);
      toastService.success('Código OTP enviado para seu e-mail!');
    } catch (error) {
      analyticsEvents.error('solicitar_otp_failed', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const onOtpSubmit = async (data: OtpFormData) => {
    if (otpExpired) {
      toastService.error('Código OTP expirado. Solicite um novo código.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.validarOtp(email, data.codigo);
      setAuth(response.accessToken, response.usuario);
      toastService.success('Login realizado com sucesso!');
      analyticsEvents.login('otp');
      router.push('/admin/dashboard');
    } catch (error) {
      analyticsEvents.error('validar_otp_failed', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setIsLoading(true);
    try {
      await authService.solicitarOtp(email);
      setTimeRemaining(OTP_EXPIRATION_TIME);
      setOtpExpired(false);
      otpForm.reset();
      toastService.success('Novo código OTP enviado para seu e-mail!');
    } catch (error) {
      analyticsEvents.error('resend_otp_failed', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setStep('email');
    setTimeRemaining(null);
    setOtpExpired(false);
    otpForm.reset();
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
              <h1 className="text-2xl font-bold text-base-content font-display">
                {step === 'email' ? 'Bem-vindo de volta' : 'Código de acesso'}
              </h1>
              <p className="text-sm text-base-content/60 mt-1">
                {step === 'email'
                  ? 'Entre para continuar suas auditorias'
                  : 'Digite o código enviado para seu e-mail'}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {step === 'email' ? (
                <motion.form
                  key="email-form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  onSubmit={emailForm.handleSubmit(onEmailSubmit)}
                  className="space-y-4"
                >
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">E-mail</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40" />
                      <input
                        type="email"
                        placeholder="seu@email.com"
                        className={`input input-bordered w-full pl-10 ${
                          emailForm.formState.errors.email ? 'input-error' : ''
                        }`}
                        {...emailForm.register('email')}
                      />
                    </div>
                    {emailForm.formState.errors.email && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {emailForm.formState.errors.email.message}
                        </span>
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
                      'Enviar código de acesso'
                    )}
                  </button>
                </motion.form>
              ) : (
                <motion.form
                  key="otp-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={otpForm.handleSubmit(onOtpSubmit)}
                  className="space-y-4"
                >
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">Código de acesso</span>
                      {timeRemaining !== null && !otpExpired && (
                        <span className="label-text-alt flex items-center gap-1 text-warning">
                          <Clock className="w-4 h-4" />
                          {formatTime(timeRemaining)}
                        </span>
                      )}
                      {otpExpired && (
                        <span className="label-text-alt text-error">Expirado</span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      className={`input input-bordered w-full text-center text-2xl tracking-widest font-mono ${
                        otpForm.formState.errors.codigo || otpExpired ? 'input-error' : ''
                      }`}
                      {...otpForm.register('codigo', {
                        onChange: (e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          otpForm.setValue('codigo', value);
                        },
                      })}
                    />
                    {otpForm.formState.errors.codigo && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          {otpForm.formState.errors.codigo.message}
                        </span>
                      </label>
                    )}
                    {otpExpired && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          O código expirou. Solicite um novo código.
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="text-sm text-base-content/60 text-center">
                    Código enviado para <strong>{email}</strong>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-full"
                    disabled={isLoading || otpExpired}
                  >
                    {isLoading ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      'Entrar'
                    )}
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm flex-1"
                      onClick={handleBackToEmail}
                      disabled={isLoading}
                    >
                      Alterar e-mail
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm flex-1 gap-2"
                      onClick={handleResendOtp}
                      disabled={isLoading}
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reenviar código
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

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

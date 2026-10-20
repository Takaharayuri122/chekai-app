'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { ListaEsperaModal } from '@/components/ui/lista-espera-modal';

const emailSchema = z.object({
  email: z.string().email('E-mail inválido'),
});

const otpSchema = z.object({
  codigo: z.string().length(6, 'O código deve ter 6 dígitos'),
});

type EmailFormData = z.infer<typeof emailSchema>;
type OtpFormData = z.infer<typeof otpSchema>;

const OTP_EXPIRATION_TIME = 10 * 60 * 1000;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [otpExpired, setOtpExpired] = useState(false);
  const [modalListaEsperaAberto, setModalListaEsperaAberto] = useState(false);
  const [conviteProcessado, setConviteProcessado] = useState(false);

  const emailForm = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
  });

  const otpForm = useForm<OtpFormData>({
    resolver: zodResolver(otpSchema),
  });

  const dispararOtp = useCallback(async (emailParaOtp: string) => {
    setIsLoading(true);
    try {
      await authService.solicitarOtp(emailParaOtp);
      setEmail(emailParaOtp);
      setStep('otp');
      setTimeRemaining(OTP_EXPIRATION_TIME);
      setOtpExpired(false);
      toastService.success('Código OTP enviado para seu e-mail!');
    } catch (error) {
      analyticsEvents.error('solicitar_otp_failed', error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (conviteProcessado) return;
    const token = searchParams.get('token');
    const emailParam = searchParams.get('email');
    if (token) {
      setConviteProcessado(true);
      setIsLoading(true);
      authService.aceitarConvite(token)
        .then(async (resultado) => {
          const emailConvite = resultado.email;
          toastService.success('Convite aceito! Enviando código de acesso...');
          emailForm.setValue('email', emailConvite);
          await dispararOtp(emailConvite);
        })
        .catch(() => {
          if (emailParam) {
            emailForm.setValue('email', emailParam);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (emailParam) {
      setConviteProcessado(true);
      emailForm.setValue('email', emailParam);
    }
  }, [searchParams, conviteProcessado, emailForm, dispararOtp]);

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
    await dispararOtp(data.email);
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
    <>
      <ListaEsperaModal
        open={modalListaEsperaAberto}
        onClose={() => setModalListaEsperaAberto(false)}
      />
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-card via-muted to-card">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="relative flex flex-col rounded-lg border border-border bg-card shadow-xl">
          <div className="flex flex-1 flex-col gap-2 p-8">
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
              <h1 className="text-2xl font-bold text-foreground font-display">
                {step === 'email' ? 'Bem-vindo de volta' : 'Código de acesso'}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
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
                  <div className="flex flex-col">
                    <label className="flex items-center justify-between gap-2 py-1">
                      <span className="text-sm font-medium text-foreground">E-mail</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/70" />
                      <input
                        type="email"
                        placeholder="seu@email.com"
                        className={`rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3 w-full pl-10 ${
                          emailForm.formState.errors.email ? '!border-destructive' : ''
                        }`}
                        {...emailForm.register('email')}
                      />
                    </div>
                    {emailForm.formState.errors.email && (
                      <label className="flex items-center justify-between gap-2 py-1">
                        <span className="text-xs text-destructive">
                          {emailForm.formState.errors.email.message}
                        </span>
                      </label>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 w-full mt-6"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent h-4 w-4"></span>
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
                  <div className="flex flex-col">
                    <label className="flex items-center justify-between gap-2 py-1">
                      <span className="text-sm font-medium text-foreground">Código de acesso</span>
                      {timeRemaining !== null && !otpExpired && (
                        <span className="text-xs flex items-center gap-1 text-warning">
                          <Clock className="w-4 h-4" />
                          {formatTime(timeRemaining)}
                        </span>
                      )}
                      {otpExpired && (
                        <span className="text-xs text-destructive">Expirado</span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="000000"
                      maxLength={6}
                      className={`rounded-md border border-input bg-card outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3 w-full text-center text-2xl tracking-widest font-mono ${
                        otpForm.formState.errors.codigo || otpExpired ? '!border-destructive' : ''
                      }`}
                      {...otpForm.register('codigo', {
                        onChange: (e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          otpForm.setValue('codigo', value);
                        },
                      })}
                    />
                    {otpForm.formState.errors.codigo && (
                      <label className="flex items-center justify-between gap-2 py-1">
                        <span className="text-xs text-destructive">
                          {otpForm.formState.errors.codigo.message}
                        </span>
                      </label>
                    )}
                    {otpExpired && (
                      <label className="flex items-center justify-between gap-2 py-1">
                        <span className="text-xs text-destructive">
                          O código expirou. Solicite um novo código.
                        </span>
                      </label>
                    )}
                  </div>

                  <div className="text-sm text-muted-foreground text-center">
                    Código enviado para <strong>{email}</strong>
                  </div>

                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90 w-full"
                    disabled={isLoading || otpExpired}
                  >
                    {isLoading ? (
                      <span className="inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent h-4 w-4"></span>
                    ) : (
                      'Entrar'
                    )}
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 hover:bg-muted flex-1"
                      onClick={handleBackToEmail}
                      disabled={isLoading}
                    >
                      Alterar e-mail
                    </button>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 hover:bg-muted flex-1"
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

            <div className="my-4 flex items-center gap-4 text-xs before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border text-muted-foreground/70">ou</div>

            <p className="text-center text-sm text-muted-foreground">
              Não tem uma conta?{' '}
              <button
                type="button"
                onClick={() => setModalListaEsperaAberto(true)}
                className="cursor-pointer underline underline-offset-2 text-primary font-medium"
              >
                Entrar na lista de espera
              </button>
            </p>

            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 hover:bg-muted mt-4 mx-auto"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar ao início
            </Link>
          </div>
        </div>
      </motion.div>
    </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-card via-muted to-card">
        <span className="inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent h-8 w-8 text-primary"></span>
      </main>
    }>
      <LoginContent />
    </Suspense>
  );
}

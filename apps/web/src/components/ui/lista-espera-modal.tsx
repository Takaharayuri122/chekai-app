'use client';

import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, CheckCircle } from 'lucide-react';
import { listaEsperaService } from '@/lib/api';
import { toastService } from '@/lib/toast';

function aplicarMascaraTelefone(valor: string): string {
  const apenasNumeros = valor.replace(/\D/g, '');
  if (apenasNumeros.length <= 10) {
    return apenasNumeros
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  if (apenasNumeros.length <= 11) {
    return apenasNumeros
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  }
  return valor;
}

function removerMascaraTelefone(valor: string): string {
  return valor.replace(/\D/g, '');
}

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  telefone: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || removerMascaraTelefone(v).length >= 10, {
      message: 'O telefone deve ter pelo menos 10 dígitos',
    }),
});

type FormData = z.infer<typeof schema>;

interface ListaEsperaModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal de inscrição na lista de espera (fase beta).
 */
export function ListaEsperaModal({ open, onClose }: ListaEsperaModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', telefone: '' },
  });

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setSucesso(false);
      reset();
    }
  }, [open, reset]);

  const onInvalid = (errors: { email?: { message?: string }; telefone?: { message?: string } }) => {
    const msg = errors.email?.message ?? errors.telefone?.message ?? 'Verifique os dados preenchidos.';
    toastService.error(msg);
  };

  const onSubmit = async (data: FormData) => {
    setEnviando(true);
    try {
      const telefoneLimpo = data.telefone ? removerMascaraTelefone(data.telefone) : undefined;
      await listaEsperaService.inscrever({
        email: data.email,
        telefone: telefoneLimpo || undefined,
      });
      setSucesso(true);
    } catch {
      // Feedback exibido pelo toaster (interceptor ou tratamento específico no api)
    } finally {
      setEnviando(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lista-espera-titulo"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative bg-base-100 rounded-xl shadow-2xl border border-base-300 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-base-300">
            <h2 id="lista-espera-titulo" className="text-xl font-bold text-base-content">
              ChekAI está em fase beta
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="btn btn-ghost btn-sm btn-circle"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">
            {sucesso ? (
              <div className="text-center py-4">
                <CheckCircle className="w-14 h-14 text-success mx-auto mb-4" />
                <p className="text-base-content mb-6">
                  Você entrou na lista de espera. Em breve você receberá um e-mail com mais
                  informações.
                </p>
                <button type="button" onClick={onClose} className="btn btn-primary">
                  Fechar
                </button>
              </div>
            ) : (
              <>
                <p className="text-base-content/80 mb-6">
                  Estamos em fase de teste beta. Abrimos a lista de espera para quem quiser
                  experimentar a aplicação. Preencha seus dados e entraremos em contato em breve.
                </p>
                <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
                  <div>
                    <label htmlFor="lista-espera-email" className="label">
                      <span className="label-text">E-mail</span>
                    </label>
                    <input
                      id="lista-espera-email"
                      type="email"
                      placeholder="seu@email.com"
                      disabled={enviando}
                      className="input input-bordered w-full"
                      {...register('email')}
                    />
                  </div>
                  <div>
                    <label htmlFor="lista-espera-telefone" className="label">
                      <span className="label-text">Telefone (opcional)</span>
                    </label>
                    <Controller
                      name="telefone"
                      control={control}
                      defaultValue=""
                      render={({ field }) => (
                        <input
                          id="lista-espera-telefone"
                          type="tel"
                          placeholder="(11) 99999-9999"
                          disabled={enviando}
                          className="input input-bordered w-full"
                          maxLength={15}
                          value={field.value}
                          onChange={(e) => field.onChange(aplicarMascaraTelefone(e.target.value))}
                          onBlur={field.onBlur}
                        />
                      )}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={enviando}
                    className="btn btn-primary w-full gap-2"
                  >
                    {enviando ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Entrar na lista'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

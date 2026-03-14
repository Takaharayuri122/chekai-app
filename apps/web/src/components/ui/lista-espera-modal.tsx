'use client';

import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle } from 'lucide-react';
import { listaEsperaService } from '@/lib/api';
import { toastService } from '@/lib/toast';
import { FormModal } from './form-modal';

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
  const [sucesso, setSucesso] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', telefone: '' },
  });

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
      // Feedback via interceptor
    } finally {
      setEnviando(false);
    }
  };

  const footerSucesso = (
    <button type="button" onClick={onClose} className="btn btn-primary">
      Fechar
    </button>
  );

  const footerForm = (
    <button
      type="submit"
      form="lista-espera-form"
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
  );

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title="ChekAI está em fase beta"
      maxWidth="md"
      isDirty={isDirty && !sucesso}
      footer={sucesso ? footerSucesso : footerForm}
    >
      {sucesso ? (
        <div className="text-center py-4">
          <CheckCircle className="w-14 h-14 text-success mx-auto mb-4" />
          <p className="text-base-content">
            Você entrou na lista de espera. Em breve você receberá um e-mail com mais
            informações.
          </p>
        </div>
      ) : (
        <>
          <p className="text-base-content/80 mb-6">
            Estamos em fase de teste beta. Abrimos a lista de espera para quem quiser
            experimentar a aplicação. Preencha seus dados e entraremos em contato em breve.
          </p>
          <form id="lista-espera-form" onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-4">
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
          </form>
        </>
      )}
    </FormModal>
  );
}

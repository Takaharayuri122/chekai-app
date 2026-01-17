'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, User, Phone, ArrowLeft, Check, Loader2 } from 'lucide-react';
import { authService, planoService, Plano } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { toastService } from '@/lib/toast';

const cadastroSchema = z.object({
  nome: z.string().min(3, 'O nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  telefone: z.string().min(10, 'O WhatsApp deve ter pelo menos 10 dígitos'),
});

type CadastroFormData = z.infer<typeof cadastroSchema>;

export default function CadastroPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [etapa, setEtapa] = useState<'plano' | 'dados'>(() => {
    if (typeof window !== 'undefined') {
      const planoSelecionado = sessionStorage.getItem('planoSelecionado');
      return planoSelecionado ? 'dados' : 'plano';
    }
    return 'plano';
  });
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [planoSelecionado, setPlanoSelecionado] = useState<Plano | null>(() => {
    if (typeof window !== 'undefined') {
      const planoId = sessionStorage.getItem('planoSelecionado');
      const planoData = sessionStorage.getItem('planoData');
      if (planoId && planoData) {
        return JSON.parse(planoData);
      }
    }
    return null;
  });
  const [carregandoPlanos, setCarregandoPlanos] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Função para aplicar máscara de telefone
  const aplicarMascaraTelefone = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '');
    if (apenasNumeros.length <= 10) {
      return apenasNumeros
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    } else if (apenasNumeros.length <= 11) {
      return apenasNumeros
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return valor;
  };

  // Função para remover máscara do telefone
  const removerMascaraTelefone = (valor: string) => {
    return valor.replace(/\D/g, '');
  };

  useEffect(() => {
    const carregarPlanos = async () => {
      try {
        setCarregandoPlanos(true);
        const planosDisponiveis = await planoService.listarPublicos();
        setPlanos(planosDisponiveis);
      } catch (error: any) {
        setError('Erro ao carregar planos. Tente novamente.');
        console.error('Erro ao carregar planos:', error);
      } finally {
        setCarregandoPlanos(false);
      }
    };
    carregarPlanos();
  }, []);

  const selecionarPlano = (plano: Plano) => {
    setPlanoSelecionado(plano);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('planoSelecionado', plano.id);
      sessionStorage.setItem('planoData', JSON.stringify(plano));
    }
    setEtapa('dados');
  };

  const voltarParaSelecao = () => {
    setEtapa('plano');
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('planoSelecionado');
      sessionStorage.removeItem('planoData');
    }
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CadastroFormData>({
    resolver: zodResolver(cadastroSchema),
  });

  const onSubmit = async (data: CadastroFormData) => {
    if (!planoSelecionado) {
      setError('Por favor, selecione um plano primeiro.');
      setEtapa('plano');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await authService.cadastrar({
        nome: data.nome,
        email: data.email,
        telefone: data.telefone,
        planoId: planoSelecionado.id,
      });
      
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('planoSelecionado');
        sessionStorage.removeItem('planoData');
      }
      
      toastService.success('Conta criada com sucesso! Verifique seu e-mail para mais informações.');
      router.push('/login');
    } catch (error: any) {
      // Erro já é tratado pelo interceptor
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
        className="w-full max-w-4xl"
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
              <h1 className="text-2xl font-bold text-base-content font-display">
                {etapa === 'plano' ? 'Escolha seu plano' : 'Criar conta'}
              </h1>
              <p className="text-sm text-base-content/60 mt-1">
                {etapa === 'plano' 
                  ? 'Selecione o plano ideal para você'
                  : 'Preencha seus dados para finalizar o cadastro'}
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="alert alert-error mb-4">
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* Indicador de Plano Selecionado na Etapa 2 */}
            {etapa === 'dados' && planoSelecionado && (
              <div className="alert alert-info mb-4">
                <Check className="w-5 h-5" />
                <div className="flex-1">
                  <div className="font-semibold">Plano selecionado: {planoSelecionado.nome}</div>
                  <div className="text-xs opacity-80">
                    {planoSelecionado.descricao || 'Plano ativo'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={voltarParaSelecao}
                  className="btn btn-sm btn-ghost"
                >
                  Alterar
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              {etapa === 'plano' ? (
                <motion.div
                  key="plano"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.3 }}
                >
                  {carregandoPlanos ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : planos.length === 0 ? (
                    <div className="text-center py-12">
                      <p className="text-base-content/60">Nenhum plano disponível no momento.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {planos.map((plano) => (
                        <motion.button
                          key={plano.id}
                          type="button"
                          onClick={() => selecionarPlano(plano)}
                          className={`card bg-base-200 border-2 transition-all hover:shadow-lg ${
                            planoSelecionado?.id === plano.id
                              ? 'border-primary shadow-lg'
                              : 'border-base-300'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="card-body p-6">
                            <div className="flex items-start justify-between mb-4">
                              <h3 className="text-xl font-bold text-base-content">{plano.nome}</h3>
                              {planoSelecionado?.id === plano.id && (
                                <Check className="w-6 h-6 text-primary" />
                              )}
                            </div>
                            {plano.descricao && (
                              <p className="text-sm text-base-content/70 mb-4">{plano.descricao}</p>
                            )}
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-base-content/60">Usuários:</span>
                                <span className="font-semibold">{plano.limiteUsuarios === 0 ? 'Ilimitado' : plano.limiteUsuarios}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-base-content/60">Auditorias:</span>
                                <span className="font-semibold">{plano.limiteAuditorias === 0 ? 'Ilimitado' : plano.limiteAuditorias}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-base-content/60">Clientes:</span>
                                <span className="font-semibold">{plano.limiteClientes === 0 ? 'Ilimitado' : plano.limiteClientes}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-base-content/60">Créditos:</span>
                                <span className="font-semibold">{plano.limiteCreditos === 0 ? 'Ilimitado' : plano.limiteCreditos}</span>
                              </div>
                            </div>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.form
                  key="dados"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  onSubmit={handleSubmit(onSubmit)}
                  className="space-y-4"
                >
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
                    className={`input input-bordered w-full pl-10 ${errors.telefone ? 'input-error' : ''}`}
                    {...register('telefone', {
                      onChange: (e) => {
                        const valorFormatado = aplicarMascaraTelefone(e.target.value);
                        e.target.value = valorFormatado;
                      },
                    })}
                    maxLength={15}
                  />
                </div>
                {errors.telefone && (
                  <label className="label">
                    <span className="label-text-alt text-error">{errors.telefone.message}</span>
                  </label>
                )}
              </div>


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
                      <span className="label-text font-medium">Telefone</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/40" />
                      <input
                        type="tel"
                        placeholder="(11) 99999-9999"
                        className={`input input-bordered w-full pl-10 ${errors.telefone ? 'input-error' : ''}`}
                        {...register('telefone', {
                          onChange: (e) => {
                            const valorFormatado = aplicarMascaraTelefone(e.target.value);
                            e.target.value = valorFormatado;
                          },
                        })}
                        maxLength={15}
                      />
                    </div>
                    {errors.telefone && (
                      <label className="label">
                        <span className="label-text-alt text-error">{errors.telefone.message}</span>
                      </label>
                    )}
                  </div>

                  <div className="flex gap-3 mt-6">
                    <button
                      type="button"
                      onClick={voltarParaSelecao}
                      className="btn btn-ghost flex-1"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Voltar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary flex-1"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <span className="loading loading-spinner loading-sm"></span>
                      ) : (
                        'Criar conta'
                      )}
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>

            {/* Footer */}
            {etapa === 'plano' && (
              <>
                <div className="divider text-xs text-base-content/40">ou</div>
                <p className="text-center text-sm text-base-content/60">
                  Já tem uma conta?{' '}
                  <Link href="/login" className="link link-primary font-medium">
                    Entre aqui
                  </Link>
                </p>
              </>
            )}

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

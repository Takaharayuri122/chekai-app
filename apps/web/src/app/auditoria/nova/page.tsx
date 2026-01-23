'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Building2,
  MapPin,
  ClipboardList,
  Navigation,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { AppLayout, PageHeader } from '@/components';
import { 
  clienteService, 
  checklistService, 
  auditoriaService, 
  Cliente,
  ChecklistTemplate 
} from '@/lib/api';
import { toastService } from '@/lib/toast';

export default function NovaAuditoriaPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);
  const [unidadeId, setUnidadeId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [clientesRes, templatesRes] = await Promise.all([
          clienteService.listar(),
          checklistService.listarTemplates(),
        ]);
        setClientes(clientesRes.items || []);
        setTemplates(templatesRes.items || []);
      } catch (error) {
        // Erro já é tratado pelo interceptor
      } finally {
        setLoading(false);
      }
    };
    carregarDados();
  }, []);

  const obterLocalizacao = () => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Geolocalização não suportada');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setLocationError('Não foi possível obter a localização');
      }
    );
  };

  const iniciarAuditoria = async () => {
    if (!unidadeId || !templateId) return;

    setSubmitting(true);
    setError('');

    try {
      const auditoria = await auditoriaService.iniciar(
        unidadeId,
        templateId,
        location?.lat,
        location?.lng
      );
      toastService.success('Auditoria iniciada com sucesso!');
      router.push(`/auditoria/${auditoria.id}`);
    } catch (error) {
      // Erro já é tratado pelo interceptor
      setSubmitting(false);
    }
  };

  const unidadeSelecionada = clienteSelecionado?.unidades.find((u) => u.id === unidadeId);

  return (
    <AppLayout>
      <PageHeader
        title="Nova Auditoria"
        subtitle="Configure uma nova auditoria"
        backHref="/dashboard"
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {/* Steps */}
        <ul className="steps steps-horizontal w-full mb-8">
          <li className={`step ${step >= 1 ? 'step-primary' : ''}`}>Cliente</li>
          <li className={`step ${step >= 2 ? 'step-primary' : ''}`}>Unidade</li>
          <li className={`step ${step >= 3 ? 'step-primary' : ''}`}>Checklist</li>
          <li className={`step ${step >= 4 ? 'step-primary' : ''}`}>Confirmar</li>
        </ul>

        {loading ? (
          <div className="card bg-base-100 shadow-sm border border-base-300">
            <div className="card-body items-center py-12">
              <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="alert alert-error mb-4">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Cliente */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <h2 className="text-lg font-semibold mb-4">Selecione o cliente</h2>
                <div className="space-y-3">
                  {clientes.length === 0 ? (
                    <div className="card bg-base-100 shadow-sm border border-base-300">
                      <div className="card-body items-center text-center py-8">
                        <Building2 className="w-12 h-12 text-base-content/30 mb-2" />
                        <p className="text-base-content/60">Nenhum cliente cadastrado</p>
                      </div>
                    </div>
                  ) : (
                    clientes.map((cliente) => (
                      <button
                        key={cliente.id}
                        onClick={() => {
                          setClienteSelecionado(cliente);
                          setStep(2);
                        }}
                        className={`card bg-base-100 shadow-sm border w-full text-left hover:border-primary transition-colors ${
                          clienteSelecionado?.id === cliente.id
                            ? 'border-primary'
                            : 'border-base-300'
                        }`}
                      >
                        <div className="card-body p-4 flex-row items-center gap-4">
                          <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-primary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{cliente.nomeFantasia || cliente.razaoSocial}</p>
                            <p className="text-sm text-base-content/60">
                              {cliente.unidades?.length || 0} unidade(s)
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* Step 2: Unidade */}
            {step === 2 && clienteSelecionado && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <h2 className="text-lg font-semibold mb-4">
                  Selecione a unidade de {clienteSelecionado.nomeFantasia || clienteSelecionado.razaoSocial}
                </h2>
                <div className="space-y-3">
                  {clienteSelecionado.unidades.length === 0 ? (
                    <div className="card bg-base-100 shadow-sm border border-base-300">
                      <div className="card-body items-center text-center py-8">
                        <MapPin className="w-12 h-12 text-base-content/30 mb-2" />
                        <p className="text-base-content/60">Nenhuma unidade cadastrada</p>
                      </div>
                    </div>
                  ) : (
                    clienteSelecionado.unidades.map((unidade) => (
                      <button
                        key={unidade.id}
                        onClick={() => {
                          setUnidadeId(unidade.id);
                          setStep(3);
                        }}
                        className={`card bg-base-100 shadow-sm border w-full text-left hover:border-primary transition-colors ${
                          unidadeId === unidade.id ? 'border-primary' : 'border-base-300'
                        }`}
                      >
                        <div className="card-body p-4 flex-row items-center gap-4">
                          <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center">
                            <MapPin className="w-6 h-6 text-secondary" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{unidade.nome}</p>
                            <p className="text-sm text-base-content/60">
                              {unidade.cidade}, {unidade.estado}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <button
                  onClick={() => setStep(1)}
                  className="btn btn-ghost mt-4"
                >
                  Voltar
                </button>
              </motion.div>
            )}

            {/* Step 3: Checklist */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <h2 className="text-lg font-semibold mb-4">Selecione o Checklist</h2>
                <div className="space-y-3">
                  {templates.length === 0 ? (
                    <div className="card bg-base-100 shadow-sm border border-base-300">
                      <div className="card-body items-center text-center py-8">
                        <ClipboardList className="w-12 h-12 text-base-content/30 mb-2" />
                        <p className="text-base-content/60">Nenhum Checklist disponível</p>
                      </div>
                    </div>
                  ) : (
                    templates.map((template) => (
                      <button
                        key={template.id}
                        onClick={() => {
                          setTemplateId(template.id);
                          setStep(4);
                        }}
                        className={`card bg-base-100 shadow-sm border w-full text-left hover:border-primary transition-colors ${
                          templateId === template.id ? 'border-primary' : 'border-base-300'
                        }`}
                      >
                        <div className="card-body p-4">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center flex-shrink-0">
                              <ClipboardList className="w-6 h-6 text-accent" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{template.nome}</p>
                              <p className="text-sm text-base-content/60 line-clamp-2">
                                {template.descricao}
                              </p>
                              <span className="badge badge-ghost badge-sm mt-2">
                                {template.tipoAtividade}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <button
                  onClick={() => setStep(2)}
                  className="btn btn-ghost mt-4"
                >
                  Voltar
                </button>
              </motion.div>
            )}

            {/* Step 4: Confirmação */}
            {step === 4 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <h2 className="text-lg font-semibold mb-4">Confirme os dados</h2>

                <div className="card bg-base-100 shadow-sm border border-base-300 mb-4">
                  <div className="card-body p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm text-base-content/60">Cliente</p>
                        <p className="font-medium">{clienteSelecionado?.nomeFantasia || clienteSelecionado?.razaoSocial}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-secondary" />
                      <div>
                        <p className="text-sm text-base-content/60">Unidade</p>
                        <p className="font-medium">
                          {unidadeSelecionada?.nome} - {unidadeSelecionada?.cidade}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ClipboardList className="w-5 h-5 text-accent" />
                      <div>
                        <p className="text-sm text-base-content/60">Checklist</p>
                        <p className="font-medium">
                          {templates.find((t) => t.id === templateId)?.nome}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Localização */}
                <div className="card bg-base-100 shadow-sm border border-base-300 mb-6">
                  <div className="card-body p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Navigation className="w-5 h-5 text-info" />
                        <div>
                          <p className="text-sm text-base-content/60">Localização GPS</p>
                          {location ? (
                            <p className="font-medium text-success">
                              ✓ Capturada
                            </p>
                          ) : (
                            <p className="font-medium text-base-content/40">
                              Não capturada
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={obterLocalizacao}
                        className="btn btn-ghost btn-sm"
                      >
                        {location ? 'Atualizar' : 'Capturar'}
                      </button>
                    </div>
                    {locationError && (
                      <p className="text-xs text-error mt-2">{locationError}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(3)}
                    className="btn btn-ghost flex-1"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={iniciarAuditoria}
                    className="btn btn-primary flex-1"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Iniciando...
                      </>
                    ) : (
                      'Iniciar Auditoria'
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

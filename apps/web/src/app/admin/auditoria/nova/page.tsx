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
  Search,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { AppLayout, EmptyState, PageHeader } from '@/components';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { contemTexto } from '@/lib/auditoria/listagem';
import {
  clienteService,
  checklistService,
  auditoriaService,
  Cliente,
  ChecklistTemplate,
  StatusTemplate,
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
  const [busca, setBusca] = useState('');

  const irPara = (etapa: number) => {
    setBusca('');
    setStep(etapa);
  };

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [clientesRes, templatesRes] = await Promise.all([
          clienteService.listar(),
          checklistService.listarTemplates(1, 100),
        ]);
        setClientes(clientesRes.items || []);
        const apenasAtivos = (templatesRes.items || []).filter((t) => t.status === StatusTemplate.ATIVO);
        setTemplates(apenasAtivos);
      } catch {
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

  const handleIniciarAuditoria = async () => {
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
      router.push(`/admin/auditoria/${auditoria.id}`);
    } catch (err) {
      toastService.error(err instanceof Error ? err.message : 'Erro ao iniciar auditoria');
      setSubmitting(false);
    }
  };

  const unidadeSelecionada = clienteSelecionado?.unidades.find((u) => u.id === unidadeId);
  const templateSelecionado = templates.find((t) => t.id === templateId);
  const OPCAO = 'flex min-h-[64px] w-full items-center gap-4 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 active:bg-muted';

  const campoBusca = (
    <div className="relative mb-3">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input className="h-11 pl-9" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
    </div>
  );

  const icone = (Icone: typeof Building2) => (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
      <Icone className="h-5 w-5" />
    </span>
  );

  return (
    <AppLayout>
      <PageHeader title="Nova auditoria" subtitle="Escolha onde e com qual checklist" backHref="/admin/auditorias" />

      <div className="mx-auto max-w-2xl space-y-4 px-4 py-4 lg:px-8">
        <ol className="mb-6 flex items-center gap-2" aria-label="Etapas">
          {['Cliente', 'Unidade', 'Checklist', 'Confirmar'].map((rotulo, i) => {
            const n = i + 1;
            return (
              <li key={rotulo} className="flex flex-1 flex-col gap-1">
                <span className={`h-1.5 rounded-full ${step >= n ? 'bg-primary' : 'bg-muted'}`} />
                <span className={`text-xs ${step === n ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{rotulo}</span>
              </li>
            );
          })}
        </ol>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}
          </div>
        ) : (
          <>
            {error && (
              <p className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                {error}
              </p>
            )}

            {step === 1 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <h2 className="mb-3 font-display text-lg font-semibold">Selecione o cliente</h2>
                {campoBusca}
                <div className="space-y-2">
                  {clientes.length === 0 ? (
                    <EmptyState icon={Building2} title="Nenhum cliente cadastrado" description="Cadastre um cliente para iniciar auditorias." />
                  ) : (
                    clientes
                      .filter((c) => contemTexto(c.nomeFantasia || c.razaoSocial, busca))
                      .map((cliente) => (
                        <button
                          key={cliente.id}
                          type="button"
                          onClick={() => {
                            setClienteSelecionado(cliente);
                            irPara(2);
                          }}
                          className={`${OPCAO} ${clienteSelecionado?.id === cliente.id ? 'border-primary' : 'border-border'}`}
                        >
                          {icone(Building2)}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{cliente.nomeFantasia || cliente.razaoSocial}</span>
                            <span className="text-sm text-muted-foreground">{cliente.unidades?.length || 0} unidade(s)</span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))
                  )}
                </div>
              </motion.div>
            )}

            {step === 2 && clienteSelecionado && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <h2 className="mb-3 font-display text-lg font-semibold">
                  Unidade de {clienteSelecionado.nomeFantasia || clienteSelecionado.razaoSocial}
                </h2>
                {campoBusca}
                <div className="space-y-2">
                  {clienteSelecionado.unidades.length === 0 ? (
                    <EmptyState icon={MapPin} title="Nenhuma unidade cadastrada" description="Cadastre uma unidade para este cliente." />
                  ) : (
                    clienteSelecionado.unidades
                      .filter((u) => contemTexto(u.nome, busca))
                      .map((unidade) => (
                        <button
                          key={unidade.id}
                          type="button"
                          onClick={() => {
                            setUnidadeId(unidade.id);
                            irPara(3);
                          }}
                          className={`${OPCAO} ${unidadeId === unidade.id ? 'border-primary' : 'border-border'}`}
                        >
                          {icone(MapPin)}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{unidade.nome}</span>
                            <span className="text-sm text-muted-foreground">
                              {unidade.cidade}, {unidade.estado}
                            </span>
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))
                  )}
                </div>
                <Button variant="ghost" className="mt-4 h-11" onClick={() => irPara(1)}>
                  Voltar
                </Button>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                <h2 className="mb-3 font-display text-lg font-semibold">Selecione o checklist</h2>
                {campoBusca}
                <div className="space-y-2">
                  {templates.length === 0 ? (
                    <EmptyState icon={ClipboardList} title="Nenhum checklist disponível" description="Ative um checklist para usá-lo em auditorias." />
                  ) : (
                    templates
                      .filter((t) => contemTexto(t.nome, busca))
                      .map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => {
                            setTemplateId(template.id);
                            irPara(4);
                          }}
                          className={`${OPCAO} ${templateId === template.id ? 'border-primary' : 'border-border'}`}
                        >
                          {icone(ClipboardList)}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">{template.nome}</span>
                            {template.descricao && <span className="line-clamp-2 text-sm text-muted-foreground">{template.descricao}</span>}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))
                  )}
                </div>
                <Button variant="ghost" className="mt-4 h-11" onClick={() => irPara(2)}>
                  Voltar
                </Button>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
                <h2 className="font-display text-lg font-semibold">Confirme os dados</h2>

                <dl className="divide-y divide-border rounded-lg border border-border bg-card shadow-sm">
                  {[
                    { icone: Building2, rotulo: 'Cliente', valor: clienteSelecionado?.nomeFantasia || clienteSelecionado?.razaoSocial, etapa: 1 },
                    { icone: MapPin, rotulo: 'Unidade', valor: `${unidadeSelecionada?.nome ?? ''} - ${unidadeSelecionada?.cidade ?? ''}`, etapa: 2 },
                    { icone: ClipboardList, rotulo: 'Checklist', valor: templateSelecionado?.nome, etapa: 3 },
                  ].map(({ icone: Icone, rotulo, valor, etapa }) => (
                    <div key={rotulo} className="flex items-center gap-3 p-4">
                      <Icone className="h-5 w-5 text-primary" />
                      <div className="min-w-0 flex-1">
                        <dt className="text-xs text-muted-foreground">{rotulo}</dt>
                        <dd className="truncate font-medium">{valor}</dd>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => irPara(etapa)}>
                        Alterar
                      </Button>
                    </div>
                  ))}
                </dl>

                <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Navigation className="h-5 w-5 text-info" />
                      <div>
                        <p className="text-xs text-muted-foreground">Localização</p>
                        {location ? (
                          <p className="flex items-center gap-1 font-medium text-[hsl(160_84%_28%)]">
                            <CheckCircle2 className="h-4 w-4" />
                            Capturada
                          </p>
                        ) : (
                          <p className="font-medium text-muted-foreground">Não capturada</p>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="h-10" onClick={obterLocalizacao}>
                      {location ? 'Atualizar' : 'Capturar'}
                    </Button>
                  </div>
                  {locationError && <p className="mt-2 text-xs text-destructive">{locationError}</p>}
                </div>

                <div className="flex gap-3">
                  <Button variant="ghost" className="h-12 flex-1" onClick={() => irPara(3)}>
                    Voltar
                  </Button>
                  <Button className="h-12 flex-1" onClick={handleIniciarAuditoria} disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Iniciando…
                      </>
                    ) : (
                      'Iniciar auditoria'
                    )}
                  </Button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

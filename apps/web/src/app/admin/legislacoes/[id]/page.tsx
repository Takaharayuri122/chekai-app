'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ExternalLink, FileText, Loader2, RefreshCw, Save, ClipboardPaste } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { AppLayout, ConfirmDialog, PageHeader, StatusChip } from '@/components';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { ListaTrechos } from '@/components/legislacao/lista-trechos';
import { ModalColarTexto } from '@/components/legislacao/modal-colar-texto';
import { ModalEnviarPdf } from '@/components/legislacao/modal-enviar-pdf';
import { SemPermissaoLegislacoes } from '@/components/legislacao/sem-permissao';
import {
  legislacaoService,
  Legislacao,
  LegislacaoChunk,
  SituacaoLegislacao,
  TipoLegislacao,
  TIPO_LEGISLACAO_LABELS,
} from '@/lib/api';
import { nomeCurtoLegislacao } from '@/lib/legislacao/nome-legislacao';
import {
  OPCOES_SITUACAO,
  deveAtualizar,
  formatarDataPtBr,
  rotuloSituacao,
  rotuloStatusLeitura,
  statusChipLeitura,
} from '@/lib/legislacao/leitura';
import { toastService } from '@/lib/toast';

const INTERVALO_ATUALIZACAO_MS = 3000;
const TEXTO_RELER = 'Os dados lidos e os trechos serão substituídos pelo conteúdo atual da página.';
const CLASSE_SELECT =
  'h-11 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10';

interface FormularioLegislacao {
  tipo: TipoLegislacao;
  numero: string;
  ano: string;
  orgaoEmissor: string;
  dataPublicacao: string;
  situacao: SituacaoLegislacao | '';
  ementa: string;
  titulo: string;
  informacoes: string;
  linkOficial: string;
}

function paraFormulario(l: Legislacao): FormularioLegislacao {
  return {
    tipo: l.tipo,
    numero: l.numero ?? '',
    ano: l.ano ? String(l.ano) : '',
    orgaoEmissor: l.orgaoEmissor ?? '',
    dataPublicacao: l.dataPublicacao ? l.dataPublicacao.slice(0, 10) : '',
    situacao: l.situacao ?? '',
    ementa: l.ementa ?? '',
    titulo: l.titulo,
    informacoes: l.informacoes ?? '',
    linkOficial: l.linkOficial ?? '',
  };
}

function statusHttp(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

/**
 * Detalhe da legislação: estado da leitura, dados lidos editáveis e trechos.
 */
export default function LegislacaoDetalhesPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { isAuthenticated } = useAuthStore();

  const [legislacao, setLegislacao] = useState<Legislacao | null>(null);
  const [trechos, setTrechos] = useState<LegislacaoChunk[]>([]);
  const [form, setForm] = useState<FormularioLegislacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [semPermissao, setSemPermissao] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [confirmarReleitura, setConfirmarReleitura] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [modalPdf, setModalPdf] = useState(false);
  const [modalTexto, setModalTexto] = useState(false);
  const statusAnterior = useRef<string | null>(null);

  const aplicar = useCallback(async (leg: Legislacao) => {
    setLegislacao(leg);
    // Só reinicia o formulário quando chega um estado novo, para não apagar edições em andamento
    if (statusAnterior.current !== 'concluida' || leg.statusLeitura !== 'concluida') {
      setForm(paraFormulario(leg));
    }
    if (leg.statusLeitura === 'concluida') {
      if (statusAnterior.current !== 'concluida') {
        try {
          setTrechos(await legislacaoService.listarChunks(id));
        } catch {
          setTrechos([]);
        }
      }
    } else {
      setTrechos([]);
    }
    statusAnterior.current = leg.statusLeitura;
  }, [id]);

  const carregar = useCallback(async (silencioso = false) => {
    try {
      if (!silencioso) setLoading(true);
      await aplicar(await legislacaoService.buscarPorId(id));
    } catch (error) {
      if (statusHttp(error) === 403) {
        setSemPermissao(true);
      } else if (!silencioso) {
        router.push('/admin/legislacoes');
      }
    } finally {
      if (!silencioso) setLoading(false);
    }
  }, [id, aplicar, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    carregar();
  }, [isAuthenticated, router, carregar]);

  // Enquanto a leitura roda, consulta de novo a cada 3 s; limpa ao desmontar ou ao concluir
  const status = legislacao?.statusLeitura;
  useEffect(() => {
    if (!status || !deveAtualizar(status)) return;
    const timer = setTimeout(() => carregar(true), INTERVALO_ATUALIZACAO_MS);
    return () => clearTimeout(timer);
  }, [status, legislacao, carregar]);

  const alterar = <K extends keyof FormularioLegislacao>(campo: K, valor: FormularioLegislacao[K]) =>
    setForm((atual) => (atual ? { ...atual, [campo]: valor } : atual));

  const salvar = async () => {
    if (!form) return;
    if (!form.titulo.trim() || !form.linkOficial.trim()) {
      toastService.warning('Preencha o título e o link.');
      return;
    }
    const ano = parseInt(form.ano, 10);
    try {
      setSalvando(true);
      const atualizada = await legislacaoService.atualizar(id, {
        tipo: form.tipo,
        numero: form.numero.trim(),
        ...(Number.isNaN(ano) ? {} : { ano }),
        orgaoEmissor: form.orgaoEmissor.trim(),
        ...(form.dataPublicacao ? { dataPublicacao: form.dataPublicacao } : {}),
        ...(form.situacao ? { situacao: form.situacao } : {}),
        ementa: form.ementa.trim(),
        titulo: form.titulo.trim(),
        informacoes: form.informacoes.trim(),
        linkOficial: form.linkOficial.trim(),
      });
      setLegislacao((atual) => (atual ? { ...atual, ...atualizada } : atualizada));
      toastService.success('Legislação atualizada.');
    } catch {
      // erro já exibido pelo interceptor
    } finally {
      setSalvando(false);
    }
  };

  /** Dispara uma ação que reinicia a leitura e volta a acompanhar o andamento. */
  const reiniciar = async (acao: () => Promise<Legislacao>) => {
    const atualizada = await acao();
    statusAnterior.current = null;
    await aplicar(atualizada);
  };

  const tentarDeNovo = async () => {
    try {
      setProcessando(true);
      await reiniciar(() => legislacaoService.lerNovamente(id));
    } catch {
      // erro já exibido pelo interceptor
    } finally {
      setProcessando(false);
    }
  };

  const confirmarRelerAgora = async () => {
    await tentarDeNovo();
    setConfirmarReleitura(false);
  };

  if (semPermissao) {
    return (
      <AppLayout>
        <PageHeader title="Legislação" backHref="/admin/legislacoes" />
        <SemPermissaoLegislacoes />
      </AppLayout>
    );
  }

  if (loading || !legislacao || !form) {
    return (
      <AppLayout>
        <PageHeader title="Legislação" backHref="/admin/legislacoes" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const rotuloDaSituacao = rotuloSituacao(legislacao.situacao);
  const lendo = deveAtualizar(legislacao.statusLeitura);

  return (
    <AppLayout>
      <PageHeader
        title={nomeCurtoLegislacao(legislacao)}
        subtitle={legislacao.titulo}
        backHref="/admin/legislacoes"
        action={
          legislacao.statusLeitura === 'concluida' && (
            <>
              <Button variant="outline" onClick={() => setConfirmarReleitura(true)} className="hidden sm:inline-flex">
                <RefreshCw className="h-4 w-4" />
                Ler novamente
              </Button>
              <Button onClick={salvar} disabled={salvando}>
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </>
          )
        }
      />

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 lg:px-8">
        {/* Resumo e estado da leitura */}
        <section className="space-y-3 rounded-lg border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip
              status={statusChipLeitura(legislacao.statusLeitura)}
              label={rotuloStatusLeitura(legislacao.statusLeitura)}
            />
            {rotuloDaSituacao &&
              (legislacao.situacao === 'revogada' ? (
                <StatusChip status="nao_conforme" label={rotuloDaSituacao} />
              ) : (
                <span className="text-sm">{rotuloDaSituacao}</span>
              ))}
            {!legislacao.ativo && <span className="text-sm text-muted-foreground">Inativa</span>}
          </div>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Publicada em:</dt>
              <dd>{formatarDataPtBr(legislacao.dataPublicacao)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Última leitura:</dt>
              <dd>{formatarDataPtBr(legislacao.lidoEm)}</dd>
            </div>
          </dl>
          {legislacao.linkOficial && (
            <a
              href={legislacao.linkOficial}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir link oficial
            </a>
          )}
        </section>

        {lendo && (
          <section
            role="status"
            className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
          >
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              O sistema está lendo a legislação. Isso pode levar alguns instantes; esta tela atualiza sozinha.
            </p>
          </section>
        )}

        {legislacao.statusLeitura === 'falhou' && (
          <section className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
              <p className="text-sm">{legislacao.erroLeitura || 'Não foi possível ler esta legislação.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={tentarDeNovo} disabled={processando}>
                {processando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Tentar de novo
              </Button>
              <Button variant="outline" onClick={() => setModalPdf(true)}>
                <FileText className="h-4 w-4" />
                Enviar PDF
              </Button>
              <Button variant="outline" onClick={() => setModalTexto(true)}>
                <ClipboardPaste className="h-4 w-4" />
                Colar texto
              </Button>
            </div>
          </section>
        )}

        {legislacao.statusLeitura === 'concluida' && (
          <>
            <section className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-sm">
              <h2 className="font-display text-base font-semibold">Dados da legislação</h2>

              <div className="space-y-2">
                <Label htmlFor="titulo">Título *</Label>
                <Input id="titulo" value={form.titulo} onChange={(e) => alterar('titulo', e.target.value)} className="h-11 md:h-10" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="tipo">Tipo</Label>
                  <select
                    id="tipo"
                    value={form.tipo}
                    onChange={(e) => alterar('tipo', e.target.value as TipoLegislacao)}
                    className={CLASSE_SELECT}
                  >
                    {Object.values(TipoLegislacao).map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {TIPO_LEGISLACAO_LABELS[tipo]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input id="numero" value={form.numero} onChange={(e) => alterar('numero', e.target.value)} className="h-11 md:h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ano">Ano</Label>
                  <Input
                    id="ano"
                    type="number"
                    inputMode="numeric"
                    value={form.ano}
                    onChange={(e) => alterar('ano', e.target.value)}
                    className="h-11 md:h-10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="orgao">Órgão emissor</Label>
                  <Input id="orgao" value={form.orgaoEmissor} onChange={(e) => alterar('orgaoEmissor', e.target.value)} className="h-11 md:h-10" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dataPublicacao">Data de publicação</Label>
                  <Input
                    id="dataPublicacao"
                    type="date"
                    lang="pt-BR"
                    value={form.dataPublicacao}
                    onChange={(e) => alterar('dataPublicacao', e.target.value)}
                    className="h-11 md:h-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="situacao">Situação</Label>
                <select
                  id="situacao"
                  value={form.situacao}
                  onChange={(e) => alterar('situacao', e.target.value as SituacaoLegislacao | '')}
                  className={CLASSE_SELECT}
                >
                  <option value="">Não informada</option>
                  {OPCOES_SITUACAO.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {form.situacao === 'revogada' && (
                  <p className="text-xs text-destructive">Esta legislação está revogada.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="ementa">Ementa</Label>
                <Textarea id="ementa" value={form.ementa} onChange={(e) => alterar('ementa', e.target.value)} rows={4} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="informacoes">Informações</Label>
                <Textarea id="informacoes" value={form.informacoes} onChange={(e) => alterar('informacoes', e.target.value)} rows={3} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkOficial">Link oficial</Label>
                <Input
                  id="linkOficial"
                  type="url"
                  inputMode="url"
                  value={form.linkOficial}
                  onChange={(e) => alterar('linkOficial', e.target.value)}
                  className="h-11 md:h-10"
                />
                <p className="text-xs text-muted-foreground">
                  Trocar o link não lê a página de novo; use &quot;Ler novamente&quot; para isso.
                </p>
              </div>

              <Button variant="outline" onClick={() => setConfirmarReleitura(true)} className="w-full sm:hidden">
                <RefreshCw className="h-4 w-4" />
                Ler novamente
              </Button>
            </section>

            <ListaTrechos trechos={trechos} />
          </>
        )}
      </div>

      <ModalEnviarPdf
        open={modalPdf}
        onOpenChange={setModalPdf}
        onEnviar={(arquivo) => reiniciar(() => legislacaoService.enviarArquivo(id, arquivo))}
      />
      <ModalColarTexto
        open={modalTexto}
        onOpenChange={setModalTexto}
        onEnviar={(texto) => reiniciar(() => legislacaoService.enviarTexto(id, texto))}
      />
      <ConfirmDialog
        open={confirmarReleitura}
        onClose={() => setConfirmarReleitura(false)}
        onConfirm={confirmarRelerAgora}
        title="Ler novamente"
        message={TEXTO_RELER}
        confirmLabel="Ler novamente"
        variant="warning"
        loading={processando}
      />
    </AppLayout>
  );
}

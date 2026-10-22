'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Camera, Loader2, Lock, MessageSquare, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Tooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/shadcn/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/shadcn/drawer';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/shadcn/sheet';
import { Switch } from '@/components/ui/shadcn/switch';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  estadoInicialLote,
  montarRequisicaoLote,
  opcoesParaTipo,
  opcoesValidas,
  secoesTravadas,
  temAlteracao,
  type EscopoLote,
  type EstadoLote,
  type SecaoLote,
} from '@/lib/checklist/configuracao-lote';
import { checklistService, CRITICIDADE_LABELS, CriticidadeItem, type ResultadoLote, type TipoRespostaLote } from '@/lib/api';
import { cn } from '@/lib/cn';
import { toastService } from '@/lib/toast';

export type { EscopoLote };

interface PainelConfiguracaoLoteProps {
  aberto: boolean;
  onFechar: () => void;
  templateId: string;
  escopo: EscopoLote;
  onAplicado: (r: ResultadoLote) => void;
}

const TIPOS_RESPOSTA: { valor: TipoRespostaLote; rotulo: string }[] = [
  { valor: 'padrao', rotulo: 'Padrão' },
  { valor: 'personalizada', rotulo: 'Opções personalizadas' },
  { valor: 'texto', rotulo: 'Texto' },
  { valor: 'numero', rotulo: 'Número' },
  { valor: 'data', rotulo: 'Data' },
];

const TEXTO_TIPO: Partial<Record<TipoRespostaLote, string>> = {
  texto: 'O auditor escreve a resposta. Respostas em texto não têm opções, não pontuam e não recebem fotos.',
  numero: 'O auditor informa um número. Não há opções de resposta.',
  data: 'O auditor escolhe uma data. Não há opções de resposta.',
};

const ROTULO_PADRAO: Record<string, string> = {
  conforme: 'Conforme',
  nao_conforme: 'Não conforme',
  nao_aplicavel: 'Não aplicável',
  nao_avaliado: 'Não avaliado',
};

const DELAY_SIMULACAO_MS = 400;

function perguntas(n: number): string {
  return n === 1 ? '1 pergunta' : `${n} perguntas`;
}

function descricaoEscopo(escopo: EscopoLote): string {
  if (escopo.tipo === 'selecao') {
    const n = escopo.itemIds.length;
    return n === 1 ? '1 pergunta selecionada' : `${n} perguntas selecionadas`;
  }
  if (escopo.tipo === 'grupo') return `${perguntas(escopo.total)} · ${escopo.nome}`;
  return `Todas as ${perguntas(escopo.total)} do checklist`;
}

interface SecaoProps {
  titulo: string;
  subtitulo: string;
  ligada: boolean;
  travada?: string;
  onLigar: (v: boolean) => void;
  children?: ReactNode;
}

function Secao({ titulo, subtitulo, ligada, travada, onLigar, children }: SecaoProps) {
  const ativa = ligada && !travada;
  return (
    <section className={cn('overflow-hidden rounded-lg border border-border', !ativa && 'bg-muted/40')}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {travada && <Lock className="h-3 w-3 shrink-0" aria-hidden />}
            {travada ?? (ativa ? subtitulo : 'Não será alterado')}
          </p>
        </div>
        <span className="text-xs text-muted-foreground">Alterar</span>
        <Switch
          checked={ativa}
          disabled={Boolean(travada)}
          onCheckedChange={onLigar}
          aria-label={`Alterar: ${titulo}`}
        />
      </div>
      {ativa && children && <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>}
    </section>
  );
}

function Segmentos<T extends string>({
  valor,
  opcoes,
  onChange,
}: {
  valor: T;
  opcoes: { valor: T; rotulo: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="radio"
          aria-checked={valor === o.valor}
          onClick={() => onChange(o.valor)}
          className={cn(
            'h-9 rounded-md border px-3 text-sm transition-colors',
            valor === o.valor
              ? 'border-primary bg-primary/10 font-semibold text-primary'
              : 'border-border bg-card text-foreground hover:bg-muted',
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

function ValorSwitch({ checked, onChange, rotulo }: { checked: boolean; onChange: (v: boolean) => void; rotulo: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
      <Switch checked={checked} onCheckedChange={onChange} />
      {rotulo}
    </label>
  );
}

/**
 * Painel de configuração em lote: lateral no desktop e gaveta no mobile, com cabeçalho e rodapé fixos.
 * Mostra o impacto (simulação) antes de aplicar.
 */
export function PainelConfiguracaoLote({ aberto, onFechar, templateId, escopo, onAplicado }: PainelConfiguracaoLoteProps) {
  const desktop = useMediaQuery('(min-width: 768px)');
  const [estado, setEstado] = useState<EstadoLote>(estadoInicialLote);
  const [simulacao, setSimulacao] = useState<ResultadoLote | null>(null);
  const [simulando, setSimulando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const [confirmarAplicar, setConfirmarAplicar] = useState(false);

  // Cada abertura começa do zero.
  useEffect(() => {
    if (aberto) {
      setEstado(estadoInicialLote());
      setSimulacao(null);
      setSimulando(false);
      setAplicando(false);
      setConfirmarDescarte(false);
      setConfirmarAplicar(false);
    }
  }, [aberto]);

  const travadas = useMemo(() => secoesTravadas(estado), [estado]);
  const alterou = temAlteracao(estado);
  const opcoesAtivas = estado.ligadas.opcoes && !travadas.opcoes;
  const opcoesOk = !opcoesAtivas || opcoesValidas(estado.opcoes);

  // Simulação com debounce a cada mudança.
  useEffect(() => {
    if (!aberto) return;
    if (!alterou || !opcoesOk) {
      setSimulacao(null);
      setSimulando(false);
      return;
    }
    let cancelado = false;
    setSimulando(true);
    const timer = setTimeout(async () => {
      try {
        const r = await checklistService.configurarLote(templateId, montarRequisicaoLote(escopo, estado, true));
        if (!cancelado) setSimulacao(r);
      } catch {
        if (!cancelado) setSimulacao(null);
      } finally {
        if (!cancelado) setSimulando(false);
      }
    }, DELAY_SIMULACAO_MS);
    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [aberto, alterou, opcoesOk, estado, escopo, templateId]);

  const ligar = (secao: SecaoLote, v: boolean) =>
    setEstado((e) => ({ ...e, ligadas: { ...e.ligadas, [secao]: v } }));

  const trocarTipo = (tipo: TipoRespostaLote) =>
    setEstado((e) => {
      const opcoes = tipo === 'padrao' || tipo === 'personalizada' ? opcoesParaTipo(tipo) : e.opcoes;
      return { ...e, tipoResposta: tipo, opcoes };
    });

  const atualizarOpcao = (idx: number, parcial: Partial<EstadoLote['opcoes'][number]>) =>
    setEstado((e) => ({ ...e, opcoes: e.opcoes.map((o, i) => (i === idx ? { ...o, ...parcial } : o)) }));

  const pedirFechar = () => {
    if (aplicando) return;
    if (alterou) setConfirmarDescarte(true);
    else onFechar();
  };

  const avisoPersonalizados = simulacao?.personalizadosSubstituidos ?? 0;
  const avisoAuditorias = simulacao?.auditoriasVinculadas ?? 0;
  const temAviso = avisoPersonalizados > 0 || avisoAuditorias > 0;
  const textoAvisoPersonalizados =
    avisoPersonalizados === 1
      ? '1 das perguntas já tem opções personalizadas e elas serão substituídas.'
      : `${avisoPersonalizados} das perguntas já têm opções personalizadas e elas serão substituídas.`;
  const textoAvisoAuditorias = `Este checklist tem ${avisoAuditorias} ${avisoAuditorias === 1 ? 'auditoria' : 'auditorias'}; pontuação e exigências delas passam a seguir a nova configuração.`;

  const afetados = simulacao?.totalAfetados ?? 0;
  const podeAplicar = alterou && opcoesOk && !simulando && !aplicando && simulacao !== null && afetados > 0;

  const aplicar = async () => {
    setAplicando(true);
    try {
      const r = await checklistService.configurarLote(templateId, montarRequisicaoLote(escopo, estado, false));
      toastService.success(`Configuração aplicada em ${perguntas(r.totalAfetados)}`);
      setConfirmarAplicar(false);
      onAplicado(r);
      onFechar();
    } catch {
      // Erro já é tratado pelo interceptor
      setConfirmarAplicar(false);
    } finally {
      setAplicando(false);
    }
  };

  const pedirAplicar = () => {
    if (!podeAplicar) return;
    if (temAviso) setConfirmarAplicar(true);
    else void aplicar();
  };

  const corpo = (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Ligue só o que quer mudar. O que ficar desligado continua como está em cada pergunta.
      </p>

      <Secao
        titulo="Tipo de resposta"
        subtitulo="Como o auditor responde"
        ligada={estado.ligadas.tipoResposta}
        travada={travadas.tipoResposta}
        onLigar={(v) => ligar('tipoResposta', v)}
      >
        <Segmentos valor={estado.tipoResposta} opcoes={TIPOS_RESPOSTA} onChange={trocarTipo} />
        {TEXTO_TIPO[estado.tipoResposta] && (
          <p className="text-xs text-muted-foreground">{TEXTO_TIPO[estado.tipoResposta]}</p>
        )}
      </Secao>

      <Secao
        titulo="Opções, pontuação e exigências"
        subtitulo="Vale para todas as perguntas"
        ligada={estado.ligadas.opcoes}
        travada={travadas.opcoes}
        onLigar={(v) => ligar('opcoes', v)}
      >
        <div className="grid grid-cols-[minmax(0,1fr)_64px_36px_36px] items-center gap-2 text-xs font-medium text-muted-foreground">
          <span>Opção</span>
          <span className="text-center">Pontos</span>
          <span className="text-center">Foto</span>
          <span className="text-center">Obs.</span>
        </div>
        {estado.opcoes.map((o, idx) => {
          const editavel = estado.tipoResposta === 'personalizada';
          return (
            <div key={idx} className="grid grid-cols-[minmax(0,1fr)_64px_36px_36px] items-center gap-2">
              {editavel ? (
                <div className="flex min-w-0 items-center gap-1">
                  <input
                    type="text"
                    value={o.valor}
                    onChange={(e) => atualizarOpcao(idx, { valor: e.target.value })}
                    placeholder="Nome da opção"
                    aria-label={`Nome da opção ${idx + 1}`}
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-card px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Tooltip content="Remover opção">
                  <button
                    type="button"
                    aria-label={`Remover opção ${o.valor || idx + 1}`}
                    onClick={() => setEstado((e) => ({ ...e, opcoes: e.opcoes.filter((_, i) => i !== idx) }))}
                    className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-muted"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  </Tooltip>
                </div>
              ) : (
                <span className="truncate text-sm">{ROTULO_PADRAO[o.valor] ?? o.valor}</span>
              )}
              <input
                type="number"
                min={-10}
                max={10}
                value={o.pontuacao ?? ''}
                placeholder="—"
                aria-label={`Pontos de ${ROTULO_PADRAO[o.valor] ?? (o.valor || `opção ${idx + 1}`)}`}
                onChange={(e) => {
                  const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                  atualizarOpcao(idx, { pontuacao: v === null || Number.isNaN(v) ? null : v });
                }}
                className="h-9 w-full rounded-md border border-input bg-card px-2 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Tooltip content="Foto obrigatória">
              <button
                type="button"
                aria-pressed={o.fotoObrigatoria}
                aria-label="Foto obrigatória"
                onClick={() => atualizarOpcao(idx, { fotoObrigatoria: !o.fotoObrigatoria })}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
                  o.fotoObrigatoria ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
                )}
              >
                <Camera className="h-4 w-4" />
              </button>
              </Tooltip>
              <Tooltip content="Observação obrigatória">
              <button
                type="button"
                aria-pressed={o.observacaoObrigatoria}
                aria-label="Observação obrigatória"
                onClick={() => atualizarOpcao(idx, { observacaoObrigatoria: !o.observacaoObrigatoria })}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
                  o.observacaoObrigatoria ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
                )}
              >
                <MessageSquare className="h-4 w-4" />
              </button>
              </Tooltip>
            </div>
          );
        })}
        {estado.tipoResposta === 'personalizada' && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setEstado((e) => ({
                  ...e,
                  opcoes: [...e.opcoes, { valor: '', pontuacao: null, fotoObrigatoria: false, observacaoObrigatoria: false }],
                }))
              }
            >
              <Plus className="h-4 w-4" />
              Adicionar opção
            </Button>
          </div>
        )}
        {!opcoesOk && (
          <p className="text-xs text-destructive">Dê um nome diferente a cada opção para continuar.</p>
        )}
      </Secao>

      <Secao
        titulo="Permitir fotos"
        subtitulo="O auditor pode anexar fotos na resposta"
        ligada={estado.ligadas.permiteFoto}
        travada={travadas.permiteFoto}
        onLigar={(v) => ligar('permiteFoto', v)}
      >
        <ValorSwitch
          checked={estado.permiteFoto}
          onChange={(v) => setEstado((e) => ({ ...e, permiteFoto: v }))}
          rotulo={estado.permiteFoto ? 'Fotos permitidas' : 'Fotos não permitidas'}
        />
      </Secao>

      <Secao
        titulo="Permitir observação"
        subtitulo="O auditor pode escrever uma observação"
        ligada={estado.ligadas.permiteObservacao}
        travada={travadas.permiteObservacao}
        onLigar={(v) => ligar('permiteObservacao', v)}
      >
        <ValorSwitch
          checked={estado.permiteObservacao}
          onChange={(v) => setEstado((e) => ({ ...e, permiteObservacao: v }))}
          rotulo={estado.permiteObservacao ? 'Observação permitida' : 'Observação não permitida'}
        />
      </Secao>

      <Secao
        titulo="Pergunta obrigatória"
        subtitulo="A auditoria só finaliza com esta pergunta respondida"
        ligada={estado.ligadas.obrigatorio}
        travada={travadas.obrigatorio}
        onLigar={(v) => ligar('obrigatorio', v)}
      >
        <ValorSwitch
          checked={estado.obrigatorio}
          onChange={(v) => setEstado((e) => ({ ...e, obrigatorio: v }))}
          rotulo={estado.obrigatorio ? 'Obrigatória' : 'Opcional'}
        />
      </Secao>

      <Secao
        titulo="Criticidade"
        subtitulo="Importância da pergunta na avaliação"
        ligada={estado.ligadas.criticidade}
        travada={travadas.criticidade}
        onLigar={(v) => ligar('criticidade', v)}
      >
        <Segmentos
          valor={estado.criticidade}
          opcoes={(Object.values(CriticidadeItem) as CriticidadeItem[]).map((c) => ({ valor: c, rotulo: CRITICIDADE_LABELS[c] }))}
          onChange={(c) => setEstado((e) => ({ ...e, criticidade: c }))}
        />
      </Secao>
    </div>
  );

  const rodape = (
    <div className="flex w-full flex-col gap-3">
      <div className="text-sm" aria-live="polite">
        {!alterou ? (
          <p className="text-muted-foreground">Ligue o que quer mudar para ver quantas perguntas serão alteradas.</p>
        ) : simulando ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Calculando o impacto…
          </p>
        ) : simulacao ? (
          <p className="font-medium text-foreground">
            {afetados === 0 ? 'Nenhuma pergunta muda com esta configuração.' : `Vai alterar ${perguntas(afetados)}`}
          </p>
        ) : opcoesOk ? (
          <p className="text-destructive">Não foi possível calcular o impacto. Tente novamente.</p>
        ) : null}
      </div>
      {temAviso && !simulando && (
        <div className="flex items-start gap-2 rounded-md bg-warning/15 p-3 text-xs text-[hsl(32_95%_34%)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            {avisoPersonalizados > 0 && <p>{textoAvisoPersonalizados}</p>}
            {avisoAuditorias > 0 && <p>{textoAvisoAuditorias}</p>}
          </div>
        </div>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={pedirFechar} disabled={aplicando}>
          Cancelar
        </Button>
        <Button onClick={pedirAplicar} disabled={!podeAplicar}>
          {aplicando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Aplicando…
            </>
          ) : afetados > 0 ? (
            `Aplicar em ${perguntas(afetados)}`
          ) : (
            'Aplicar'
          )}
        </Button>
      </div>
    </div>
  );

  const titulo = 'Configurar em lote';
  const descricao = descricaoEscopo(escopo);

  return (
    <>
      {desktop ? (
        <Sheet open={aberto} onOpenChange={(o) => !o && pedirFechar()}>
          <SheetContent
            side="right"
            className="flex w-full flex-col gap-0 p-0 sm:max-w-[560px]"
            onInteractOutside={(e) => e.preventDefault()}
          >
            <SheetHeader className="border-b border-border px-6 py-4 pr-12">
              <SheetTitle>{titulo}</SheetTitle>
              <SheetDescription>{descricao}</SheetDescription>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">{corpo}</div>
            <SheetFooter className="border-t border-border px-6 py-4 sm:space-x-0">{rodape}</SheetFooter>
          </SheetContent>
        </Sheet>
      ) : (
        <Drawer open={aberto} onOpenChange={(o) => !o && pedirFechar()}>
          <DrawerContent className="flex max-h-[92vh] flex-col" onInteractOutside={(e) => e.preventDefault()}>
            <DrawerHeader className="border-b border-border text-left">
              <DrawerTitle>{titulo}</DrawerTitle>
              <DrawerDescription>{descricao}</DrawerDescription>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto px-4 py-4">{corpo}</div>
            <DrawerFooter className="border-t border-border pb-[max(1rem,env(safe-area-inset-bottom))]">{rodape}</DrawerFooter>
          </DrawerContent>
        </Drawer>
      )}

      <ConfirmDialog
        open={confirmarDescarte}
        onClose={() => setConfirmarDescarte(false)}
        onConfirm={() => {
          setConfirmarDescarte(false);
          onFechar();
        }}
        title="Descartar alterações?"
        message="Você ligou opções que ainda não foram aplicadas. Se fechar agora, elas serão perdidas."
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        variant="warning"
      />

      <ConfirmDialog
        open={confirmarAplicar}
        onClose={() => setConfirmarAplicar(false)}
        onConfirm={aplicar}
        title="Aplicar configuração?"
        message={[avisoPersonalizados > 0 ? textoAvisoPersonalizados : '', avisoAuditorias > 0 ? textoAvisoAuditorias : '']
          .filter(Boolean)
          .join(' ')}
        confirmLabel={`Aplicar em ${perguntas(afetados)}`}
        cancelLabel="Voltar"
        variant="warning"
        loading={aplicando}
      />
    </>
  );
}

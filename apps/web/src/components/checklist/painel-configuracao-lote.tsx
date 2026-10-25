'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Loader2, Lock } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EditorRespostasLote } from '@/components/checklist/editor-respostas-lote';
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
  adicionarOpcao,
  estadoInicialLote,
  montarRequisicaoLote,
  motivoRequisicaoInvalida,
  moverOpcao,
  opcoesComuns,
  opcoesValidas,
  problemasOpcoes,
  removerOpcao,
  renomearOpcao,
  renomeiaRespostaUsada,
  secoesTravadas,
  temAlteracao,
  trocarTipoLote,
  type EscopoLote,
  type EstadoLote,
  type SecaoLote,
} from '@/lib/checklist/configuracao-lote';
import {
  checklistService,
  CRITICIDADE_LABELS,
  CriticidadeItem,
  type OpcaoLote,
  type RespostaEmUso,
  type ResultadoLote,
  type TemplateItem,
  type TipoRespostaLote,
} from '@/lib/api';
import { cn } from '@/lib/cn';
import { toastService } from '@/lib/toast';

export type { EscopoLote };

interface PainelConfiguracaoLoteProps {
  aberto: boolean;
  onFechar: () => void;
  templateId: string;
  escopo: EscopoLote;
  /** Perguntas do escopo: quando todas têm as mesmas opções personalizadas, o painel parte delas. */
  itens: TemplateItem[];
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

const DELAY_SIMULACAO_MS = 400;

let sequenciaChave = 0;
/** Chave estável de cada resposta na lista (o texto muda enquanto o gestor digita). */
const novaChave = () => `resposta-${++sequenciaChave}`;

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
export function PainelConfiguracaoLote({ aberto, onFechar, templateId, escopo, itens, onAplicado }: PainelConfiguracaoLoteProps) {
  const desktop = useMediaQuery('(min-width: 768px)');
  const [estado, setEstado] = useState<EstadoLote>(estadoInicialLote);
  const [chaves, setChaves] = useState<string[]>(() => estado.opcoes.map(novaChave));
  const [emUso, setEmUso] = useState<RespostaEmUso[]>([]);
  // Última resposta removida, para "Desfazer"; some na próxima ação
  // Arraste de resposta em andamento: o Esc dele cancela o arraste, não fecha o painel
  const arrastandoRef = useRef(false);
  const [remocao, setRemocao] = useState<{ opcao: OpcaoLote; indice: number; chave: string } | null>(null);
  const [simulacao, setSimulacao] = useState<ResultadoLote | null>(null);
  const [simulando, setSimulando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = useState(false);
  const [confirmarAplicar, setConfirmarAplicar] = useState(false);

  // Cada abertura começa do zero.
  useEffect(() => {
    if (aberto) {
      const inicial = estadoInicialLote();
      setEstado(inicial);
      setChaves(inicial.opcoes.map(novaChave));
      setEmUso([]);
      setRemocao(null);
      arrastandoRef.current = false;
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
  const comuns = useMemo(() => opcoesComuns(itens), [itens]);
  const problemaOpcoes = !opcoesAtivas
    ? null
    : estado.tipoResposta === 'personalizada'
      ? problemasOpcoes(estado.opcoes)
      : opcoesValidas(estado.opcoes)
        ? null
        : 'Dê um nome diferente a cada opção para continuar.';
  const opcoesOk = problemaOpcoes === null;
  // Configuração que a API recusaria não é simulada nem aplicada
  const motivoInvalido = alterou ? motivoRequisicaoInvalida(estado, emUso) : null;
  const requisicaoOk = motivoInvalido === null;

  // Simulação com debounce a cada mudança.
  useEffect(() => {
    if (!aberto) return;
    if (!alterou || !requisicaoOk) {
      setSimulacao(null);
      setSimulando(false);
      return;
    }
    let cancelado = false;
    setSimulando(true);
    const timer = setTimeout(async () => {
      try {
        const r = await checklistService.configurarLote(templateId, montarRequisicaoLote(escopo, estado, true));
        if (!cancelado) {
          setSimulacao(r);
          // O uso das respostas depende só das perguntas do escopo: fica guardado entre simulações
          setEmUso(r.respostasEmUso ?? []);
        }
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
  }, [aberto, alterou, requisicaoOk, estado, escopo, templateId]);

  const ligar = (secao: SecaoLote, v: boolean) => {
    setRemocao(null);
    setEstado((e) => ({ ...e, ligadas: { ...e.ligadas, [secao]: v } }));
  };

  const trocarTipo = (tipo: TipoRespostaLote) => {
    const novo = trocarTipoLote(estado, tipo, comuns);
    setRemocao(null);
    setEstado(novo);
    if (novo.opcoes !== estado.opcoes) setChaves(novo.opcoes.map(novaChave));
  };

  const mudarOpcoes = (opcoes: OpcaoLote[], novasChaves: string[] = chaves) => {
    setRemocao(null);
    setEstado((e) => ({ ...e, opcoes }));
    setChaves(novasChaves);
  };

  const atualizarOpcao = (idx: number, parcial: Partial<OpcaoLote>) =>
    mudarOpcoes(estado.opcoes.map((o, i) => (i === idx ? { ...o, ...parcial } : o)));

  const removerResposta = (idx: number) => {
    const opcao = estado.opcoes[idx];
    const chave = chaves[idx];
    mudarOpcoes(removerOpcao(estado.opcoes, idx), removerOpcao(chaves, idx));
    setRemocao({ opcao, indice: idx, chave });
  };

  const desfazerRemocao = () => {
    if (!remocao) return;
    const indice = Math.min(remocao.indice, estado.opcoes.length);
    const opcoes = [...estado.opcoes];
    opcoes.splice(indice, 0, remocao.opcao);
    const novasChaves = [...chaves];
    novasChaves.splice(indice, 0, remocao.chave);
    mudarOpcoes(opcoes, novasChaves);
  };

  const pedirFechar = () => {
    if (aplicando || arrastandoRef.current) return;
    if (alterou) setConfirmarDescarte(true);
    else onFechar();
  };

  const avisoPersonalizados = simulacao?.personalizadosSubstituidos ?? 0;
  const avisoAuditorias = simulacao?.auditoriasVinculadas ?? 0;
  // Renomear resposta já usada também muda o texto das respostas já dadas (RN-CHK-018)
  const avisoRenomeacao =
    opcoesAtivas && estado.tipoResposta === 'personalizada' && renomeiaRespostaUsada(estado.opcoes, emUso);
  const textoAvisoRenomeacao = 'As respostas já dadas em auditorias serão atualizadas para o novo texto.';
  const temAviso = avisoPersonalizados > 0 || avisoAuditorias > 0 || avisoRenomeacao;
  const textoAvisoPersonalizados =
    avisoPersonalizados === 1
      ? '1 das perguntas já tem opções personalizadas e elas serão substituídas.'
      : `${avisoPersonalizados} das perguntas já têm opções personalizadas e elas serão substituídas.`;
  const textoAvisoAuditorias = `Este checklist tem ${avisoAuditorias} ${avisoAuditorias === 1 ? 'auditoria' : 'auditorias'}; pontuação e exigências delas passam a seguir a nova configuração.`;

  const afetados = simulacao?.totalAfetados ?? 0;
  const podeAplicar = alterou && requisicaoOk && !simulando && !aplicando && simulacao !== null && afetados > 0;

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
        titulo="Respostas"
        subtitulo={
          estado.tipoResposta === 'personalizada'
            ? desktop
              ? 'Arraste pela alça para mudar a ordem. É nesta ordem que o auditor vê.'
              : 'Segure a alça e arraste para mudar a ordem. É nesta ordem que o auditor vê.'
            : 'Pontuação e exigências de cada resposta'
        }
        ligada={estado.ligadas.opcoes}
        travada={travadas.opcoes}
        onLigar={(v) => ligar('opcoes', v)}
      >
        <EditorRespostasLote
          tipo={estado.tipoResposta}
          opcoes={estado.opcoes}
          chaves={chaves}
          emUso={emUso}
          compacto={!desktop}
          removida={remocao ? remocao.opcao.valor : null}
          onAtualizar={atualizarOpcao}
          onRenomear={(idx, valor) => mudarOpcoes(renomearOpcao(estado.opcoes, idx, valor))}
          onRemover={removerResposta}
          onAdicionar={() => mudarOpcoes(adicionarOpcao(estado.opcoes), [...chaves, novaChave()])}
          onMover={(de, para) => mudarOpcoes(moverOpcao(estado.opcoes, de, para), moverOpcao(chaves, de, para))}
          onDesfazer={desfazerRemocao}
          onArrastandoChange={(v) => {
            arrastandoRef.current = v;
          }}
        />
        {problemaOpcoes && <p className="text-xs text-destructive">{problemaOpcoes}</p>}
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
        ) : !requisicaoOk ? (
          // Nomes repetidos/vazios já são avisados junto às opções
          opcoesOk ? <p className="text-destructive">{motivoInvalido}</p> : null
        ) : (
          <p className="text-destructive">Não foi possível calcular o impacto. Tente novamente.</p>
        )}
      </div>
      {temAviso && !simulando && (
        <div className="flex items-start gap-2 rounded-md bg-warning/15 p-3 text-xs text-[hsl(32_95%_34%)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            {avisoPersonalizados > 0 && <p>{textoAvisoPersonalizados}</p>}
            {avisoAuditorias > 0 && <p>{textoAvisoAuditorias}</p>}
            {avisoRenomeacao && <p>{textoAvisoRenomeacao}</p>}
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
            onEscapeKeyDown={(e) => {
              if (arrastandoRef.current) e.preventDefault();
            }}
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
          <DrawerContent
            className="flex max-h-[92vh] flex-col"
            onInteractOutside={(e) => e.preventDefault()}
            onEscapeKeyDown={(e) => {
              if (arrastandoRef.current) e.preventDefault();
            }}
          >
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
        message={[
          avisoPersonalizados > 0 ? textoAvisoPersonalizados : '',
          avisoAuditorias > 0 ? textoAvisoAuditorias : '',
          avisoRenomeacao ? textoAvisoRenomeacao : '',
        ]
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

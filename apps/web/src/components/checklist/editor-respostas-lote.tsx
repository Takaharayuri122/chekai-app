'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Camera, GripVertical, MessageSquare, Plus, Trash2 } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/shadcn/button';
import { lerPontos } from '@/lib/checklist/configuracao-lote';
import type { OpcaoLote, RespostaEmUso, TipoRespostaLote } from '@/lib/api';
import { cn } from '@/lib/cn';

const ROTULO_PADRAO: Record<string, string> = {
  conforme: 'Conforme',
  nao_conforme: 'Não conforme',
  nao_aplicavel: 'Não aplicável',
  nao_avaliado: 'Não avaliado',
};

/** Colunas da linha no computador: alça, texto, pontos, foto, obs., remover. */
const GRADE_PERSONALIZADA = 'grid grid-cols-[28px_minmax(0,1fr)_64px_40px_40px_36px] items-center gap-2';
const GRADE_PADRAO = 'grid grid-cols-[minmax(0,1fr)_64px_40px_40px] items-center gap-2';

interface EditorRespostasLoteProps {
  tipo: TipoRespostaLote;
  opcoes: OpcaoLote[];
  /** Chaves estáveis paralelas a `opcoes` (identificam cada linha durante o arraste). */
  chaves: string[];
  emUso: RespostaEmUso[];
  /** Celular: cada resposta vira um cartão de duas linhas, com alvos de 44px. */
  compacto: boolean;
  removida: string | null;
  onAtualizar: (indice: number, parcial: Partial<OpcaoLote>) => void;
  onRenomear: (indice: number, valor: string) => void;
  onRemover: (indice: number) => void;
  onAdicionar: () => void;
  onMover: (de: number, para: number) => void;
  onDesfazer: () => void;
}

function auditorias(n: number): string {
  return n === 1 ? '1 auditoria' : `${n} auditorias`;
}

function nomeOpcao(o: OpcaoLote, indice: number): string {
  return ROTULO_PADRAO[o.valor] ?? (o.valor.trim() || `resposta ${indice + 1}`);
}

function CampoPontos({ opcao, indice, tipo, compacto, onAtualizar }: {
  opcao: OpcaoLote;
  indice: number;
  tipo: TipoRespostaLote;
  compacto: boolean;
  onAtualizar: EditorRespostasLoteProps['onAtualizar'];
}) {
  return (
    <input
      type="number"
      min={-10}
      max={10}
      value={opcao.pontuacao ?? ''}
      placeholder="—"
      aria-label={`Pontos de ${nomeOpcao(opcao, indice)}`}
      onChange={(e) => onAtualizar(indice, { pontuacao: lerPontos(e.target.value, opcao.valor, tipo) })}
      className={cn(
        'rounded-md border border-input bg-card px-2 text-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
        compacto ? 'h-11 w-[72px]' : 'h-9 w-full',
      )}
    />
  );
}

function Alternar({ ativo, rotulo, curto, icone, compacto, onClick }: {
  ativo: boolean;
  rotulo: string;
  curto: string;
  icone: ReactNode;
  compacto: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip content={rotulo}>
      <button
        type="button"
        aria-pressed={ativo}
        aria-label={rotulo}
        onClick={onClick}
        className={cn(
          'flex items-center justify-center gap-1.5 border transition-colors',
          compacto ? 'h-11 rounded-full px-4 text-[13px] font-semibold' : 'h-9 w-10 rounded-md',
          ativo ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground',
        )}
      >
        {icone}
        {compacto && curto}
      </button>
    </Tooltip>
  );
}

interface LinhaProps {
  opcao: OpcaoLote;
  indice: number;
  tipo: TipoRespostaLote;
  compacto: boolean;
  uso?: RespostaEmUso;
  alca?: { attributes: DraggableAttributes; listeners: DraggableSyntheticListeners; setActivatorNodeRef: (el: HTMLElement | null) => void };
  levantada?: boolean;
  onAtualizar: EditorRespostasLoteProps['onAtualizar'];
  onRenomear: EditorRespostasLoteProps['onRenomear'];
  onRemover: EditorRespostasLoteProps['onRemover'];
}

/** Uma resposta personalizada: alça, texto, pontos, foto, observação e remover. */
function LinhaPersonalizada({ opcao, indice, tipo, compacto, uso, alca, levantada, onAtualizar, onRenomear, onRemover }: LinhaProps) {
  const nome = nomeOpcao(opcao, indice);
  const alcaBotao = (
    <button
      type="button"
      ref={alca?.setActivatorNodeRef}
      {...alca?.attributes}
      {...alca?.listeners}
      data-vaul-no-drag
      aria-label={`Arrastar para reordenar ${nome}`}
      className={cn(
        'flex shrink-0 touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        levantada ? 'cursor-grabbing bg-primary/10 text-primary' : 'cursor-grab',
        compacto ? 'h-11 w-11' : 'h-9 w-7',
      )}
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  );
  const texto = (
    <input
      type="text"
      value={opcao.valor}
      onChange={(e) => onRenomear(indice, e.target.value)}
      placeholder="Texto da resposta"
      aria-label={`Texto da resposta ${indice + 1}`}
      className={cn(
        'min-w-0 flex-1 rounded-md border border-input bg-card px-2.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
        compacto ? 'h-11 text-[15px]' : 'h-9 w-full',
      )}
    />
  );
  const remover = (
    <Tooltip content={uso ? `Usada em ${auditorias(uso.auditorias)}` : 'Remover resposta'}>
      <button
        type="button"
        disabled={Boolean(uso)}
        aria-label={uso ? `${nome}: usada em ${auditorias(uso.auditorias)}, não pode ser removida` : `Remover resposta ${nome}`}
        onClick={() => onRemover(indice)}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:pointer-events-none disabled:opacity-40',
          compacto ? 'h-11 w-11' : 'h-9 w-9',
        )}
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </Tooltip>
  );
  const foto = (
    <Alternar
      ativo={opcao.fotoObrigatoria}
      rotulo="Foto obrigatória"
      curto="Foto"
      compacto={compacto}
      icone={<Camera className="h-4 w-4" aria-hidden />}
      onClick={() => onAtualizar(indice, { fotoObrigatoria: !opcao.fotoObrigatoria })}
    />
  );
  const obs = (
    <Alternar
      ativo={opcao.observacaoObrigatoria}
      rotulo="Observação obrigatória"
      curto="Obs."
      compacto={compacto}
      icone={<MessageSquare className="h-4 w-4" aria-hidden />}
      onClick={() => onAtualizar(indice, { observacaoObrigatoria: !opcao.observacaoObrigatoria })}
    />
  );
  const pontos = <CampoPontos opcao={opcao} indice={indice} tipo={tipo} compacto={compacto} onAtualizar={onAtualizar} />;

  const destaque = levantada && 'shadow-xl ring-2 ring-primary';
  if (compacto) {
    return (
      <div className={cn('flex flex-col gap-2 rounded-xl border border-border bg-card p-2 pb-2.5', destaque)}>
        <div className="flex items-center gap-1.5">
          {alcaBotao}
          {texto}
          {remover}
        </div>
        <div className="flex items-center gap-2 pl-[50px]">
          {pontos}
          {foto}
          {obs}
        </div>
      </div>
    );
  }
  return (
    <div className={cn(GRADE_PERSONALIZADA, 'rounded-lg bg-card px-2 py-1.5', destaque)}>
      {alcaBotao}
      {texto}
      {pontos}
      {foto}
      {obs}
      {remover}
    </div>
  );
}

function LinhaOrdenavel(props: Omit<LinhaProps, 'alca' | 'levantada'> & { chave: string; posicao: number }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.chave,
  });
  const estilo: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  if (isDragging) {
    // Espaço onde a resposta vai cair
    return (
      <div
        ref={setNodeRef}
        style={estilo}
        aria-hidden
        className={cn(
          'flex items-center justify-center rounded-lg border-2 border-dashed border-primary/60 bg-primary/5 text-xs font-semibold text-primary',
          props.compacto ? 'h-[104px] rounded-xl' : 'h-12',
        )}
      >
        Soltar aqui · posição {props.posicao}
      </div>
    );
  }
  return (
    <div ref={setNodeRef} style={estilo}>
      <LinhaPersonalizada {...props} alca={{ attributes, listeners, setActivatorNodeRef }} />
    </div>
  );
}

/**
 * Respostas da configuração em lote. Personalizadas: editar texto, remover, adicionar e reordenar
 * pela alça (mouse, toque ou teclado). Padrão: textos e ordem fixos (RN-CHK-018).
 */
export function EditorRespostasLote({
  tipo,
  opcoes,
  chaves,
  emUso,
  compacto,
  removida,
  onAtualizar,
  onRenomear,
  onRemover,
  onAdicionar,
  onMover,
  onDesfazer,
}: EditorRespostasLoteProps) {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [destino, setDestino] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (tipo !== 'personalizada') {
    return (
      <>
        <div className={cn(GRADE_PADRAO, 'text-xs font-medium text-muted-foreground')}>
          <span>Resposta</span>
          <span className="text-center">Pontos</span>
          <span className="text-center">Foto</span>
          <span className="text-center">Obs.</span>
        </div>
        {opcoes.map((o, idx) => (
          <div key={o.valor} className={GRADE_PADRAO}>
            <span className="truncate text-sm">{nomeOpcao(o, idx)}</span>
            <CampoPontos opcao={o} indice={idx} tipo={tipo} compacto={false} onAtualizar={onAtualizar} />
            <Alternar
              ativo={o.fotoObrigatoria}
              rotulo="Foto obrigatória"
              curto="Foto"
              compacto={false}
              icone={<Camera className="h-4 w-4" aria-hidden />}
              onClick={() => onAtualizar(idx, { fotoObrigatoria: !o.fotoObrigatoria })}
            />
            <Alternar
              ativo={o.observacaoObrigatoria}
              rotulo="Observação obrigatória"
              curto="Obs."
              compacto={false}
              icone={<MessageSquare className="h-4 w-4" aria-hidden />}
              onClick={() => onAtualizar(idx, { observacaoObrigatoria: !o.observacaoObrigatoria })}
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Para mudar os textos ou a ordem, use Opções personalizadas.</p>
      </>
    );
  }

  const usoDe = (o: OpcaoLote) => emUso.find((u) => u.valor === (o.valorOriginal ?? o.valor));
  const indiceDe = (id: string | number | null | undefined) => chaves.indexOf(String(id));
  const nomeDe = (id: string | number) => {
    const i = indiceDe(id);
    return i >= 0 ? nomeOpcao(opcoes[i], i) : 'resposta';
  };
  const origem = arrastando ? indiceDe(arrastando) : -1;
  const posicaoDestino = destino ?? origem;

  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Resposta “${nomeDe(active.id)}” pega na posição ${indiceDe(active.id) + 1}.`,
    onDragOver: ({ active, over }) =>
      over ? `“${nomeDe(active.id)}” na posição ${indiceDe(over.id) + 1}.` : `“${nomeDe(active.id)}” fora da lista.`,
    onDragEnd: ({ active, over }) =>
      over ? `“${nomeDe(active.id)}” solta na posição ${indiceDe(over.id) + 1}.` : `“${nomeDe(active.id)}” voltou ao lugar.`,
    onDragCancel: ({ active }) => `Movimento cancelado. “${nomeDe(active.id)}” voltou ao lugar.`,
  };

  const aoComecar = (e: DragStartEvent) => {
    setArrastando(String(e.active.id));
    setDestino(indiceDe(e.active.id));
  };
  const aoPassar = (e: DragOverEvent) => {
    if (e.over) setDestino(indiceDe(e.over.id));
  };
  const aoSoltar = (e: DragEndEvent) => {
    const de = indiceDe(e.active.id);
    const para = indiceDe(e.over?.id);
    setArrastando(null);
    setDestino(null);
    if (de >= 0 && para >= 0 && de !== para) onMover(de, para);
  };
  const aoCancelar = () => {
    setArrastando(null);
    setDestino(null);
  };

  const ativa = origem >= 0 ? opcoes[origem] : null;
  const total = opcoes.length;

  return (
    <>
      {!compacto && (
        <div className={cn(GRADE_PERSONALIZADA, 'px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground')}>
          <span />
          <span>Resposta</span>
          <span className="text-center">Pontos</span>
          <span className="text-center">Foto</span>
          <span className="text-center">Obs.</span>
          <span />
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={aoComecar}
        onDragOver={aoPassar}
        onDragEnd={aoSoltar}
        onDragCancel={aoCancelar}
        accessibility={{
          announcements: anuncios,
          screenReaderInstructions: {
            draggable:
              'Para mudar a ordem, pressione Espaço para pegar a resposta, use as setas para mover e Espaço de novo para soltar. Esc cancela.',
          },
        }}
      >
        <SortableContext items={chaves} strategy={verticalListSortingStrategy}>
          <div className={cn('flex flex-col', compacto ? 'gap-2.5' : 'gap-1.5')}>
            {opcoes.map((o, idx) => (
              <LinhaOrdenavel
                key={chaves[idx]}
                chave={chaves[idx]}
                posicao={posicaoDestino + 1}
                opcao={o}
                indice={idx}
                tipo={tipo}
                compacto={compacto}
                uso={usoDe(o)}
                onAtualizar={onAtualizar}
                onRenomear={onRenomear}
                onRemover={onRemover}
              />
            ))}
          </div>
        </SortableContext>
        {typeof document !== 'undefined' &&
          createPortal(
            // Fora da gaveta/painel para não herdar o transform deles; acima do z-50 dos dois
            <DragOverlay zIndex={70}>
              {ativa ? (
                <div className={compacto ? 'rotate-[-1deg]' : 'rotate-[-1.2deg]'}>
                  <LinhaPersonalizada
                    opcao={ativa}
                    indice={origem}
                    tipo={tipo}
                    compacto={compacto}
                    uso={usoDe(ativa)}
                    levantada
                    onAtualizar={() => undefined}
                    onRenomear={() => undefined}
                    onRemover={() => undefined}
                  />
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
      </DndContext>

      {ativa && (
        <p className="px-2 text-xs text-muted-foreground" aria-hidden>
          Movendo “{nomeOpcao(ativa, origem)}” da posição {origem + 1} para a {posicaoDestino + 1}
        </p>
      )}

      {removida !== null && (
        <p className="flex flex-wrap items-center gap-1 px-2 text-xs text-muted-foreground" role="status">
          Resposta “{removida.trim() || 'sem texto'}” removida ·
          <button type="button" onClick={onDesfazer} className="font-semibold text-primary underline-offset-2 hover:underline">
            Desfazer
          </button>
        </p>
      )}

      <div className={cn('flex items-center justify-between gap-2', compacto ? 'flex-col items-stretch' : 'px-2 pt-1')}>
        <Button
          variant="outline"
          size={compacto ? 'lg' : 'sm'}
          className={cn('border-dashed', compacto && 'h-11')}
          onClick={onAdicionar}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Adicionar resposta
        </Button>
        <span className={cn('text-xs text-muted-foreground', compacto && 'text-center')}>
          {total === 1 ? '1 resposta' : `${total} respostas`} · mínimo 2
        </span>
      </div>
    </>
  );
}

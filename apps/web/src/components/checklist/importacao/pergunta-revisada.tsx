'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Pencil, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/shadcn/tooltip';
import { cn } from '@/lib/cn';
import {
  CATEGORIA_ITEM_LABELS,
  CRITICIDADE_LABELS,
  type CampoRevisado,
  type ConfiguracaoPerguntaImportada,
  type PerguntaImportada,
  type SugestaoPergunta,
} from '@/lib/api';
import { diferencaPalavras } from '@/lib/checklist/revisao-importacao';

interface PerguntaRevisadaProps {
  original: PerguntaImportada;
  sugestao?: SugestaoPergunta;
  configuracao: ConfiguracaoPerguntaImportada;
  textoFinal: string;
  desfeita: boolean;
  conferida: boolean;
  editada: boolean;
  onDesfazer: () => void;
  onConferir: () => void;
  onEditar: (texto: string) => void;
}

interface Chip {
  texto: string;
  ia: boolean;
}

function listarValores(valores: string[]): string {
  return valores.join(', ');
}

function montarChips(config: ConfiguracaoPerguntaImportada, alterados: Set<CampoRevisado>): Chip[] {
  const chips: Chip[] = [
    { texto: CATEGORIA_ITEM_LABELS[config.categoria] ?? config.categoria, ia: alterados.has('categoria') },
    { texto: CRITICIDADE_LABELS[config.criticidade] ?? config.criticidade, ia: alterados.has('criticidade') },
  ];

  let tipo: string;
  if (config.tipoResposta === 'padrao') tipo = 'Resposta padrão';
  else if (config.tipoResposta === 'personalizada' && config.opcoes.length > 0) {
    tipo = config.opcoes.map((o) => o.valor).join(' · ');
  } else if (config.tipoResposta === 'texto') tipo = 'Resposta em texto';
  else if (config.tipoResposta === 'numero') tipo = 'Resposta numérica';
  else if (config.tipoResposta === 'data') tipo = 'Resposta em data';
  else tipo = 'Resposta personalizada';
  chips.push({ texto: tipo, ia: alterados.has('tipoResposta') || alterados.has('opcoes') });

  const comFoto = config.opcoes.filter((o) => o.fotoObrigatoria).map((o) => o.valor);
  chips.push({
    texto: !config.permiteFoto
      ? 'Sem fotos'
      : comFoto.length > 0
        ? `Foto obrigatória em ${listarValores(comFoto)}`
        : 'Permite foto',
    ia: alterados.has('permiteFoto'),
  });

  const comObs = config.opcoes.filter((o) => o.observacaoObrigatoria).map((o) => o.valor);
  chips.push({
    texto: !config.permiteObservacao
      ? 'Sem observação'
      : comObs.length > 0
        ? `Observação obrigatória em ${listarValores(comObs)}`
        : 'Permite observação',
    ia: alterados.has('permiteObservacao'),
  });

  chips.push({ texto: config.peso > 0 ? `Peso ${config.peso}` : 'Sem pontuação', ia: alterados.has('peso') });
  return chips;
}

function BotaoIcone({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={rotulo} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{rotulo}</TooltipContent>
    </Tooltip>
  );
}

/** Uma pergunta na revisão: texto original/corrigido, chips de configuração e ações. */
export function PerguntaRevisada({
  original,
  sugestao,
  configuracao,
  textoFinal,
  desfeita,
  conferida,
  editada,
  onDesfazer,
  onConferir,
  onEditar,
}: PerguntaRevisadaProps) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState('');

  const ativa = sugestao && !desfeita ? sugestao : undefined;
  const alterados = new Set<CampoRevisado>(ativa?.alteracoes ?? []);
  const textoCorrigido = !editada && alterados.has('pergunta');
  const motivoConferir = ativa?.motivoConferir ?? original.motivoConferir;
  const precisaConferir = !desfeita && !conferida && (!!ativa?.conferir || !!original.motivoConferir);
  const podeDesfazer = !!sugestao && sugestao.alteracoes.length > 0 && !desfeita;

  const salvar = () => {
    const texto = rascunho.trim();
    if (texto) onEditar(texto);
    setEditando(false);
  };

  return (
    <article
      className={cn(
        'flex flex-col gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:flex-row sm:items-start sm:gap-4 sm:px-5',
        precisaConferir && 'bg-warning/10',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {editando ? (
          <div className="flex flex-col gap-2">
            <Textarea value={rascunho} onChange={(e) => setRascunho(e.target.value)} rows={3} autoFocus aria-label="Texto da pergunta" />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              <Button type="button" size="sm" onClick={salvar} disabled={!rascunho.trim()}>
                Salvar texto
              </Button>
            </div>
          </div>
        ) : textoCorrigido ? (
          <div className="flex flex-col gap-1">
            <p className="text-[13px] text-muted-foreground line-through">{original.pergunta}</p>
            <p className="text-[15px] font-medium text-foreground">
              {diferencaPalavras(original.pergunta, textoFinal).map((t, i) =>
                t.alterado ? (
                  <mark key={i} className="rounded-sm bg-success/20 px-0.5 text-foreground">
                    {t.texto}
                  </mark>
                ) : (
                  <span key={i}>{t.texto}</span>
                ),
              )}
            </p>
          </div>
        ) : (
          <p className="text-[15px] font-medium text-foreground">{textoFinal}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {montarChips(configuracao, alterados).map((c, i) => (
            <span
              key={i}
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                c.ia ? 'bg-info/15 text-info' : 'bg-muted text-muted-foreground',
              )}
            >
              {c.texto}
            </span>
          ))}
        </div>

        {precisaConferir && motivoConferir ? (
          <p className="flex items-start gap-2 text-[13px] text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <span>{motivoConferir}</span>
          </p>
        ) : ativa?.motivo ? (
          <p className="text-[13px] text-muted-foreground">{ativa.motivo}</p>
        ) : null}
        {desfeita ? <p className="text-[13px] text-muted-foreground">Sugestões desfeitas: vale o que veio na planilha.</p> : null}
      </div>

      <div className="flex shrink-0 gap-1.5">
        {precisaConferir ? (
          <Button type="button" variant="outline" onClick={onConferir}>
            <Check /> Está certo
          </Button>
        ) : null}
        {podeDesfazer ? (
          <BotaoIcone rotulo="Desfazer sugestões desta pergunta" onClick={onDesfazer}>
            <Undo2 />
          </BotaoIcone>
        ) : null}
        <BotaoIcone
          rotulo="Editar texto"
          onClick={() => {
            setRascunho(textoFinal);
            setEditando(true);
          }}
        >
          <Pencil />
        </BotaoIcone>
      </div>
    </article>
  );
}

'use client';

import { Camera, Check, ChevronLeft, ChevronRight, MessageSquare, Sparkles } from 'lucide-react';
import type { AuditoriaItem } from '@/lib/api';
import { aceitaFoto, aceitaObservacao, exigenciasDaResposta, type SecaoRegistro } from '@/lib/auditoria/execucao';
import { nomesLegislacoesDoItem } from '@/lib/legislacao/legislacoes-do-item';
import { Button } from '@/components/ui/shadcn/button';

interface PainelItemProps {
  item: AuditoriaItem;
  numero: number;
  total: number;
  anterior: AuditoriaItem | null;
  proximo: AuditoriaItem | null;
  somenteLeitura: boolean;
  respostas: React.ReactNode;
  onNavegar: (id: string) => void;
  onDocumentar: (secao: SecaoRegistro) => void;
}

export function PainelItem({ item, numero, total, anterior, proximo, somenteLeitura, respostas, onNavegar, onDocumentar }: PainelItemProps) {
  const t = item.templateItem;
  const nomePergunta = nomesLegislacoesDoItem({ legislacoes: t.legislacoes, referenciaLegal: t.legislacaoReferencia });
  const nomeItem = nomesLegislacoesDoItem(item);
  const fotoOk = aceitaFoto(item);
  const obsOk = aceitaObservacao(item);
  const qtdFotos = item.fotos?.length ?? 0;
  const temObservacao = Boolean(item.observacao?.trim());
  const exige = exigenciasDaResposta(item);
  const mostrarFotos = somenteLeitura ? qtdFotos > 0 : fotoOk || qtdFotos > 0;
  const mostrarObs = somenteLeitura ? temObservacao : obsOk || temObservacao;
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Pergunta {numero} de {total}
            {t.obrigatorio && <span className="text-destructive"> · obrigatória</span>}
          </p>
          <h2 className="font-display text-lg font-semibold leading-snug">{t.pergunta}</h2>
          {nomePergunta && <p className="text-xs text-info">{nomePergunta}</p>}
        </div>

        {respostas}

        {(mostrarFotos || mostrarObs) && (
        <div className="space-y-2">
          <div className={`grid gap-2 ${mostrarFotos && mostrarObs ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {mostrarFotos && (
              <BotaoRegistro
                icone={<Camera className="h-4 w-4 text-primary" />}
                rotulo={somenteLeitura || !fotoOk ? 'Ver fotos' : 'Fotos'}
                detalhe={qtdFotos > 0 ? `${qtdFotos} foto${qtdFotos > 1 ? 's' : ''}` : null}
                obrigatorio={exige.fotoObrigatoria && qtdFotos === 0}
                extra={item.descricaoIa ? <Sparkles className="h-3.5 w-3.5 text-primary" /> : null}
                onClick={() => onDocumentar('fotos')}
              />
            )}
            {mostrarObs && (
              <BotaoRegistro
                icone={<MessageSquare className="h-4 w-4 text-primary" />}
                rotulo={somenteLeitura || !obsOk ? 'Ver observação' : 'Observação'}
                detalhe={temObservacao ? <Check className="h-3.5 w-3.5" aria-label="Preenchida" /> : null}
                obrigatorio={exige.observacaoObrigatoria && !temObservacao}
                onClick={() => onDocumentar('observacao')}
              />
            )}
          </div>
          {(item.observacao || item.descricaoIa) && (
            <details className="rounded-lg border border-border px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-muted-foreground">Detalhes registrados</summary>
              <div className="mt-2 space-y-2">
                {item.descricaoIa && (
                  <p>
                    <span className="font-medium">Análise da imagem: </span>
                    {item.descricaoIa}
                  </p>
                )}
                {item.observacao && (
                  <p>
                    <span className="font-medium">Observação: </span>
                    {item.observacao}
                  </p>
                )}
                {nomeItem && <p className="text-info">{nomeItem}</p>}
              </div>
            </details>
          )}
        </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
        <Button variant="outline" className="h-11 flex-1" disabled={!anterior} onClick={() => anterior && onNavegar(anterior.id)}>
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <Button className="h-11 flex-1" disabled={!proximo} onClick={() => proximo && onNavegar(proximo.id)}>
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface BotaoRegistroProps {
  icone: React.ReactNode;
  rotulo: string;
  detalhe: React.ReactNode;
  obrigatorio: boolean;
  extra?: React.ReactNode;
  onClick: () => void;
}

function BotaoRegistro({ icone, rotulo, detalhe, obrigatorio, extra, onClick }: BotaoRegistroProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-h-[52px] w-full items-center justify-between gap-2 rounded-lg border px-3 text-left hover:bg-muted/60 ${
        obrigatorio ? 'border-destructive/50' : 'border-border'
      }`}
    >
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-2 text-sm font-medium">
          {icone}
          <span className="truncate">{rotulo}</span>
        </span>
        {obrigatorio && <span className="pl-6 text-[11px] font-medium text-destructive">Obrigatória</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        {detalhe}
        {extra}
        <ChevronRight className="h-4 w-4" />
      </span>
    </button>
  );
}

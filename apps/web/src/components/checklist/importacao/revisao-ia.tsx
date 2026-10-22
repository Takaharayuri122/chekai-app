'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/shadcn/tabs';
import { TooltipProvider } from '@/components/ui/shadcn/tooltip';
import {
  aceitarTodas,
  contadores,
  filtrar,
  versaoFinal,
  type AbaRevisao,
  type EstadoRevisao,
} from '@/lib/checklist/revisao-importacao';
import { PerguntaRevisada } from './pergunta-revisada';

interface RevisaoIaProps {
  estado: EstadoRevisao;
  nomeArquivo: string;
  semCreditos: boolean;
  falhas: number;
  onChange: (estado: EstadoRevisao) => void;
  onVoltar: () => void;
  onContinuar: () => void;
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full items-start gap-3 rounded-md border border-warning/40 bg-warning/15 p-4 text-sm text-foreground">
      <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

/** Etapa "Revisão da IA": mostra o que a IA corrigiu/preencheu e deixa o usuário desfazer, editar ou conferir. */
export function RevisaoIa({ estado, nomeArquivo, semCreditos, falhas, onChange, onVoltar, onContinuar }: RevisaoIaProps) {
  const [aba, setAba] = useState<AbaRevisao>('todas');
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());

  const { corrigidas, sugeridas, paraConferir } = contadores(estado);
  const visiveis = filtrar(estado, aba);

  const grupos = useMemo(() => {
    const mapa = new Map<string, typeof visiveis>();
    for (const p of visiveis) {
      const lista = mapa.get(p.grupo) ?? [];
      lista.push(p);
      mapa.set(p.grupo, lista);
    }
    return [...mapa.entries()];
  }, [visiveis]);

  const alternarGrupo = (grupo: string) =>
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(grupo)) novo.delete(grupo);
      else novo.add(grupo);
      return novo;
    });

  const adicionar = (campo: 'desfeitas' | 'conferidas', chave: string) =>
    onChange({ ...estado, [campo]: new Set(estado[campo]).add(chave) });

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        {semCreditos ? (
          <Aviso>
            <p className="font-medium">Importação sem revisão da IA (créditos insuficientes)</p>
            <p className="text-muted-foreground">As perguntas entram com os valores da planilha. Você pode ajustar tudo depois no editor.</p>
          </Aviso>
        ) : null}
        {!semCreditos && falhas > 0 ? (
          <Aviso>
            <p className="font-medium">Algumas perguntas entraram sem revisão</p>
            <p className="text-muted-foreground">Não conseguimos revisar todos os grupos. Essas perguntas seguem com os valores da planilha.</p>
          </Aviso>
        ) : null}

        <section className="flex flex-wrap items-center justify-between gap-6 rounded-lg border border-border bg-card p-5 shadow-sm">
          <div className="flex min-w-0 flex-1 basis-80 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-info/15 text-info">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="font-display text-base font-semibold">
                A IA revisou as {estado.perguntas.length} perguntas de {nomeArquivo}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Corrigimos a ortografia e preenchemos o que faltava na planilha com base nas regras de boas práticas. Nada é salvo antes de você confirmar.
              </p>
            </div>
          </div>
          <div className="flex gap-6">
            <div>
              <div className="font-display text-2xl font-bold">{corrigidas}</div>
              <div className="text-xs text-muted-foreground">textos corrigidos</div>
            </div>
            <div>
              <div className="font-display text-2xl font-bold">{sugeridas}</div>
              <div className="text-xs text-muted-foreground">configurações sugeridas</div>
            </div>
            <div>
              <div className="font-display text-2xl font-bold">{paraConferir}</div>
              <div className="text-xs text-muted-foreground">para você conferir</div>
            </div>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs value={aba} onValueChange={(v) => setAba(v as AbaRevisao)}>
            <TabsList>
              <TabsTrigger value="todas">Todas ({estado.perguntas.length})</TabsTrigger>
              <TabsTrigger value="correcao">Com correção ({corrigidas})</TabsTrigger>
              <TabsTrigger value="conferir">Para conferir ({paraConferir})</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button type="button" variant="outline" onClick={() => onChange(aceitarTodas(estado))}>
            Aceitar todas as sugestões
          </Button>
        </div>

        {grupos.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Nenhuma pergunta nesta aba.
          </div>
        ) : (
          grupos.map(([grupo, perguntas]) => {
            const recolhido = recolhidos.has(grupo);
            const corrigidasGrupo = perguntas.filter((p) => versaoFinal(estado, p.chave).pergunta !== p.pergunta).length;
            return (
              <section key={grupo} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
                <button
                  type="button"
                  onClick={() => alternarGrupo(grupo)}
                  aria-expanded={!recolhido}
                  className="flex w-full items-center justify-between gap-3 border-b border-border bg-muted/50 px-4 py-3 text-left sm:px-5"
                >
                  <span className="flex min-w-0 items-center gap-2 font-display text-sm font-semibold uppercase tracking-wide">
                    {recolhido ? <ChevronRight className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{estado.nomesGrupos[grupo] ?? grupo}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {perguntas.length} perguntas · {corrigidasGrupo} corrigidas
                  </span>
                </button>
                {recolhido
                  ? null
                  : perguntas.map((p) => {
                      const final = versaoFinal(estado, p.chave);
                      return (
                        <PerguntaRevisada
                          key={p.chave}
                          original={p}
                          sugestao={estado.sugestoes[p.chave]}
                          configuracao={final.configuracao}
                          textoFinal={final.pergunta}
                          desfeita={estado.desfeitas.has(p.chave)}
                          conferida={estado.conferidas.has(p.chave)}
                          editada={p.chave in estado.edicoes}
                          onDesfazer={() => adicionar('desfeitas', p.chave)}
                          onConferir={() => adicionar('conferidas', p.chave)}
                          onEditar={(texto) => onChange({ ...estado, edicoes: { ...estado.edicoes, [p.chave]: texto } })}
                        />
                      );
                    })}
              </section>
            );
          })
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center rounded-full bg-info/15 px-2.5 py-0.5 font-medium text-info">Azul</span>
          <span>= preenchido ou alterado pela IA</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={onVoltar}>
            Voltar
          </Button>
          <Button type="button" onClick={onContinuar}>
            Continuar
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

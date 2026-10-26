'use client';

import { Calculator, Camera, CheckCircle2, ClipboardList, XCircle, type LucideIcon } from 'lucide-react';
import type { ResultadoAuditoria } from '@/lib/api';
import { Tooltip } from '@/components/ui/tooltip';
import { modeloDoCartao } from './cartao-resultado.modelo';

const ICONES: Record<string, LucideIcon> = {
  pontosPossiveis: Calculator,
  pontosRealizados: CheckCircle2,
  naoConformidades: XCircle,
  fotos: Camera,
  planosAcao: ClipboardList,
};

const formatarData = (data: string) => new Date(data).toLocaleDateString('pt-BR');

export function CartaoResultado({ resultado }: { resultado: ResultadoAuditoria }) {
  const m = modeloDoCartao(resultado);

  return (
    <section className="grid gap-4 rounded-lg border border-border bg-card p-4 shadow-sm sm:p-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
      <div className="min-w-0 space-y-4">
        <div className="flex items-center gap-3">
          {m.emoji && <span className="text-4xl leading-none" aria-hidden="true">{m.emoji}</span>}
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-semibold sm:text-4xl">{m.percentual}</span>
              {m.seta && (
                <Tooltip content={m.seta.dica}>
                  <span className={`text-lg ${m.seta.classe}`} aria-label={m.seta.dica}>{m.seta.glifo}</span>
                </Tooltip>
              )}
            </div>
            <p
              className="truncate text-sm font-semibold sm:text-base"
              style={m.corClassificacao ? { color: m.corClassificacao } : undefined}
            >
              {m.nomeClassificacao}
            </p>
          </div>
        </div>

        <div className="pt-4">
          <div className="relative">
            <div className="relative h-3 overflow-hidden rounded-full bg-muted">
              {m.segmentos.map((s, i) => (
                <div
                  key={i}
                  className="absolute inset-y-0"
                  style={{ left: `${s.inicio}%`, width: `${s.largura}%`, backgroundColor: s.cor }}
                  title={s.nome}
                />
              ))}
            </div>
            <span
              className="absolute -top-3 -translate-x-1/2 text-xs leading-none text-foreground"
              style={{ left: `${m.posicaoMarcador}%` }}
              aria-hidden="true"
            >
              ▼
            </span>
          </div>
        </div>

        {m.mostrarHistorico && (
          <p className="text-xs text-muted-foreground sm:text-sm">
            Avaliações anteriores:{' '}
            {m.anteriores.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ' · '}
                {formatarData(a.dataFim)} <strong className="font-semibold text-foreground">{a.percentual}</strong>
              </span>
            ))}
          </p>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-3 self-center sm:grid-cols-3 lg:grid-cols-2">
        {m.contadores.map((c) => {
          const Icone = ICONES[c.chave];
          return (
            <li key={c.chave} className="flex items-center gap-2 rounded-md bg-muted p-3">
              <Icone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold leading-tight">{c.valor}</p>
                <p className="truncate text-xs text-muted-foreground">{c.rotulo}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

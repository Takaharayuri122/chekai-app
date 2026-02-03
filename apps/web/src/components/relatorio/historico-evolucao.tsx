'use client';

import Link from 'next/link';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import type { AuditoriaHistoricoItem } from '@/lib/api';

interface HistoricoEvolucaoProps {
  historico: AuditoriaHistoricoItem[];
  auditoriaAtualId: string;
  linkBase: string;
}

function formatarData(data: string | undefined): string {
  if (!data) return '—';
  return new Date(data).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export function HistoricoEvolucao({
  historico,
  auditoriaAtualId,
  linkBase,
}: HistoricoEvolucaoProps) {
  const aproveitamento = (item: AuditoriaHistoricoItem): number => {
    const v = item.pontuacaoTotal;
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const dadosOrdenados = [...historico]
    .filter((a) => a.dataFim != null)
    .sort((a, b) => new Date(a.dataFim!).getTime() - new Date(b.dataFim!).getTime())
    .map((a) => ({
      id: a.id,
      data: formatarData(a.dataFim),
      dataFim: a.dataFim!,
      aproveitamento: aproveitamento(a),
      nomeTemplate: a.template?.nome ?? '—',
      isAtual: a.id === auditoriaAtualId,
    }));

  const soUmaAuditoria = dadosOrdenados.length <= 1;

  if (historico.length === 0) {
    return (
      <div className="rounded-lg border border-base-300 bg-base-200/50 p-6 text-center">
        <TrendingUp className="mx-auto h-10 w-10 text-base-content/40" />
        <p className="mt-2 text-sm font-medium text-base-content/70">Histórico de evolução</p>
        <p className="mt-1 text-xs text-base-content/60">
          Não há auditorias finalizadas anteriores nesta unidade. O histórico aparecerá a partir da próxima auditoria.
        </p>
      </div>
    );
  }

  if (soUmaAuditoria) {
    return (
      <div className="rounded-lg border border-base-300 bg-base-200/50 p-6 text-center">
        <TrendingUp className="mx-auto h-10 w-10 text-primary/70" />
        <p className="mt-2 text-sm font-medium text-base-content/80">Histórico de evolução</p>
        <p className="mt-1 text-xs text-base-content/60">
          Esta é a primeira auditoria finalizada desta unidade. O histórico de evolução aparecerá a partir da próxima auditoria.
        </p>
      </div>
    );
  }

  const atual = historico[0];
  const anterior = historico[1];
  const variacao =
    atual && anterior
      ? aproveitamento(atual) - aproveitamento(anterior)
      : 0;
  const melhorou = variacao > 0;
  const piorou = variacao < 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-bold">
          <TrendingUp className="h-4 w-4 text-primary" />
          Histórico de evolução
        </h3>
        {dadosOrdenados.length >= 2 && (
          <span
            className={`badge badge-sm ${melhorou ? 'badge-success' : piorou ? 'badge-error' : 'badge-ghost'}`}
          >
            {melhorou ? `+${variacao.toFixed(1)} pts vs anterior` : piorou ? `${variacao.toFixed(1)} pts vs anterior` : 'Sem variação'}
          </span>
        )}
      </div>

      <div className="h-[260px] min-h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={dadosOrdenados}
            margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-base-300" />
            <XAxis
              dataKey="data"
              tick={{ fontSize: 11 }}
              className="text-base-content/70"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              className="text-base-content/70"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'oklch(var(--b1))',
                border: '1px solid oklch(var(--b3))',
                borderRadius: 'var(--rounded-box, 0.5rem)',
              }}
              labelStyle={{ color: 'oklch(var(--bc))' }}
              formatter={(value: number | undefined) => [`${value != null ? Number(value).toFixed(2) : 0}%`, 'Aproveitamento']}
              labelFormatter={(_, payload) => {
                const p = payload[0]?.payload;
                return p ? `${p.data}${p.isAtual ? ' (atual)' : ''}` : '';
              }}
            />
            <ReferenceLine y={70} stroke="oklch(var(--wa))" strokeDasharray="2 2" />
            <Line
              type="monotone"
              dataKey="aproveitamento"
              stroke="oklch(var(--p))"
              strokeWidth={2}
              dot={{ r: 4, fill: 'oklch(var(--p))' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-xs text-base-content/60">
        Legenda: linha tracejada = 70% (meta mínima). Ordenado da mais antiga à mais recente.
      </p>

      <div className="rounded-lg border border-base-300 bg-base-200/50 p-3">
        <p className="mb-2 text-xs font-medium text-base-content/70">Relatórios anteriores (mais recente primeiro)</p>
        <ul className="space-y-1.5">
          {historico.slice(0, 10).map((item) => {
            const isAtual = item.id === auditoriaAtualId;
            const valor = aproveitamento(item);
            return (
              <li key={item.id}>
                <Link
                  href={`${linkBase}/${item.id}/relatorio`}
                  className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-base-300/50 ${isAtual ? 'bg-primary/10 font-medium text-primary' : 'text-base-content/80'}`}
                >
                  <span className="truncate">
                    {formatarData(item.dataFim)} — {item.template?.nome ?? 'Auditoria'}
                    {isAtual && ' (esta)'}
                  </span>
                  <span className="shrink-0 font-semibold">{valor.toFixed(1)}%</span>
                </Link>
              </li>
            );
          })}
        </ul>
        {historico.length > 10 && (
          <p className="mt-2 text-xs text-base-content/50">Exibindo as 10 mais recentes de {historico.length}.</p>
        )}
      </div>
    </div>
  );
}

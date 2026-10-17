'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

export interface DadoGrupoAproveitamento {
  grupoId: string;
  nome: string;
  aproveitamento: number;
}

interface GraficoAproveitamentoGruposProps {
  grupos: DadoGrupoAproveitamento[];
  aproveitamentoGeral: number;
}

function corPorAproveitamento(aproveitamento: number): string {
  if (aproveitamento >= 70) return 'hsl(var(--success))';
  if (aproveitamento >= 60) return 'hsl(var(--warning))';
  return 'hsl(var(--destructive))';
}

export function GraficoAproveitamentoGrupos({
  grupos,
  aproveitamentoGeral,
}: GraficoAproveitamentoGruposProps) {
  const dados = [
    ...grupos.map((g, i) => ({
      indice: i + 1,
      nome: g.nome.length > 25 ? `${g.nome.slice(0, 22)}...` : g.nome,
      nomeCompleto: g.nome,
      aproveitamento: Number(g.aproveitamento ?? 0),
      fill: corPorAproveitamento(Number(g.aproveitamento ?? 0)),
    })),
    {
      indice: 'GERAL',
      nome: 'GERAL',
      nomeCompleto: 'Geral',
      aproveitamento: aproveitamentoGeral,
      fill: corPorAproveitamento(aproveitamentoGeral),
    },
  ];

  const legendaFaixas = [
    { label: '≥70% (Bom)', cor: 'hsl(var(--success))' },
    { label: '60–70% (Atenção)', cor: 'hsl(var(--warning))' },
    { label: '<60% (Crítico)', cor: 'hsl(var(--destructive))' },
  ];

  return (
    <div className="w-full">
      <div className="h-[320px] min-h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dados}
            margin={{ top: 16, right: 16, left: 0, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="indice"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickFormatter={(v) => `${v}%`}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--rounded-box, 0.5rem)',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value) => [`${value != null ? Number(value).toFixed(2) : 0}%`, 'Aproveitamento']}
              labelFormatter={(_, payload) => {
                const p = payload[0]?.payload;
                return p?.nomeCompleto ?? p?.nome ?? '';
              }}
            />
            <Bar dataKey="aproveitamento" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {dados.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-3 pt-3 border-t border-border">
        <span className="text-xs font-medium text-muted-foreground">Legenda (faixa de aproveitamento):</span>
        {legendaFaixas.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: item.cor }}
              aria-hidden
            />
            <span className="text-xs text-foreground/80">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

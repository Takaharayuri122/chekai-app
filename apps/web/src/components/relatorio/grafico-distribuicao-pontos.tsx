'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DadoDistribuicao {
  nome: string;
  valor: number;
  cor: string;
}

interface GraficoDistribuicaoPontosProps {
  pontosPossiveis: number;
  pontosRealizados: number;
}

export function GraficoDistribuicaoPontos({
  pontosPossiveis,
  pontosRealizados,
}: GraficoDistribuicaoPontosProps) {
  const pontosNaoObtidos = Math.max(0, pontosPossiveis - pontosRealizados);
  const dados: DadoDistribuicao[] = [];
  if (pontosRealizados > 0) {
    dados.push({ nome: 'Pontos realizados', valor: pontosRealizados, cor: 'hsl(var(--success))' });
  }
  if (pontosNaoObtidos > 0) {
    dados.push({ nome: 'Pontos não obtidos', valor: pontosNaoObtidos, cor: 'hsl(var(--destructive))' });
  }

  const total = dados.reduce((acc, d) => acc + d.valor, 0);
  if (total === 0) {
    return (
      <div className="w-full h-[240px] flex items-center justify-center text-muted-foreground text-sm">
        Nenhum dado para exibir
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="h-[280px] min-h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dados}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey="valor"
              nameKey="nome"
            >
              {dados.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.cor} stroke="hsl(var(--card))" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--rounded-box, 0.5rem)',
              }}
              formatter={(value) => {
                const numero = Number(value ?? 0);
                return [
                  `${numero} (${total > 0 ? ((numero / total) * 100).toFixed(1) : 0}%)`,
                ];
              }}
            />
            <Legend
              layout="horizontal"
              verticalAlign="bottom"
              wrapperStyle={{ fontSize: 13, paddingTop: 8 }}
              iconType="circle"
              iconSize={10}
              formatter={(value) => <span className="text-foreground/90 font-medium">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-muted-foreground mt-1 text-center">
        Legenda: quantidade de pontos e percentual em relação ao total possível.
      </p>
    </div>
  );
}

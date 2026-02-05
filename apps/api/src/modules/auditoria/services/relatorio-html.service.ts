import { Injectable } from '@nestjs/common';
import { Auditoria } from '../entities/auditoria.entity';
import { AuditoriaItem, RespostaItem } from '../entities/auditoria-item.entity';

interface GrupoMetricas {
  nome: string;
  pontuacaoPossivel: number;
  pontuacaoObtida: number;
  naoConformidades: number;
  naoAplicaveis: number;
  naoRespondidas: number;
  aproveitamento: number;
  itens: AuditoriaItem[];
}

/**
 * Serviço responsável pela geração do HTML do relatório de auditoria.
 */
@Injectable()
export class RelatorioHtmlService {
  /**
   * Gera o HTML completo do relatório de auditoria.
   * @param historico - Lista de auditorias finalizadas da mesma unidade (para seção de evolução)
   */
  gerarHtml(auditoria: Auditoria, historico?: Auditoria[]): string {
    const grupos = this.calcularGruposMetricas(auditoria);
    const metricasGerais = this.calcularMetricasGerais(grupos, auditoria);
    const aproveitamento = Number(auditoria.pontuacaoTotal) || 0;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Auditoria - ${this.escapeHtml(auditoria.unidade?.nome || 'Unidade')}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.4;
      color: #1B2A4A;
      background: #FFFFFF;
      padding: 8px;
      font-size: 14px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      border-bottom: 1px solid #E5E9F0;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 700;
      color: #1B2A4A;
      margin-bottom: 2px;
    }
    .header .subtitle {
      font-size: 13px;
      color: #1B2A4A;
      opacity: 0.7;
      margin-bottom: 6px;
    }
    .header-info {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 11px;
      color: #1B2A4A;
      opacity: 0.7;
    }
    .header-info span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .section {
      margin-bottom: 12px;
    }
    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: #1B2A4A;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid #E5E9F0;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 8px;
    }
    .metric-card {
      background: #F4F7FA;
      border-radius: 6px;
      padding: 10px;
      border: 1px solid #E5E9F0;
    }
    .metric-label {
      font-size: 11px;
      color: #1B2A4A;
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .metric-value {
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .metric-value.primary { color: #00B8A9; }
    .metric-value.success { color: #10b981; }
    .metric-value.error { color: #ef4444; }
    .metric-desc {
      font-size: 11px;
      color: #1B2A4A;
      opacity: 0.7;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 11px;
    }
    thead {
      background: #00B8A9;
      color: #ffffff;
    }
    th {
      padding: 6px 4px;
      text-align: left;
      font-weight: 600;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    th.text-center { text-align: center; }
    tbody tr {
      border-bottom: 1px solid #E5E9F0;
    }
    tbody tr:hover {
      background: #F4F7FA;
    }
    tbody tr.total {
      background: #F4F7FA;
      font-weight: 700;
    }
    td {
      padding: 6px 4px;
      font-size: 11px;
    }
    td.text-center { text-align: center; }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-error {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }
    .grupo-section {
      margin-bottom: 10px;
      border: 1px solid #E5E9F0;
      border-radius: 6px;
      padding: 8px;
    }
    .grupo-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 1px solid #E5E9F0;
    }
    .grupo-title {
      font-size: 16px;
      font-weight: 700;
      color: #1B2A4A;
    }
    .grupo-metrics {
      font-size: 12px;
      color: #1B2A4A;
      opacity: 0.7;
    }
    .item-card {
      margin-bottom: 6px;
      padding: 8px;
      border-radius: 4px;
      border: 1px solid #E5E9F0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .item-card.conforme {
      background: rgba(16, 185, 129, 0.1);
      border-color: rgba(16, 185, 129, 0.3);
    }
    .item-card.nao-conforme {
      background: rgba(239, 68, 68, 0.1);
      border-color: rgba(239, 68, 68, 0.3);
    }
    .item-card.nao-aplicavel {
      background: rgba(245, 158, 11, 0.1);
      border-color: rgba(245, 158, 11, 0.3);
    }
    .item-header {
      display: flex;
      align-items: start;
      gap: 6px;
      margin-bottom: 3px;
    }
    .item-icon {
      font-size: 16px;
      flex-shrink: 0;
      margin-top: 1px;
    }
    .item-icon.conforme { color: #10b981; }
    .item-icon.nao-conforme { color: #ef4444; }
    .item-icon.nao-aplicavel { color: #f59e0b; }
    .item-content {
      flex: 1;
    }
    .item-pergunta {
      font-weight: 600;
      color: #1B2A4A;
      margin-bottom: 4px;
      font-size: 12px;
      line-height: 1.4;
    }
    .item-details {
      font-size: 11px;
      color: #1B2A4A;
      opacity: 0.8;
      line-height: 1.4;
    }
    .item-detail {
      margin-bottom: 2px;
    }
    .item-detail-label {
      font-weight: 600;
      color: #1B2A4A;
      font-size: 11px;
      display: inline;
    }
    .item-detail-value {
      color: #1B2A4A;
      opacity: 0.7;
      font-size: 11px;
      display: inline;
    }
    .item-detail-error {
      color: #ef4444;
      font-size: 11px;
      display: inline;
    }
    .resumo-section {
      background: #FFFFFF;
      border-radius: 6px;
      padding: 10px;
      border: 1px solid #E5E9F0;
      break-inside: avoid;
    }
    .resumo-title {
      font-size: 16px;
      font-weight: 700;
      color: #1B2A4A;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .resumo-content {
      margin-bottom: 10px;
    }
    .resumo-subtitle {
      font-size: 12px;
      font-weight: 600;
      color: #1B2A4A;
      margin-bottom: 4px;
      margin-top: 8px;
    }
    .resumo-text {
      font-size: 12px;
      color: #1B2A4A;
      opacity: 0.8;
      line-height: 1.6;
      white-space: pre-line;
    }
    .resumo-list {
      list-style: none;
      padding: 0;
    }
    .resumo-list li {
      padding: 4px 0;
      font-size: 12px;
      color: #1B2A4A;
      opacity: 0.8;
      display: flex;
      align-items: start;
      gap: 8px;
    }
    .resumo-list li::before {
      content: '•';
      color: #00B8A9;
      font-weight: 700;
      margin-right: 4px;
    }
    .resumo-list.success li::before { color: #10b981; }
    .resumo-list.error li::before { color: #ef4444; }
    .resumo-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin-top: 8px;
    }
    .risco-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 13px;
    }
    .risco-baixo {
      background: rgba(16, 185, 129, 0.1);
      color: #10b981;
    }
    .risco-medio {
      background: rgba(245, 158, 11, 0.1);
      color: #f59e0b;
    }
    .risco-alto, .risco-critico {
      background: rgba(239, 68, 68, 0.1);
      color: #ef4444;
    }
    .legend {
      font-size: 10px;
      color: #1B2A4A;
      opacity: 0.7;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid #E5E9F0;
    }
    .chart-section {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #E5E9F0;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .chart-section:first-child {
      margin-top: 0;
      padding-top: 0;
      border-top: none;
    }
    .chart-title {
      font-size: 14px;
      font-weight: 700;
      color: #1B2A4A;
      margin-bottom: 6px;
    }
    .chart-bars {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }
    .chart-bar-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
    }
    .chart-bar-label {
      min-width: 120px;
      color: #1B2A4A;
      font-weight: 500;
    }
    .chart-bar-track {
      flex: 1;
      height: 20px;
      background: #E5E9F0;
      border-radius: 4px;
      overflow: hidden;
    }
    .chart-bar-fill {
      height: 100%;
      border-radius: 4px;
      min-width: 2px;
    }
    .chart-bar-value {
      min-width: 44px;
      text-align: right;
      font-weight: 600;
      color: #1B2A4A;
    }
    .chart-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 10px;
      font-size: 10px;
      color: #1B2A4A;
      opacity: 0.8;
    }
    .chart-legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .chart-legend-color {
      width: 12px;
      height: 12px;
      border-radius: 2px;
    }
    .chart-svg-wrap {
      margin-top: 2px;
      margin-bottom: 2px;
      overflow: visible;
    }
    .chart-svg-wrap svg {
      display: block;
      overflow: visible;
      max-width: 100%;
      height: auto;
    }
    .charts-block {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .distrib-chart {
      display: flex;
      width: 100%;
      align-items: center;
      margin-top: 10px;
      gap: 0;
      min-height: 32px;
    }
    .distrib-bar {
      height: 32px;
      border-radius: 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      color: #fff;
      min-width: 0;
    }
    .distrib-bar:first-child { border-radius: 4px 0 0 4px; }
    .distrib-bar:last-child { border-radius: 0 4px 4px 0; }
    .distrib-bar:only-child { border-radius: 4px; }
    .historico-section {
      margin-top: 16px;
      padding: 12px;
      border: 1px solid #E5E9F0;
      border-radius: 6px;
      background: #F9FAFB;
    }
    .historico-title {
      font-size: 14px;
      font-weight: 700;
      color: #1B2A4A;
      margin-bottom: 10px;
    }
    .historico-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .historico-list li {
      padding: 6px 8px;
      font-size: 11px;
      color: #1B2A4A;
      border-bottom: 1px solid #E5E9F0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .historico-list li:last-child { border-bottom: none; }
    .historico-list li.atual {
      background: rgba(0, 184, 169, 0.1);
      font-weight: 600;
    }
    .item-fotos {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }
    .item-foto {
      display: block;
      max-width: 180px;
      max-height: 180px;
      width: auto;
      height: auto;
      object-fit: cover;
      border: 1px solid #E5E9F0;
      border-radius: 4px;
    }
    .items {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    @media print {
      body {
        padding: 8px;
      }
      .section {
        page-break-after: auto;
        page-break-inside: auto;
      }
      .charts-block {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .chart-section {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .grupo-section {
        page-break-inside: auto;
        break-inside: auto;
      }
      .grupo-header {
        break-after: avoid;
        page-break-after: avoid;
      }
      .item-card {
        break-inside: avoid;
        page-break-inside: avoid;
      }
      .items {
        orphans: 2;
        widows: 2;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    ${this.gerarCabecalho(auditoria)}
    ${this.gerarMetricasGerais(metricasGerais, aproveitamento, grupos)}
    ${historico?.length ? this.gerarHistoricoEvolucao(historico, auditoria.id) : ''}
    ${this.gerarDetalhamentoPorGrupo(grupos)}
    ${this.gerarResumoExecutivo(auditoria.resumoExecutivo)}
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Gera o cabeçalho do relatório.
   */
  private gerarCabecalho(auditoria: Auditoria): string {
    const dataInicio = auditoria.dataInicio
      ? new Date(auditoria.dataInicio).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'N/A';
    const dataFim = auditoria.dataFim
      ? new Date(auditoria.dataFim).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : 'N/A';

    return `
    <div class="header">
      <h1>${this.escapeHtml(auditoria.unidade?.nome || 'Unidade')}</h1>
      <div class="subtitle">
        ${this.escapeHtml(
          auditoria.unidade?.cliente?.nomeFantasia ||
            auditoria.unidade?.cliente?.razaoSocial ||
            'Cliente',
        )}
      </div>
      <div class="header-info">
        <span>👤 Auditor: ${this.escapeHtml(auditoria.consultor?.nome || 'Não informado')}</span>
        <span>📅 Data: ${dataInicio} - ${dataFim}</span>
        ${auditoria.dataInicio && auditoria.dataFim
          ? `<span>⏱️ Duração: ${Math.round(
              (new Date(auditoria.dataFim).getTime() -
                new Date(auditoria.dataInicio).getTime()) /
                (1000 * 60 * 60 * 24),
            )} dias</span>`
          : ''}
      </div>
    </div>
    `;
  }

  /**
   * Gera a seção de métricas gerais.
   */
  private gerarMetricasGerais(
    metricas: {
      pontosPossiveis: number;
      pontosRealizados: number;
      naoAplicaveis: number;
      naoConformidades: number;
      naoRespondidas: number;
    },
    aproveitamento: number,
    grupos: GrupoMetricas[],
  ): string {
    const classificacao = this.getClassificacao(aproveitamento);

    return `
    <div class="section">
      <h2 class="section-title">Métricas Gerais</h2>
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Aproveitamento</div>
          <div class="metric-value primary">${aproveitamento.toFixed(2)}%</div>
          <div class="metric-desc">${classificacao}</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Pontos Realizados</div>
          <div class="metric-value success">${metricas.pontosRealizados}</div>
          <div class="metric-desc">de ${metricas.pontosPossiveis} possíveis</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Não Conformidades</div>
          <div class="metric-value error">${metricas.naoConformidades}</div>
          ${metricas.naoAplicaveis > 0
            ? `<div class="metric-desc">${metricas.naoAplicaveis} não aplicáveis</div>`
            : ''}
        </div>
      </div>
      ${this.gerarTabelaMetricas(grupos, metricas, aproveitamento)}
      <div class="charts-block">
        ${this.gerarGraficoAproveitamentoGrupos(grupos, aproveitamento)}
        ${this.gerarGraficoDistribuicaoPontos(metricas)}
      </div>
    </div>
    `;
  }

  private corBarraAproveitamento(ap: number): string {
    if (ap >= 70) return '#10b981';
    if (ap >= 60) return '#f59e0b';
    return '#ef4444';
  }

  private gerarGraficoAproveitamentoGrupos(grupos: GrupoMetricas[], aproveitamentoGeral: number): string {
    const barrasGrupos = grupos.map((g, idx) => ({
      indice: idx + 1,
      valor: Math.min(100, Math.max(0, Number(g.aproveitamento ?? 0))),
      cor: this.corBarraAproveitamento(Number(g.aproveitamento ?? 0)),
    }));
    const barras = [
      ...barrasGrupos,
      {
        indice: 'GERAL',
        valor: Math.min(100, Math.max(0, aproveitamentoGeral)),
        cor: this.corBarraAproveitamento(aproveitamentoGeral),
      },
    ] as { indice: number | string; valor: number; cor: string }[];
    const w = 560;
    const h = 260;
    const margin = { top: 16, right: 16, bottom: 40, left: 44 };
    const chartW = w - margin.left - margin.right;
    const chartH = h - margin.top - margin.bottom;
    const n = barras.length;
    const barMaxWidth = 48;
    const gap = n > 0 ? (chartW - n * barMaxWidth) / (n + 1) : 0;
    const scaleY = (v: number) => margin.top + chartH - (v / 100) * chartH;
    const gridLines = [0, 25, 50, 75, 100]
      .map(
        (tick) =>
          `<line x1="${margin.left}" y1="${scaleY(tick)}" x2="${margin.left + chartW}" y2="${scaleY(tick)}" stroke="#e5e7eb" stroke-dasharray="3 3" stroke-width="1"/>`,
      )
      .join('');
    const yTicks = [0, 25, 50, 75, 100]
      .map(
        (tick) =>
          `<text x="${margin.left - 8}" y="${scaleY(tick) + 4}" text-anchor="end" font-size="12" fill="#6b7280">${tick}%</text>`,
      )
      .join('');
    const barsSvg = barras
      .map((b, i) => {
        const x = margin.left + gap + i * (barMaxWidth + gap);
        const barH = (b.valor / 100) * chartH;
        const y = margin.top + chartH - barH;
        const label = typeof b.indice === 'number' ? String(b.indice) : 'GERAL';
        return `<g>
          <rect x="${x}" y="${y}" width="${barMaxWidth}" height="${Math.max(barH, 0)}" fill="${b.cor}" rx="4" ry="4"/>
          <text x="${x + barMaxWidth / 2}" y="${margin.top + chartH + 18}" text-anchor="middle" font-size="11" fill="#374151">${this.escapeHtml(label)}</text>
          <text x="${x + barMaxWidth / 2}" y="${y - 6}" text-anchor="middle" font-size="11" font-weight="600" fill="#1f2937">${b.valor.toFixed(1)}%</text>
        </g>`;
      })
      .join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="max-width:100%;height:auto;">
      ${gridLines}
      ${yTicks}
      ${barsSvg}
    </svg>`;
    return `
      <div class="chart-section">
        <h3 class="chart-title">% de aproveitamento por grupo do formulário</h3>
        <div class="chart-svg-wrap">${svg}</div>
        <div class="chart-legend">
          <span class="chart-legend-item"><span class="chart-legend-color" style="background:#10b981;"></span> ≥70% (Bom)</span>
          <span class="chart-legend-item"><span class="chart-legend-color" style="background:#f59e0b;"></span> 60–70% (Atenção)</span>
          <span class="chart-legend-item"><span class="chart-legend-color" style="background:#ef4444;"></span> &lt;60% (Crítico)</span>
        </div>
      </div>`;
  }

  private gerarGraficoDistribuicaoPontos(metricas: {
    pontosPossiveis: number;
    pontosRealizados: number;
  }): string {
    const realizados = metricas.pontosRealizados;
    const naoObtidos = Math.max(0, metricas.pontosPossiveis - realizados);
    const total = metricas.pontosPossiveis || 1;
    const pctReal = total > 0 ? (realizados / total) * 100 : 0;
    const pctNao = total > 0 ? (naoObtidos / total) * 100 : 0;
    const w = 400;
    const h = 200;
    const cx = w / 2;
    const cy = 68;
    const outerR = 52;
    const innerR = 34;
    const angleReal = (pctReal / 100) * 360;
    const angleNao = (pctNao / 100) * 360;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const arc = (startAngle: number, endAngle: number, r: number) => {
      const x1 = cx + r * Math.sin(toRad(startAngle));
      const y1 = cy - r * Math.cos(toRad(startAngle));
      const x2 = cx + r * Math.sin(toRad(endAngle));
      const y2 = cy - r * Math.cos(toRad(endAngle));
      const large = endAngle - startAngle > 180 ? 1 : 0;
      return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    };
    const pathReal = angleReal > 0 ? `${arc(0, angleReal, outerR)} L ${cx + innerR * Math.sin(toRad(angleReal))} ${cy - innerR * Math.cos(toRad(angleReal))} ${arc(angleReal, 0, innerR)} Z` : '';
    const pathNao = angleNao > 0 ? `${arc(angleReal, angleReal + angleNao, outerR)} L ${cx + innerR * Math.sin(toRad(angleReal + angleNao))} ${cy - innerR * Math.cos(toRad(angleReal + angleNao))} ${arc(angleReal + angleNao, angleReal, innerR)} Z` : '';
    const labelY = 158;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="max-width:100%;height:auto;overflow:visible;">
      ${pathReal ? `<path d="${pathReal}" fill="#10b981" stroke="#fff" stroke-width="2"/>` : ''}
      ${pathNao ? `<path d="${pathNao}" fill="#ef4444" stroke="#fff" stroke-width="2"/>` : ''}
      <circle cx="${cx}" cy="${cy}" r="${innerR - 2}" fill="#fff"/>
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="14" font-weight="600" fill="#1f2937">${total}</text>
      <text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="11" fill="#6b7280">total</text>
      <g transform="translate(0, ${labelY})">
        <g transform="translate(40, 0)">
          <circle cx="0" cy="0" r="4" fill="#10b981"/>
          <text x="10" y="3" font-size="11" fill="#374151">Pontos realizados</text>
        </g>
        <g transform="translate(220, 0)">
          <circle cx="0" cy="0" r="4" fill="#ef4444"/>
          <text x="10" y="3" font-size="11" fill="#374151">Pontos não obtidos</text>
        </g>
      </g>
    </svg>`;
    return `
      <div class="chart-section">
        <h3 class="chart-title">Distribuição de pontos</h3>
        <div class="chart-svg-wrap">${svg}</div>
        <p class="legend" style="margin-top:4px;">Legenda: quantidade de pontos e percentual em relação ao total possível.</p>
      </div>`;
  }

  private gerarHistoricoEvolucao(historico: Auditoria[], auditoriaId: string): string {
    const itensOrdenados = [...historico]
      .filter((a) => a.dataFim != null)
      .sort((a, b) => new Date(a.dataFim!).getTime() - new Date(b.dataFim!).getTime())
      .map((a) => ({
        data: a.dataFim
          ? new Date(a.dataFim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
          : '—',
        valor: Math.min(100, Math.max(0, Number(a.pontuacaoTotal) ?? 0)),
      }));
    const lineChartSvg =
      itensOrdenados.length >= 2
        ? this.gerarSvgGraficoLinhaEvolucao(itensOrdenados)
        : '';
    const itens = historico.slice(0, 10).map((a) => {
      const dataFim = a.dataFim
        ? new Date(a.dataFim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '—';
      const valor = Number(a.pontuacaoTotal) ?? 0;
      const nome = (a.template as { nome?: string })?.nome ?? 'Auditoria';
      const isAtual = a.id === auditoriaId;
      return { dataFim, valor, nome, isAtual };
    });
    const linhas = itens
      .map(
        (i) =>
          `<li class="${i.isAtual ? 'atual' : ''}"><span>${i.dataFim} — ${this.escapeHtml(i.nome)}${i.isAtual ? ' (esta)' : ''}</span><strong>${i.valor.toFixed(1)}%</strong></li>`,
      )
      .join('');
    return `
      <div class="section">
        <h2 class="section-title">Histórico de evolução</h2>
        ${lineChartSvg}
        <p class="legend" style="margin-top:4px;">Legenda: linha tracejada = 70% (meta mínima). Ordenado da mais antiga à mais recente.</p>
        <div class="historico-section" style="margin-top:12px;">
          <p class="historico-title">Relatórios anteriores (mais recente primeiro)</p>
          <ul class="historico-list">${linhas}</ul>
          ${historico.length > 10 ? `<p class="legend">Exibindo as 10 mais recentes de ${historico.length}.</p>` : ''}
        </div>
      </div>`;
  }

  private gerarSvgGraficoLinhaEvolucao(
    itens: { data: string; valor: number }[],
  ): string {
    const w = 600;
    const h = 260;
    const margin = { top: 16, right: 16, bottom: 40, left: 44 };
    const chartW = w - margin.left - margin.right;
    const chartH = h - margin.top - margin.bottom;
    const scaleY = (v: number) => margin.top + chartH - (v / 100) * chartH;
    const scaleX = (i: number) => margin.left + (i / Math.max(1, itens.length - 1)) * chartW;
    const refY = scaleY(70);
    const gridLines = [0, 25, 50, 75, 100]
      .map(
        (tick) =>
          `<line x1="${margin.left}" y1="${scaleY(tick)}" x2="${margin.left + chartW}" y2="${scaleY(tick)}" stroke="#e5e7eb" stroke-dasharray="3 3" stroke-width="1"/>`,
      )
      .join('');
    const yTicks = [0, 25, 50, 75, 100]
      .map(
        (tick) =>
          `<text x="${margin.left - 8}" y="${scaleY(tick) + 4}" text-anchor="end" font-size="11" fill="#6b7280">${tick}%</text>`,
      )
      .join('');
    const points = itens.map((p, i) => `${scaleX(i)},${scaleY(p.valor)}`).join(' ');
    const linePath = itens.length >= 2 ? `M ${points.replace(/ /g, ' L ')}` : '';
    const dots = itens
      .map(
        (p, i) =>
          `<circle cx="${scaleX(i)}" cy="${scaleY(p.valor)}" r="4" fill="#6366f1"/><text x="${scaleX(i)}" y="${scaleY(p.valor) - 8}" text-anchor="middle" font-size="10" font-weight="600" fill="#1f2937">${p.valor.toFixed(1)}%</text>`,
      )
      .join('');
    const xLabels = itens
      .map(
        (p, i) =>
          `<text x="${scaleX(i)}" y="${margin.top + chartH + 18}" text-anchor="middle" font-size="10" fill="#374151">${this.escapeHtml(p.data)}</text>`,
      )
      .join('');
    return `
      <div class="chart-svg-wrap">
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="max-width:100%;height:auto;">
          ${gridLines}
          <line x1="${margin.left}" y1="${refY}" x2="${margin.left + chartW}" y2="${refY}" stroke="#f59e0b" stroke-dasharray="2 2" stroke-width="1"/>
          ${yTicks}
          ${linePath ? `<polyline points="${points}" fill="none" stroke="#6366f1" stroke-width="2"/>` : ''}
          ${dots}
          ${xLabels}
        </svg>
      </div>`;
  }

  /**
   * Gera a tabela de métricas por grupo.
   */
  private gerarTabelaMetricas(
    grupos: GrupoMetricas[],
    metricasGerais: {
      pontosPossiveis: number;
      pontosRealizados: number;
      naoAplicaveis: number;
      naoConformidades: number;
      naoRespondidas: number;
    },
    aproveitamento: number,
  ): string {
    let tabela = `
      <table>
        <thead>
          <tr>
            <th>GRUPO</th>
            <th class="text-center">AP</th>
            <th class="text-center">PP</th>
            <th class="text-center">PR</th>
            <th class="text-center">NA</th>
            <th class="text-center">NC</th>
            <th class="text-center">NR</th>
          </tr>
        </thead>
        <tbody>
    `;

    grupos.forEach((grupo) => {
      tabela += `
          <tr>
            <td>${this.escapeHtml(grupo.nome)}</td>
            <td class="text-center" style="font-weight: 600;">${Number(grupo.aproveitamento || 0).toFixed(2)}%</td>
            <td class="text-center">${grupo.pontuacaoPossivel}</td>
            <td class="text-center">${grupo.pontuacaoObtida}</td>
            <td class="text-center">${grupo.naoAplicaveis}</td>
            <td class="text-center">${
              grupo.naoConformidades > 0
                ? `<span class="badge badge-error">${grupo.naoConformidades}</span>`
                : '<span style="color: #9ca3af;">0</span>'
            }</td>
            <td class="text-center">${grupo.naoRespondidas}</td>
          </tr>
      `;
    });

    tabela += `
          <tr class="total">
            <td>GERAL</td>
            <td class="text-center">${aproveitamento.toFixed(2)}%</td>
            <td class="text-center">${metricasGerais.pontosPossiveis}</td>
            <td class="text-center">${metricasGerais.pontosRealizados}</td>
            <td class="text-center">${metricasGerais.naoAplicaveis}</td>
            <td class="text-center">${metricasGerais.naoConformidades}</td>
            <td class="text-center">${metricasGerais.naoRespondidas}</td>
          </tr>
        </tbody>
      </table>
      <div class="legend">
        <strong>AP:</strong> Aproveitamento | <strong>PP:</strong> Pontos Possíveis | 
        <strong>PR:</strong> Pontos Realizados | <strong>NA:</strong> Não Aplicáveis | 
        <strong>NC:</strong> Não Conformidades | <strong>NR:</strong> Não Respondidas
      </div>
    `;

    return tabela;
  }

  /**
   * Gera o detalhamento por grupo.
   */
  private gerarDetalhamentoPorGrupo(grupos: GrupoMetricas[]): string {
    let html = `
    <div class="section">
      <h2 class="section-title">Detalhamento por Grupo</h2>
    `;

    grupos.forEach((grupo) => {
      html += `
      <div class="grupo-section">
        <div class="grupo-header">
          <h3 class="grupo-title">${this.escapeHtml(grupo.nome)}</h3>
          <div class="grupo-metrics">
            Aproveitamento: <strong>${Number(grupo.aproveitamento || 0).toFixed(2)}%</strong> | 
            Pontos: ${grupo.pontuacaoObtida}/${grupo.pontuacaoPossivel}
          </div>
        </div>
        <div class="items">
      `;

      grupo.itens.forEach((item) => {
        const resposta = item.resposta;
        const isConforme = resposta === RespostaItem.CONFORME;
        const isNaoConforme = resposta === RespostaItem.NAO_CONFORME;
        const isNaoAplicavel = resposta === RespostaItem.NAO_APLICAVEL;

        const classeCard = isNaoConforme
          ? 'nao-conforme'
          : isConforme
            ? 'conforme'
            : 'nao-aplicavel';

        const icon = isConforme
          ? '✓'
          : isNaoConforme
            ? '✗'
            : '⚠';

        const classeIcon = isNaoConforme
          ? 'nao-conforme'
          : isConforme
            ? 'conforme'
            : 'nao-aplicavel';

        const respostaTexto =
          resposta === RespostaItem.CONFORME
            ? 'Conforme'
            : resposta === RespostaItem.NAO_CONFORME
              ? 'Não Conforme'
              : resposta === RespostaItem.NAO_APLICAVEL
                ? 'Não Aplicável'
                : this.escapeHtml(resposta);

        html += `
          <div class="item-card ${classeCard}">
            <div class="item-header">
              <div class="item-icon ${classeIcon}">${icon}</div>
              <div class="item-content">
                <div class="item-pergunta">
                  ${this.escapeHtml(item.templateItem?.pergunta || 'Pergunta não encontrada')}
                </div>
                <div class="item-details">
                  <div class="item-detail">
                    <span class="item-detail-label">Resposta: </span>
                    <span class="item-detail-value">${respostaTexto}</span>
                  </div>
                  ${item.observacao
                    ? `<div class="item-detail">
                        <span class="item-detail-label">Observação: </span>
                        <span class="item-detail-value">${this.escapeHtml(item.observacao)}</span>
                      </div>`
                    : ''}
                  ${item.descricaoNaoConformidade
                    ? `<div class="item-detail">
                        <span class="item-detail-label item-detail-error">Justificativa: </span>
                        <span class="item-detail-value">${this.escapeHtml(item.descricaoNaoConformidade)}</span>
                      </div>`
                    : ''}
                  ${item.descricaoIa
                    ? `<div class="item-detail">
                        <span class="item-detail-label">Análise IA: </span>
                        <span class="item-detail-value">${this.escapeHtml(item.descricaoIa)}</span>
                      </div>`
                    : ''}
                  ${item.fotos && item.fotos.length > 0
                    ? `<div class="item-detail">
                        <span class="item-detail-label">Fotos: </span>
                        <div class="item-fotos">
                          ${item.fotos
                            .map(
                              (foto) =>
                                `<img class="item-foto" data-foto-id="${this.escapeHtml(foto.id)}" alt="Foto do item" />`,
                            )
                            .join('')}
                        </div>
                      </div>`
                    : ''}
                </div>
              </div>
            </div>
          </div>
        `;
      });

      html += `
        </div>
      </div>
      `;
    });

    html += `</div>`;
    return html;
  }

  /**
   * Gera o resumo executivo.
   */
  private gerarResumoExecutivo(
    resumo: Auditoria['resumoExecutivo'],
  ): string {
    if (!resumo) {
      return '';
    }

    return `
    <div class="section">
      <div class="resumo-section">
        <h2 class="resumo-title">✨ Resumo Executivo</h2>
        <div class="resumo-content">
          <div>
            <div class="resumo-subtitle">Resumo</div>
            <div class="resumo-text">${this.escapeHtml(resumo.resumo || '')}</div>
          </div>
          <div class="resumo-grid">
            <div>
              <div class="resumo-subtitle" style="color: #10b981;">Pontos Fortes</div>
              <ul class="resumo-list success" style="list-style: none; padding: 0;">
                ${resumo.pontosFortes
                  ?.map(
                    (ponto) =>
                      `<li style="padding: 4px 0; font-size: 12px; color: #1B2A4A; opacity: 0.8; display: flex; align-items: start; gap: 8px;"><span style="color: #10b981;">✓</span><span>${this.escapeHtml(ponto)}</span></li>`,
                  )
                  .join('') || ''}
              </ul>
            </div>
            <div>
              <div class="resumo-subtitle" style="color: #ef4444;">Pontos Fracos</div>
              <ul class="resumo-list error" style="list-style: none; padding: 0;">
                ${resumo.pontosFracos
                  ?.map(
                    (ponto) =>
                      `<li style="padding: 4px 0; font-size: 12px; color: #1B2A4A; opacity: 0.8; display: flex; align-items: start; gap: 8px;"><span style="color: #ef4444;">✗</span><span>${this.escapeHtml(ponto)}</span></li>`,
                  )
                  .join('') || ''}
              </ul>
            </div>
          </div>
          <div>
            <div class="resumo-subtitle">Recomendações Prioritárias</div>
            <ul style="list-style: none; padding: 0;">
              ${resumo.recomendacoesPrioritarias
                ?.map(
                  (rec, idx) =>
                    `<li style="padding: 8px; background: #F4F7FA; border-radius: 4px; margin-bottom: 8px; font-size: 12px; display: flex; align-items: start; gap: 8px;"><span style="font-weight: 600; color: #00B8A9;">${idx + 1}.</span><span style="color: #1B2A4A; opacity: 0.8;">${this.escapeHtml(rec)}</span></li>`,
                )
                .join('') || ''}
            </ul>
          </div>
          <div class="resumo-grid">
            <div>
              <div class="resumo-subtitle">Risco Geral</div>
              <span class="risco-badge risco-${resumo.riscoGeral}">
                ${this.getRiscoLabel(resumo.riscoGeral)}
              </span>
            </div>
            <div>
              <div class="resumo-subtitle">Tendências Identificadas</div>
              <ul style="list-style: none; padding: 0;">
                ${resumo.tendencias
                  ?.map(
                    (tendencia) =>
                      `<li style="padding: 4px 0; font-size: 12px; color: #1B2A4A; opacity: 0.8; display: flex; align-items: start; gap: 8px;"><span style="color: #00B8A9;">→</span><span>${this.escapeHtml(tendencia)}</span></li>`,
                  )
                  .join('') || ''}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
    `;
  }

  private static calcularPontuacaoOpcao(
    templateItem: {
      opcoesRespostaConfig?: Array<{ valor?: string; pontuacao?: number | null }>;
      opcoesResposta?: string[];
      usarRespostasPersonalizadas?: boolean;
    } | null | undefined,
    valorResposta: string,
  ): number {
    if (!templateItem) return 0;
    const configs = templateItem.opcoesRespostaConfig || [];
    const configOpcao = configs.find((c) => c.valor === valorResposta);
    if (configOpcao?.pontuacao != null && typeof configOpcao.pontuacao === 'number') {
      return configOpcao.pontuacao;
    }
    if (configOpcao && configOpcao.pontuacao === null) return 0;
    const opcoesOrdenadas = templateItem.usarRespostasPersonalizadas && templateItem.opcoesResposta?.length
      ? templateItem.opcoesResposta
      : ['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'];
    const indice = opcoesOrdenadas.indexOf(valorResposta);
    const configPrimeira = configs.find((c) => c.valor === opcoesOrdenadas[0]);
    const base = configPrimeira?.pontuacao != null && typeof configPrimeira.pontuacao === 'number'
      ? configPrimeira.pontuacao
      : 1;
    return indice >= 0 ? base - indice : 0;
  }

  /**
   * Retorna a pontuação máxima possível para um item: máximo entre as pontuações
   * de cada opção, usando a mesma regra de cálculo (explícita ou sequencial).
   */
  private getPontuacaoMaximaItem(
    templateItem: {
      opcoesRespostaConfig?: Array<{ valor?: string; pontuacao?: number | null }>;
      opcoesResposta?: string[];
      usarRespostasPersonalizadas?: boolean;
    } | null | undefined,
  ): number {
    if (!templateItem) return 0;
    const opcoesOrdenadas = templateItem.usarRespostasPersonalizadas && templateItem.opcoesResposta?.length
      ? templateItem.opcoesResposta
      : ['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'];
    if (opcoesOrdenadas.length === 0) return 0;
    const pontuacoes = opcoesOrdenadas.map((valor) =>
      RelatorioHtmlService.calcularPontuacaoOpcao(templateItem, valor),
    );
    return Math.max(...pontuacoes);
  }

  /**
   * Calcula os grupos de métricas.
   */
  private calcularGruposMetricas(auditoria: Auditoria): GrupoMetricas[] {
    const itensPorGrupo = new Map<string, AuditoriaItem[]>();
    auditoria.itens.forEach((item) => {
      const grupoId = item.templateItem?.grupoId || 'sem-grupo';
      if (!itensPorGrupo.has(grupoId)) {
        itensPorGrupo.set(grupoId, []);
      }
      itensPorGrupo.get(grupoId)!.push(item);
    });

    const grupos: GrupoMetricas[] = Array.from(itensPorGrupo.entries()).map(
      ([grupoId, itens]) => {
        const primeiroItem = itens[0];
        const grupoNome =
          primeiroItem.templateItem?.grupo?.nome || 'Sem Grupo';
        const pontuacaoPossivel = itens.reduce(
          (acc, item) => acc + this.getPontuacaoMaximaItem(item.templateItem),
          0,
        );
        const pontuacaoObtida = itens.reduce(
          (acc, item) => acc + Number(item.pontuacao || 0),
          0,
        );
        const naoConformidades = itens.filter(
          (item) => item.resposta === RespostaItem.NAO_CONFORME,
        ).length;
        const naoAplicaveis = itens.filter(
          (item) => item.resposta === RespostaItem.NAO_APLICAVEL,
        ).length;
        const naoRespondidas = itens.filter(
          (item) => item.resposta === RespostaItem.NAO_AVALIADO,
        ).length;
        const aproveitamentoCalculado =
          pontuacaoPossivel > 0
            ? (pontuacaoObtida / pontuacaoPossivel) * 100
            : 0;
        const aproveitamento =
          isNaN(aproveitamentoCalculado) || !isFinite(aproveitamentoCalculado)
            ? 0
            : Number(aproveitamentoCalculado);

        return {
          nome: grupoNome,
          pontuacaoPossivel,
          pontuacaoObtida,
          naoConformidades,
          naoAplicaveis,
          naoRespondidas,
          aproveitamento,
          itens,
        };
      },
    );

    grupos.sort((a, b) => {
      const ordemA = a.itens[0]?.templateItem?.grupo?.ordem || 0;
      const ordemB = b.itens[0]?.templateItem?.grupo?.ordem || 0;
      return ordemA - ordemB;
    });

    return grupos;
  }

  /**
   * Calcula as métricas gerais.
   */
  private calcularMetricasGerais(
    grupos: GrupoMetricas[],
    auditoria: Auditoria,
  ): {
    pontosPossiveis: number;
    pontosRealizados: number;
    naoAplicaveis: number;
    naoConformidades: number;
    naoRespondidas: number;
  } {
    return {
      pontosPossiveis: Number(
        grupos.reduce((acc, g) => acc + g.pontuacaoPossivel, 0),
      ),
      pontosRealizados: Number(
        grupos.reduce((acc, g) => acc + g.pontuacaoObtida, 0),
      ),
      naoAplicaveis: Number(
        grupos.reduce((acc, g) => acc + g.naoAplicaveis, 0),
      ),
      naoConformidades: Number(
        grupos.reduce((acc, g) => acc + g.naoConformidades, 0),
      ),
      naoRespondidas: Number(
        grupos.reduce((acc, g) => acc + g.naoRespondidas, 0),
      ),
    };
  }

  /**
   * Retorna a classificação do aproveitamento.
   */
  private getClassificacao(aproveitamento: number): string {
    if (aproveitamento < 0) return 'Abaixo do mínimo';
    if (aproveitamento >= 90) return 'Com Excelência';
    if (aproveitamento >= 80) return 'Bom';
    if (aproveitamento >= 70) return 'Regular';
    if (aproveitamento >= 60) return 'Atenção Necessária';
    return 'Crítico';
  }

  /**
   * Retorna o label do risco.
   */
  private getRiscoLabel(risco: string): string {
    switch (risco) {
      case 'baixo':
        return 'Baixo';
      case 'medio':
        return 'Médio';
      case 'alto':
        return 'Alto';
      case 'critico':
        return 'Crítico';
      default:
        return risco;
    }
  }

  /**
   * Escapa HTML para prevenir XSS.
   */
  private escapeHtml(text: string): string {
    if (!text) return '';
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

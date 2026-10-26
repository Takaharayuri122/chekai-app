import { Injectable } from '@nestjs/common';
import { Auditoria } from '../entities/auditoria.entity';
import { AuditoriaItem, RespostaItem } from '../entities/auditoria-item.entity';
import { nomesLegislacoesDoItem } from '../../legislacao/lib/legislacoes-do-item';
import {
  FaixaClassificacao,
  ICONES_RESPOSTA,
  ICONE_PADRAO_POR_SENTIDO,
  SentidoResposta,
  classificar,
  sentidoDaOpcao,
} from '../../checklist/regras';
import { ResultadoAuditoria, ResultadoGrupo } from './resultado-auditoria.service';

const COR_SEM_FAIXA = '#9ca3af';
const FUSO = 'America/Sao_Paulo';

/** Mapas opcionais para embutir fotos já normalizadas no HTML (geração PDF). */
export interface RelatorioAuditoriaPdfAssetsHtml {
  readonly fotosDataUriPorId?: Record<string, string>;
}

/**
 * Serviço responsável pela geração do HTML do relatório de auditoria.
 */
@Injectable()
export class RelatorioHtmlService {
  /**
   * Gera o HTML completo do relatório de auditoria.
   * @param resultado - Cartão de resultado (fonte única de aproveitamento, faixa, contadores e grupos)
   */
  gerarHtml(
    auditoria: Auditoria,
    resultado: ResultadoAuditoria,
    assetsPdf?: RelatorioAuditoriaPdfAssetsHtml,
  ): string {
    const gruposItens = this.agruparItens(auditoria.itens ?? []);

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
    .item-icon.nao-respondida { color: #9ca3af; }
    .item-card.nao-respondida {
      background: #F4F7FA;
      border-color: #E5E9F0;
    }
    .header-meta a { color: #00B8A9; text-decoration: none; }
    .resultado-card {
      border: 1px solid #E5E9F0;
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 10px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .resultado-topo {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 10px;
    }
    .resultado-emoji { font-size: 32px; line-height: 1; }
    .resultado-percentual { font-size: 28px; font-weight: 700; }
    .resultado-faixa { font-size: 14px; font-weight: 700; }
    .faixa-barra {
      position: relative;
      display: flex;
      height: 14px;
      margin: 6px 0 14px;
    }
    .faixa-segmento { height: 100%; }
    .faixa-segmento:first-child { border-radius: 7px 0 0 7px; }
    .faixa-segmento:last-child { border-radius: 0 7px 7px 0; }
    .faixa-marcador {
      position: absolute;
      top: -4px;
      width: 4px;
      height: 22px;
      margin-left: -2px;
      background: #1B2A4A;
      border: 1px solid #FFFFFF;
      border-radius: 2px;
    }
    .anteriores {
      display: flex;
      gap: 16px;
      font-size: 11px;
      margin-bottom: 10px;
    }
    .anteriores strong { margin-left: 4px; }
    .contadores {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
    }
    .contador {
      background: #F4F7FA;
      border: 1px solid #E5E9F0;
      border-radius: 6px;
      padding: 8px;
      text-align: center;
    }
    .contador-valor { font-size: 18px; font-weight: 700; }
    .contador-rotulo { font-size: 10px; opacity: 0.7; text-transform: uppercase; }
    .pagina-final {
      page-break-before: always;
      break-before: page;
    }
    .resumo-quadro {
      width: 100%;
      border: 1px solid #E5E9F0;
      border-radius: 6px;
      margin-bottom: 40px;
    }
    .resumo-quadro td { padding: 6px 10px; font-size: 12px; border-bottom: 1px solid #E5E9F0; }
    .resumo-quadro td:first-child { width: 40%; font-weight: 600; background: #F4F7FA; }
    .data-local { font-size: 13px; margin: 48px 0 56px; text-align: center; }
    .assinaturas {
      display: flex;
      gap: 48px;
      justify-content: space-between;
    }
    .assinatura {
      flex: 1;
      border-top: 1px solid #1B2A4A;
      padding-top: 6px;
      text-align: center;
      font-size: 12px;
    }
    .assinatura-papel { font-size: 10px; opacity: 0.7; text-transform: uppercase; }
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
    ${this.gerarCartaoResultado(resultado)}
    ${this.gerarMetricasGerais(resultado)}
    ${this.gerarDetalhamentoPorGrupo(gruposItens, resultado.grupos, assetsPdf)}
    ${this.gerarResumoExecutivo(auditoria.resumoExecutivo)}
    ${this.gerarPaginaFinal(auditoria, resultado)}
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Agrupa os itens pela mesma chave do cálculo do resultado (`grupoId`),
   * para casar cada grupo com suas métricas por essa chave.
   */
  private agruparItens(itens: AuditoriaItem[]): { grupoId: string; itens: AuditoriaItem[] }[] {
    const porGrupo = new Map<string, AuditoriaItem[]>();
    for (const item of itens) {
      const chave = item.templateItem?.grupoId || 'sem-grupo';
      if (!porGrupo.has(chave)) porGrupo.set(chave, []);
      porGrupo.get(chave)!.push(item);
    }
    return Array.from(porGrupo.entries())
      .map(([grupoId, grupoItens]) => ({ grupoId, itens: grupoItens }))
      .sort((a, b) => (a.itens[0].templateItem?.grupo?.ordem || 0) - (b.itens[0].templateItem?.grupo?.ordem || 0));
  }

  private numero(valor: number): string {
    return Number(valor).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }

  /** Percentual com 2 casas e vírgula (ex.: 82,50%). */
  private percentual(valor: number): string {
    return `${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }

  private formatarDataHora(data: Date | string | null | undefined): string {
    if (!data) return 'N/A';
    return new Date(data).toLocaleString('pt-BR', {
      timeZone: FUSO,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatarDataCurta(data: Date | string): string {
    return new Date(data).toLocaleDateString('pt-BR', {
      timeZone: FUSO,
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
  }

  private formatarDuracao(auditoria: Auditoria): string {
    if (!auditoria.dataInicio || !auditoria.dataFim) return 'N/A';
    const minutosTotais = Math.round(
      (new Date(auditoria.dataFim).getTime() - new Date(auditoria.dataInicio).getTime()) / 60000,
    );
    if (minutosTotais < 1) return 'menos de 1 min';
    const dias = Math.floor(minutosTotais / 1440);
    const horas = Math.floor((minutosTotais % 1440) / 60);
    const minutos = minutosTotais % 60;
    return [dias ? `${dias} d` : '', horas ? `${horas} h` : '', minutos ? `${minutos} min` : '']
      .filter(Boolean)
      .join(' ');
  }

  private nomeCliente(auditoria: Auditoria): string {
    return auditoria.unidade?.cliente?.nomeFantasia || auditoria.unidade?.cliente?.razaoSocial || 'Cliente';
  }

  /**
   * Gera o cabeçalho do relatório com os dados da avaliação.
   */
  private gerarCabecalho(auditoria: Auditoria): string {
    const codigo = (auditoria.id ?? '').slice(0, 8).toUpperCase();
    const temCoordenadas = auditoria.latitudeInicio != null && auditoria.longitudeInicio != null;
    const linkMapa = temCoordenadas
      ? `<span class="header-meta"><a href="https://www.google.com/maps?q=${Number(auditoria.latitudeInicio)},${Number(auditoria.longitudeInicio)}">Ver no mapa</a></span>`
      : '';
    return `
    <div class="header">
      <h1>${this.escapeHtml(auditoria.template?.nome || 'Checklist')}</h1>
      <div class="subtitle">
        ${this.escapeHtml(this.nomeCliente(auditoria))} — ${this.escapeHtml(auditoria.unidade?.nome || 'Unidade')}
      </div>
      <div class="header-info">
        <span>Auditor: ${this.escapeHtml(auditoria.consultor?.nome || 'Não informado')}</span>
        <span>Código: ${this.escapeHtml(codigo)}</span>
        <span>Início: ${this.formatarDataHora(auditoria.dataInicio)}</span>
        <span>Fim: ${this.formatarDataHora(auditoria.dataFim)}</span>
        <span>Duração: ${this.escapeHtml(this.formatarDuracao(auditoria))}</span>
        ${linkMapa}
      </div>
    </div>
    `;
  }

  /**
   * Posição (0–100) da nota na barra: cada faixa ocupa largura proporcional ao seu intervalo.
   */
  private posicaoNaBarra(nota: number, faixas: FaixaClassificacao[]): number {
    const ordenadas = [...faixas].sort((a, b) => a.de - b.de);
    const total = ordenadas.reduce((acc, f) => acc + (f.ate - f.de), 0);
    if (total <= 0) return 0;
    let acumulado = 0;
    for (const f of ordenadas) {
      const largura = f.ate - f.de;
      if (nota < f.de) return (acumulado / total) * 100;
      if (nota <= f.ate) return ((acumulado + (nota - f.de)) / total) * 100;
      acumulado += largura;
    }
    return 100;
  }

  /**
   * Cartão de resultado: nota, faixa, barra, anteriores e contadores.
   */
  private gerarCartaoResultado(resultado: ResultadoAuditoria): string {
    const { classificacao, faixas, tendencia, anteriores, contadores } = resultado;
    const cor = classificacao.cor ?? '#1B2A4A';
    const seta =
      tendencia === 'subiu'
        ? '<span style="color:#10b981;">▲</span>'
        : tendencia === 'caiu'
          ? '<span style="color:#ef4444;">▼</span>'
          : '';
    const ordenadas = [...faixas].sort((a, b) => a.de - b.de);
    const total = ordenadas.reduce((acc, f) => acc + (f.ate - f.de), 0) || 1;
    const segmentos = ordenadas
      .map(
        (f) =>
          `<div class="faixa-segmento" style="width:${(((f.ate - f.de) / total) * 100).toFixed(4)}%;background:${this.escapeHtml(f.cor)};"></div>`,
      )
      .join('');
    const marcador = `<div class="faixa-marcador" style="left:${this.posicaoNaBarra(resultado.aproveitamento, faixas).toFixed(2)}%;"></div>`;
    const listaAnteriores = anteriores.length
      ? `<div class="anteriores">${anteriores
          .map((a) => `<span>${this.formatarDataCurta(a.dataFim)}<strong>${this.percentual(a.aproveitamento)}</strong></span>`)
          .join('')}</div>`
      : '';
    const contador = (valor: number | string, rotulo: string) =>
      `<div class="contador"><div class="contador-valor">${valor}</div><div class="contador-rotulo">${rotulo}</div></div>`;

    return `
    <div class="resultado-card">
      <div class="resultado-topo">
        <span class="resultado-emoji">${this.escapeHtml(classificacao.emoji ?? '')}</span>
        <span class="resultado-percentual" style="color:${this.escapeHtml(cor)};">${this.percentual(resultado.aproveitamento)} ${seta}</span>
        <span class="resultado-faixa" style="color:${this.escapeHtml(cor)};">${this.escapeHtml(classificacao.nome)}</span>
      </div>
      <div class="faixa-barra">${segmentos}${marcador}</div>
      ${listaAnteriores}
      <div class="contadores">
        ${contador(this.numero(contadores.pontosPossiveis), 'Pontos possíveis')}
        ${contador(this.numero(contadores.pontosRealizados), 'Pontos realizados')}
        ${contador(contadores.naoConformidades, 'Não conformidades')}
        ${contador(contadores.fotos, 'Fotos')}
        ${contador(contadores.planosAcao, 'Planos de ação')}
      </div>
    </div>
    `;
  }

  /**
   * Tabela por grupo e gráficos, a partir do resultado.
   */
  private gerarMetricasGerais(resultado: ResultadoAuditoria): string {
    const { contadores, grupos, faixas } = resultado;
    return `
    <div class="section">
      <h2 class="section-title">Métricas Gerais</h2>
      ${this.gerarTabelaMetricas(resultado)}
      <div class="charts-block">
        ${this.gerarGraficoAproveitamentoGrupos(grupos, resultado.aproveitamento, faixas)}
        ${this.gerarGraficoDistribuicaoPontos({
          pontosPossiveis: contadores.pontosPossiveis,
          pontosRealizados: contadores.pontosRealizados,
        })}
      </div>
    </div>
    `;
  }

  private corBarraAproveitamento(ap: number, faixas: FaixaClassificacao[]): string {
    return classificar(ap, faixas).cor ?? COR_SEM_FAIXA;
  }

  private gerarGraficoAproveitamentoGrupos(
    grupos: ResultadoGrupo[],
    aproveitamentoGeral: number,
    faixas: FaixaClassificacao[],
  ): string {
    const barrasGrupos = grupos.map((g, idx) => ({
      indice: idx + 1,
      valor: Math.min(100, Math.max(0, Number(g.aproveitamento ?? 0))),
      cor: this.corBarraAproveitamento(Number(g.aproveitamento ?? 0), faixas),
    }));
    const barras = [
      ...barrasGrupos,
      {
        indice: 'GERAL',
        valor: Math.min(100, Math.max(0, aproveitamentoGeral)),
        cor: this.corBarraAproveitamento(aproveitamentoGeral, faixas),
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
          ${[...faixas]
            .sort((a, b) => a.de - b.de)
            .map(
              (f) =>
                `<span class="chart-legend-item"><span class="chart-legend-color" style="background:${this.escapeHtml(f.cor)};"></span> ${this.escapeHtml(f.nome)} (${this.numero(f.de)}–${this.numero(f.ate)}%)</span>`,
            )
            .join('')}
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

  /**
   * Gera a tabela de métricas por grupo (linha "Geral" inclusa).
   */
  private gerarTabelaMetricas(resultado: ResultadoAuditoria): string {
    const { grupos, contadores } = resultado;
    const soma = (campo: 'naoAplicaveis' | 'naoRespondidas') => grupos.reduce((acc, g) => acc + g[campo], 0);
    const celulaNc = (n: number) =>
      n > 0 ? `<span class="badge badge-error">${n}</span>` : '<span style="color: #9ca3af;">0</span>';

    const linhas = grupos
      .map(
        (g) => `
          <tr>
            <td>${this.escapeHtml(g.nome)}</td>
            <td class="text-center" style="font-weight: 600;">${g.aproveitamento != null ? this.percentual(g.aproveitamento) : '—'}</td>
            <td class="text-center">${this.numero(g.pontosPossiveis)}</td>
            <td class="text-center">${this.numero(g.pontosRealizados)}</td>
            <td class="text-center">${g.naoAplicaveis}</td>
            <td class="text-center">${celulaNc(g.naoConformidades)}</td>
            <td class="text-center">${g.naoRespondidas}</td>
          </tr>`,
      )
      .join('');

    return `
      <table>
        <thead>
          <tr>
            <th>Grupo</th>
            <th class="text-center">AP</th>
            <th class="text-center">PP</th>
            <th class="text-center">PR</th>
            <th class="text-center">NA</th>
            <th class="text-center">NC</th>
            <th class="text-center">NR</th>
          </tr>
        </thead>
        <tbody>
          ${linhas}
          <tr class="total">
            <td>Geral</td>
            <td class="text-center">${this.percentual(resultado.aproveitamento)}</td>
            <td class="text-center">${this.numero(contadores.pontosPossiveis)}</td>
            <td class="text-center">${this.numero(contadores.pontosRealizados)}</td>
            <td class="text-center">${soma('naoAplicaveis')}</td>
            <td class="text-center">${contadores.naoConformidades}</td>
            <td class="text-center">${soma('naoRespondidas')}</td>
          </tr>
        </tbody>
      </table>
      <div class="legend">
        AP: Aproveitamento | PP: Pontos possíveis | PR: Pontos realizados | NA: Não aplicáveis | NC: Não conformidades | NR: Não respondidas
      </div>
    `;
  }

  /**
   * Ícone, cor e classe do item: o sentido da resposta define a cor; o ícone configurado
   * na opção (código do catálogo ou caractere) substitui o padrão do sentido.
   */
  private visualDaResposta(
    item: AuditoriaItem,
    sentido: SentidoResposta | null,
  ): { classe: string; icone: string } {
    if (!sentido) return { classe: 'nao-respondida', icone: '?' };
    const configurado = (item.templateItem?.opcoesRespostaConfig || []).find((c) => c.valor === item.resposta)?.icone;
    const icone = configurado
      ? (ICONES_RESPOSTA.find((i) => i.codigo === configurado)?.emoji ?? configurado)
      : ICONE_PADRAO_POR_SENTIDO[sentido];
    const classe = sentido === 'positiva' ? 'conforme' : sentido === 'negativa' ? 'nao-conforme' : 'nao-aplicavel';
    return { classe, icone };
  }

  private rotuloDaResposta(resposta: string | null | undefined): string {
    switch (resposta) {
      case RespostaItem.CONFORME:
        return 'Conforme';
      case RespostaItem.NAO_CONFORME:
        return 'Não conforme';
      case RespostaItem.NAO_APLICAVEL:
        return 'Não aplicável';
      case RespostaItem.NAO_AVALIADO:
      case null:
      case undefined:
      case '':
        return 'Não respondida';
      default:
        return this.escapeHtml(resposta);
    }
  }

  /**
   * Última página: quadro de resumo e linhas para assinatura.
   */
  private gerarPaginaFinal(auditoria: Auditoria, resultado: ResultadoAuditoria): string {
    const linha = (rotulo: string, valor: string) => `<tr><td>${rotulo}</td><td>${valor}</td></tr>`;
    const { contadores, classificacao } = resultado;
    const auditor = auditoria.consultor?.nome || 'Auditor';
    const responsavel = auditoria.unidade?.responsavel || 'Responsável pela unidade';
    return `
    <div class="section pagina-final">
      <h2 class="section-title">RESUMO DA AVALIAÇÃO</h2>
      <table class="resumo-quadro">
        <tbody>
          ${linha('Checklist', this.escapeHtml(auditoria.template?.nome || 'Checklist'))}
          ${linha('Unidade', this.escapeHtml(auditoria.unidade?.nome || 'Unidade'))}
          ${linha('Início', this.formatarDataHora(auditoria.dataInicio))}
          ${linha('Fim', this.formatarDataHora(auditoria.dataFim))}
          ${linha('Duração', this.escapeHtml(this.formatarDuracao(auditoria)))}
          ${linha('Auditor', this.escapeHtml(auditoria.consultor?.nome || 'Não informado'))}
          ${linha('Aproveitamento', this.percentual(resultado.aproveitamento))}
          ${linha('Faixa', this.escapeHtml(classificacao.nome))}
          ${linha('Pontos possíveis', this.numero(contadores.pontosPossiveis))}
          ${linha('Pontos realizados', this.numero(contadores.pontosRealizados))}
          ${linha('Não conformidades', String(contadores.naoConformidades))}
        </tbody>
      </table>
      <p class="data-local">____________________, ____ de ______________ de ________</p>
      <div class="assinaturas">
        <div class="assinatura">${this.escapeHtml(auditor)}<div class="assinatura-papel">Auditor</div></div>
        <div class="assinatura">${this.escapeHtml(responsavel)}<div class="assinatura-papel">Responsável pela unidade</div></div>
      </div>
    </div>
    `;
  }

  /**
   * Gera o detalhamento por grupo.
   */
  private gerarDetalhamentoPorGrupo(
    gruposItens: { grupoId: string; itens: AuditoriaItem[] }[],
    metricas: ResultadoGrupo[],
    assetsPdf?: RelatorioAuditoriaPdfAssetsHtml,
  ): string {
    let html = `
    <div class="section">
      <h2 class="section-title">Detalhamento por Grupo</h2>
    `;

    gruposItens.forEach(({ grupoId, itens }) => {
      const grupo = metricas.find((m) => m.grupoId === grupoId);
      html += `
      <div class="grupo-section">
        <div class="grupo-header">
          <h3 class="grupo-title">${this.escapeHtml(grupo?.nome ?? itens[0]?.templateItem?.grupo?.nome ?? 'Sem Grupo')}</h3>
          <div class="grupo-metrics">
            Aproveitamento: <strong>${grupo?.aproveitamento != null ? this.percentual(grupo.aproveitamento) : '—'}</strong> | 
            Pontos: ${this.numero(grupo?.pontosRealizados ?? 0)}/${this.numero(grupo?.pontosPossiveis ?? 0)}
          </div>
        </div>
        <div class="items">
      `;

      itens.forEach((item) => {
        const resposta = item.resposta;
        const respondida = !!resposta && resposta !== RespostaItem.NAO_AVALIADO;
        const sentido = sentidoDaOpcao(item.templateItem, resposta);
        const isNaoConforme = sentido === 'negativa';
        const visual = this.visualDaResposta(item, respondida ? (sentido ?? 'neutra') : null);
        const classeCard = visual.classe;
        const classeIcon = visual.classe;
        const icon = this.escapeHtml(visual.icone);
        const respostaTexto = this.rotuloDaResposta(resposta);

        const legislacaoItem = isNaoConforme ? nomesLegislacoesDoItem(item) : null;

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
                  ${legislacaoItem
                    ? `<div class="item-detail">
                        <span class="item-detail-label">Legislação: </span>
                        <span class="item-detail-value">${this.escapeHtml(legislacaoItem)}</span>
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
                            .map((foto) => {
                              const embutida = assetsPdf?.fotosDataUriPorId?.[foto.id];
                              return embutida
                                ? `<img class="item-foto" src="${embutida}" alt="Foto do item" />`
                                : `<img class="item-foto" data-foto-id="${this.escapeHtml(foto.id)}" alt="Foto do item" />`;
                            })
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

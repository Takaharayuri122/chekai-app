import { Injectable } from '@nestjs/common';
import { RelatorioTecnico } from '../entities/relatorio-tecnico.entity';

@Injectable()
export class RelatorioTecnicoHtmlService {
  gerarHtml(relatorio: RelatorioTecnico): string {
    const nomeCliente =
      relatorio.cliente?.nomeFantasia || relatorio.cliente?.razaoSocial || 'Cliente';
    const nomeUnidade = relatorio.unidade?.nome || 'Sem unidade';
    const dataCriacao = relatorio.criadoEm
      ? new Date(relatorio.criadoEm).toLocaleDateString('pt-BR')
      : '-';
    const acoes = relatorio.acoesExecutadas
      .map((acao) => `<li>${this.escapeHtml(acao)}</li>`)
      .join('');
    const fotos = relatorio.fotos
      .map(
        (foto) => `
          <div class="foto-item">
            <img data-foto-id="${this.escapeHtml(foto.id)}" alt="Evidência fotográfica" />
          </div>
        `,
      )
      .join('');
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Técnico - ${this.escapeHtml(nomeCliente)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1B2A4A; padding: 12px; }
    .container { max-width: 1120px; margin: 0 auto; }
    .header { border-bottom: 1px solid #E5E9F0; padding-bottom: 8px; margin-bottom: 12px; }
    .header h1 { font-size: 20px; margin-bottom: 6px; }
    .meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: #4b5563; }
    .section { margin-top: 14px; border: 1px solid #E5E9F0; border-radius: 6px; padding: 10px; }
    .section h2 { font-size: 15px; margin-bottom: 8px; color: #00B8A9; }
    .rich { font-size: 13px; line-height: 1.45; }
    .acoes { padding-left: 18px; font-size: 13px; }
    .fotos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .foto-item { border: 1px solid #E5E9F0; border-radius: 6px; overflow: hidden; height: 130px; }
    .foto-item img { width: 100%; height: 100%; object-fit: cover; }
    .assinatura-box { margin-top: 24px; border-top: 1px solid #1B2A4A; padding-top: 8px; width: 380px; }
    .assinatura-label { font-size: 12px; color: #6b7280; }
    .assinatura-nome { font-size: 13px; font-weight: 600; margin-top: 2px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Relatório Técnico</h1>
      <div class="meta">
        <span><strong>Cliente:</strong> ${this.escapeHtml(nomeCliente)}</span>
        <span><strong>Unidade:</strong> ${this.escapeHtml(nomeUnidade)}</span>
        <span><strong>Data:</strong> ${this.escapeHtml(dataCriacao)}</span>
      </div>
    </div>
    <div class="section">
      <h2>Identificação</h2>
      <div class="rich">${this.escapeHtml(relatorio.identificacao)}</div>
    </div>
    <div class="section">
      <h2>Descrição da Ocorrência</h2>
      <div class="rich">${relatorio.descricaoOcorrenciaHtml}</div>
    </div>
    <div class="section">
      <h2>Evidências Fotográficas</h2>
      <div class="fotos-grid">${fotos || '<span>Sem evidências anexadas.</span>'}</div>
    </div>
    <div class="section">
      <h2>Avaliação Técnica</h2>
      <div class="rich">${relatorio.avaliacaoTecnicaHtml}</div>
    </div>
    <div class="section">
      <h2>Ações Executadas na Visita</h2>
      <ol class="acoes">${acoes || '<li>Sem ações informadas.</li>'}</ol>
    </div>
    <div class="section">
      <h2>Recomendações da Consultora</h2>
      <div class="rich">${relatorio.recomendacoesConsultoraHtml}</div>
    </div>
    <div class="section">
      <h2>Plano de Ação Sugerido</h2>
      <div class="rich">${relatorio.planoAcaoSugeridoHtml}</div>
    </div>
    <div class="section">
      <h2>Apoio Analítico ChekAi</h2>
      <div class="rich">${this.escapeHtml(relatorio.apoioAnaliticoChekAi || 'Não gerado')}</div>
    </div>
    <div class="section">
      <h2>Assinatura da Consultora</h2>
      <div style="height: 70px;"></div>
      <div class="assinatura-box">
        <div class="assinatura-label">Assinatura</div>
        <div class="assinatura-nome">${this.escapeHtml(relatorio.assinaturaNomeConsultora || 'Consultora responsável')}</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

import { Injectable } from '@nestjs/common';
import { RelatorioTecnico } from '../entities/relatorio-tecnico.entity';

/** Assets opcionais para PDF (fotos e logos embutidos no HTML). */
export interface RelatorioTecnicoPdfAssetsHtml {
  readonly fotosPorId: Record<string, string>;
}

@Injectable()
export class RelatorioTecnicoHtmlService {
  gerarHtml(relatorio: RelatorioTecnico, assetsPdf?: RelatorioTecnicoPdfAssetsHtml): string {
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
      .map((foto) => {
        const embutida = assetsPdf?.fotosPorId[foto.id];
        let srcAttr: string;
        if (embutida) {
          srcAttr = `src="${embutida}"`;
        } else if (foto.url?.startsWith('data:')) {
          srcAttr = `data-foto-id="${this.escapeHtml(foto.id)}"`;
        } else if (foto.url) {
          srcAttr = `src="${this.escapeHtml(foto.url)}"`;
        } else {
          return '<div class="foto-item"><span class="rich">Sem imagem</span></div>';
        }
        return `
          <div class="foto-item">
            <img ${srcAttr} alt="Evidência fotográfica" />
          </div>
        `;
      })
      .join('');
    const apoioAnaliticoHtml = this.gerarHtmlApoioAnalitico(relatorio.apoioAnaliticoChekAi || '');
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
    .rich { font-size: 13px; line-height: 1.45; overflow: hidden; }
    .rich ul, .rich ol { margin: 6px 0; padding-left: 18px; list-style-position: inside; }
    .rich li { margin: 2px 0; }
    .acoes { padding-left: 18px; font-size: 13px; }
    .fotos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .foto-item { border: 1px solid #E5E9F0; border-radius: 6px; overflow: hidden; height: 130px; background: #f8fafc; display: flex; align-items: center; justify-content: center; padding: 4px; }
    .foto-item img { width: 100%; height: 100%; object-fit: contain; display: block; }
    .assinaturas-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 8px; }
    .assinatura-box { margin-top: 24px; border-top: 1px solid #1B2A4A; padding-top: 8px; min-height: 58px; }
    .assinatura-label { font-size: 12px; color: #6b7280; }
    .assinatura-nome { font-size: 13px; font-weight: 600; margin-top: 2px; }
    .apoio-bloco { border: 1px solid #dbeafe; border-radius: 6px; background: #eff6ff; padding: 8px; margin-bottom: 8px; }
    .apoio-titulo { font-size: 13px; font-weight: 700; margin-bottom: 4px; }
    .apoio-linha { font-size: 12px; line-height: 1.4; margin-top: 2px; }
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
      <div class="rich">${apoioAnaliticoHtml}</div>
    </div>
    <div class="section">
      <h2>Assinaturas</h2>
      <div class="assinaturas-grid">
        <div>
          <div style="height: 70px;"></div>
          <div class="assinatura-box">
            <div class="assinatura-label">Auditor</div>
            <div class="assinatura-nome">${this.escapeHtml(relatorio.assinaturaNomeConsultora || 'Consultora responsável')}</div>
          </div>
        </div>
        <div>
          <div style="height: 70px;"></div>
          <div class="assinatura-box">
            <div class="assinatura-label">Responsável</div>
            <div class="assinatura-nome">${this.escapeHtml(relatorio.responsavel || '-')}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  private gerarHtmlApoioAnalitico(texto: string): string {
    const valor = texto.trim();
    if (!valor) {
      return '<div class="apoio-linha">Não gerado</div>';
    }
    const blocos = valor
      .split(/\n{2,}/)
      .map((bloco) => bloco.trim())
      .filter(Boolean)
      .map((bloco) => {
        const linhas = bloco.split('\n').map((linha) => linha.trim()).filter(Boolean);
        if (!linhas.length) {
          return '';
        }
        const primeiraLinha = linhas[0];
        const tituloMatch = primeiraLinha.match(/^\*\*(.+?)\*\*:?\s*$/) || primeiraLinha.match(/^(.+):$/);
        const titulo = tituloMatch ? tituloMatch[1].trim() : '';
        const corpo = titulo ? linhas.slice(1) : linhas;
        const linhasHtml = (corpo.length ? corpo : ['Sem detalhes adicionais.'])
          .map((linha) => `<div class="apoio-linha">${this.escapeHtml(linha).replace(/^- /, '• ')}</div>`)
          .join('');
        return `
          <div class="apoio-bloco">
            ${titulo ? `<div class="apoio-titulo">${this.escapeHtml(titulo)}</div>` : ''}
            ${linhasHtml}
          </div>
        `;
      })
      .join('');
    return blocos || '<div class="apoio-linha">Não gerado</div>';
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

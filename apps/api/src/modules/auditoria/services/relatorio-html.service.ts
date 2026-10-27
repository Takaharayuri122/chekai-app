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
  ehImagemDeAssinatura,
  sentidoDaOpcao,
} from '../../checklist/regras';
import { TipoRespostaCustomizada } from '../../checklist/entities/template-item.entity';
import { posicaoNaBarra, segmentosDaBarra } from './barra-faixas';
import { ResultadoAuditoria, ResultadoGrupo } from './resultado-auditoria.service';

const COR_SEM_FAIXA = '#9ca3af';
const FUSO = 'America/Sao_Paulo';

/** Mapas opcionais para embutir fotos já normalizadas no HTML (geração PDF). */
export interface RelatorioAuditoriaPdfAssetsHtml {
  readonly fotosDataUriPorId?: Record<string, string>;
}

/** Classe visual do item, derivada do sentido da resposta. */
type ClasseResposta = 'positiva' | 'negativa' | 'neutra' | 'nao-respondida';

interface ItemDoRelatorio {
  readonly item: AuditoriaItem;
  /** Número da pergunta no relatório: grupo.posição (ex.: 2.4). */
  readonly numero: string;
  readonly classe: ClasseResposta;
  readonly icone: string;
  /** Ícone escolhido na configuração da opção (emoji), em vez do símbolo padrão do sentido. */
  readonly iconePersonalizado: boolean;
  readonly respostaTexto: string;
  /** Imagem da assinatura (data URL PNG) quando a pergunta é de assinatura. */
  readonly assinatura: string | null;
}

interface GrupoDoRelatorio {
  readonly grupoId: string;
  readonly numero: number;
  readonly nome: string;
  readonly metricas: ResultadoGrupo | undefined;
  readonly itens: ItemDoRelatorio[];
}

const ESTILOS = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --tinta: #1B2A4A;
      --tinta-suave: #5B6B85;
      --tinta-fraca: #8A97AB;
      --linha: #E5E9F0;
      --fundo-suave: #F5F7FA;
      --marca: #00B8A9;
      --positiva: #10B981;
      --positiva-fundo: #ECFDF5;
      --negativa: #DC2626;
      --negativa-fundo: #FEF2F2;
      --neutra: #94A3B8;
      --neutra-fundo: #F1F5F9;
    }
    html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif,
        'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI Emoji';
      color: var(--tinta);
      background: #FFFFFF;
      font-size: 11px;
      line-height: 1.45;
    }
    .emoji { font-family: 'Apple Color Emoji', 'Noto Color Emoji', 'Segoe UI Emoji', sans-serif; }

    /* Capa */
    .capa { margin-bottom: 18px; }
    .capa-rotulo {
      font-size: 9px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;
      color: var(--marca); margin-bottom: 4px;
    }
    .capa h1 { font-size: 22px; font-weight: 800; line-height: 1.2; letter-spacing: -0.2px; }
    .capa-local { font-size: 13px; color: var(--tinta-suave); margin-top: 2px; }
    .dados-avaliacao {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 16px;
      margin-top: 14px; padding: 12px 14px; background: var(--fundo-suave); border-radius: 8px;
    }
    .dado-rotulo { font-size: 8.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; color: var(--tinta-fraca); }
    .dado-valor { font-size: 11px; font-weight: 600; margin-top: 1px; }
    .dado-valor a { color: var(--marca); text-decoration: none; }

    /* Resultado */
    .resultado {
      display: grid; grid-template-columns: 150px 1fr; gap: 22px; align-items: center;
      padding: 16px 18px; border: 1px solid var(--linha); border-radius: 10px; margin-bottom: 12px;
      break-inside: avoid; page-break-inside: avoid;
    }
    .resultado > * { min-width: 0; }
    .medidor { position: relative; width: 150px; height: 150px; }
    .medidor svg { display: block; }
    .medidor-centro {
      position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .medidor-valor { font-size: 25px; font-weight: 800; letter-spacing: -0.5px; line-height: 1; }
    .medidor-legenda { font-size: 8.5px; color: var(--tinta-fraca); text-transform: uppercase; letter-spacing: 0.6px; margin-top: 4px; }
    .faixa-atual { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .faixa-selo {
      display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; border-radius: 999px;
      font-size: 13px; font-weight: 700; color: #FFFFFF;
    }
    .faixa-selo .emoji { font-size: 13px; }
    .tendencia { font-size: 11px; font-weight: 600; }
    .tendencia.subiu { color: var(--positiva); }
    .tendencia.caiu { color: var(--negativa); }
    .tendencia.igual { color: var(--tinta-suave); }
    .faixa-texto { font-size: 10.5px; color: var(--tinta-suave); margin-bottom: 12px; }
    .faixa-barra { position: relative; height: 10px; margin-bottom: 4px; }
    .faixa-trilho { position: absolute; inset: 0; overflow: hidden; border-radius: 5px; background: #EEF1F5; }
    .faixa-segmento { position: absolute; top: 0; bottom: 0; }
    .faixa-marcador {
      position: absolute; top: -5px; width: 4px; height: 20px; margin-left: -2px;
      background: var(--tinta); border: 1.5px solid #FFFFFF; border-radius: 3px; box-shadow: 0 0 0 0.5px var(--tinta);
    }
    .faixa-escala { position: relative; height: 12px; font-size: 8px; color: var(--tinta-fraca); }
    .faixa-escala span { position: absolute; transform: translateX(-50%); }
    .faixa-escala span:first-child { transform: none; }
    .faixa-escala span:last-child { transform: translateX(-100%); }
    .anteriores { display: flex; gap: 6px; margin-top: 12px; align-items: stretch; }
    .anterior {
      flex: 1; border: 1px solid var(--linha); border-radius: 6px; padding: 5px 8px; text-align: center;
    }
    .anterior.atual { border-color: var(--tinta); }
    .anterior-data { font-size: 8.5px; color: var(--tinta-fraca); }
    .anterior-valor { font-size: 12px; font-weight: 700; }

    .contadores { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 20px; }
    .contador { border: 1px solid var(--linha); border-radius: 8px; padding: 8px 10px; }
    .contador-valor { font-size: 18px; font-weight: 800; line-height: 1.1; }
    .contador-valor small { font-size: 10px; font-weight: 600; color: var(--tinta-fraca); }
    .contador-rotulo { font-size: 8.5px; color: var(--tinta-suave); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
    .contador.alerta { border-color: #FCA5A5; background: var(--negativa-fundo); }
    .contador.alerta .contador-valor { color: var(--negativa); }

    /* Seções */
    .secao { margin-bottom: 20px; }
    .secao-titulo {
      display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
      font-size: 14px; font-weight: 800; padding-bottom: 6px; margin-bottom: 10px;
      border-bottom: 2px solid var(--tinta);
      break-after: avoid; page-break-after: avoid;
    }
    .secao-titulo small { font-size: 10px; font-weight: 500; color: var(--tinta-suave); }

    /* Desempenho por grupo */
    .tabela-grupos { width: 100%; border-collapse: collapse; break-inside: avoid; page-break-inside: avoid; }
    .tabela-grupos th {
      font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--tinta-fraca);
      text-align: center; padding: 0 4px 6px; border-bottom: 1px solid var(--linha);
    }
    .tabela-grupos th:first-child { text-align: left; }
    .tabela-grupos td { padding: 7px 4px; border-bottom: 1px solid var(--linha); text-align: center; font-size: 10.5px; }
    .tabela-grupos td.grupo-nome { text-align: left; font-weight: 600; width: 34%; }
    .tabela-grupos td.grupo-barra { width: 26%; }
    .tabela-grupos tr.total td { font-weight: 800; border-bottom: none; background: var(--fundo-suave); }
    .barra-grupo { height: 8px; border-radius: 4px; background: #EEF1F5; overflow: hidden; }
    .barra-grupo div { height: 100%; border-radius: 4px; }
    .valor-ap { font-weight: 700; }
    .nc-destaque { color: var(--negativa); font-weight: 700; }
    .zero { color: var(--tinta-fraca); }
    .legenda { display: flex; flex-wrap: wrap; gap: 4px 14px; margin-top: 8px; font-size: 9px; color: var(--tinta-suave); }
    .legenda-item { display: inline-flex; align-items: center; gap: 5px; }
    .legenda-cor { width: 9px; height: 9px; border-radius: 2px; }
    .legenda-siglas { margin-top: 4px; font-size: 8.5px; color: var(--tinta-fraca); }

    /* Não conformidades */
    .sem-nc {
      padding: 12px 14px; border-radius: 8px; background: var(--positiva-fundo); color: #047857;
      font-weight: 600; break-inside: avoid;
    }
    .nc-card {
      border: 1px solid #FECACA; border-left: 4px solid var(--negativa); border-radius: 6px;
      padding: 10px 12px; margin-bottom: 8px; break-inside: avoid; page-break-inside: avoid;
    }
    .nc-grupo { font-size: 8.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--negativa); }
    .nc-pergunta { font-size: 11.5px; font-weight: 700; margin: 2px 0 6px; }
    .detalhes { display: grid; grid-template-columns: 88px 1fr; gap: 3px 10px; font-size: 10.5px; }
    .detalhe-rotulo { color: var(--tinta-fraca); font-weight: 600; }
    .fotos { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .foto { display: block; width: 150px; height: 112px; object-fit: cover; border-radius: 4px; border: 1px solid var(--linha); }
    .fotos.pequenas .foto { width: 96px; height: 72px; }

    /* Análise da avaliação (resumo executivo) */
    .analise { border: 1px solid var(--linha); border-radius: 8px; padding: 12px 14px; break-inside: avoid; }
    .analise-texto { font-size: 11px; line-height: 1.6; white-space: pre-line; margin-bottom: 10px; }
    .analise-colunas { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 10px; }
    .analise-subtitulo { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .analise-lista { list-style: none; }
    .analise-lista li { display: flex; gap: 6px; padding: 2px 0; }
    .analise-lista .marca { font-weight: 700; flex-shrink: 0; }
    .recomendacao { display: flex; gap: 8px; padding: 6px 8px; background: var(--fundo-suave); border-radius: 4px; margin-bottom: 4px; }
    .recomendacao b { color: var(--marca); }
    .risco { display: inline-block; padding: 3px 10px; border-radius: 999px; font-weight: 700; font-size: 10px; }
    .risco-baixo { background: var(--positiva-fundo); color: #047857; }
    .risco-medio { background: #FFFBEB; color: #B45309; }
    .risco-alto, .risco-critico { background: var(--negativa-fundo); color: var(--negativa); }

    /* Respostas por grupo */
    .grupo { margin-bottom: 14px; }
    .grupo-cabecalho {
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      padding: 7px 10px; background: var(--fundo-suave); border-radius: 6px;
      break-after: avoid; page-break-after: avoid; break-inside: avoid;
    }
    .grupo-titulo { font-size: 11.5px; font-weight: 800; }
    .grupo-metricas { font-size: 10px; color: var(--tinta-suave); white-space: nowrap; }
    .grupo-ap { display: inline-block; padding: 1px 8px; border-radius: 999px; color: #FFFFFF; font-weight: 700; margin-left: 6px; }
    .item {
      display: grid; grid-template-columns: 20px 1fr auto; gap: 8px; align-items: start;
      padding: 6px 10px; border-bottom: 1px solid var(--linha); break-inside: avoid; page-break-inside: avoid;
    }
    .item.negativa { background: var(--negativa-fundo); }
    .item-icone {
      width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      font-size: 10px; font-weight: 800; color: #FFFFFF; line-height: 1;
    }
    .item-icone.positiva { background: var(--positiva); }
    .item-icone.negativa { background: var(--negativa); }
    .item-icone.neutra { background: var(--neutra); }
    .item-icone.nao-respondida { background: #FFFFFF; color: var(--tinta-fraca); border: 1px dashed var(--tinta-fraca); }
    .item-icone.personalizado { background: transparent; font-size: 14px; }
    .item-pergunta, .nc-pergunta { display: flex; }
    .item-pergunta { font-size: 10.5px; }
    .numero { flex-shrink: 0; min-width: 26px; font-weight: 700; color: var(--tinta-fraca); margin-right: 4px; font-variant-numeric: tabular-nums; }
    .numero-grupo { font-weight: 800; color: var(--marca); margin-right: 6px; }
    .item-obs { font-size: 10px; color: var(--tinta-suave); margin-top: 2px; }
    .assinatura-imagem {
      display: block; height: 64px; max-width: 240px; object-fit: contain; margin-top: 6px;
      padding: 4px 8px; border-bottom: 1px solid var(--tinta-fraca);
    }
    .item-resposta { font-size: 10px; font-weight: 700; white-space: nowrap; padding-top: 1px; }
    .item-resposta.positiva { color: #047857; }
    .item-resposta.negativa { color: var(--negativa); }
    .item-resposta.neutra, .item-resposta.nao-respondida { color: var(--tinta-fraca); }

    /* Assinaturas */
    .fechamento { margin-top: 28px; break-inside: avoid; page-break-inside: avoid; }
    .fechamento-resumo {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px 16px;
      padding: 12px 14px; background: var(--fundo-suave); border-radius: 8px; margin-bottom: 40px;
    }
    .data-local { font-size: 12px; text-align: center; margin-bottom: 56px; color: var(--tinta-suave); }
    .assinaturas { display: flex; gap: 48px; }
    .assinatura { flex: 1; border-top: 1px solid var(--tinta); padding-top: 6px; text-align: center; font-size: 11px; font-weight: 600; }
    .assinatura-papel { font-size: 8.5px; font-weight: 500; color: var(--tinta-fraca); text-transform: uppercase; letter-spacing: 0.6px; margin-top: 2px; }
`;

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
    const grupos = this.montarGrupos(auditoria.itens ?? [], resultado.grupos);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Auditoria - ${this.escapeHtml(auditoria.unidade?.nome || 'Unidade')}</title>
  <style>${ESTILOS}</style>
</head>
<body>
  ${this.gerarCapa(auditoria)}
  ${this.gerarCartaoResultado(resultado)}
  ${this.gerarDesempenhoPorGrupo(resultado, new Map(grupos.map((g) => [g.grupoId, g.numero])))}
  ${this.gerarResumoExecutivo(auditoria.resumoExecutivo)}
  ${this.gerarNaoConformidades(grupos, assetsPdf)}
  ${this.gerarRespostasPorGrupo(grupos, resultado.faixas, assetsPdf)}
  ${this.gerarFechamento(auditoria, resultado)}
</body>
</html>
    `.trim();
  }

  /**
   * Agrupa os itens pela mesma chave do cálculo do resultado (`grupoId`),
   * para casar cada grupo com suas métricas por essa chave.
   */
  private montarGrupos(itens: AuditoriaItem[], metricas: ResultadoGrupo[]): GrupoDoRelatorio[] {
    const porGrupo = new Map<string, AuditoriaItem[]>();
    for (const item of itens) {
      const chave = item.templateItem?.grupoId || 'sem-grupo';
      if (!porGrupo.has(chave)) porGrupo.set(chave, []);
      porGrupo.get(chave)!.push(item);
    }
    return Array.from(porGrupo.entries())
      .sort(([, a], [, b]) => (a[0].templateItem?.grupo?.ordem || 0) - (b[0].templateItem?.grupo?.ordem || 0))
      .map(([grupoId, grupoItens], indice) => {
        const grupoMetricas = metricas.find((m) => m.grupoId === grupoId);
        const numero = indice + 1;
        return {
          grupoId,
          numero,
          nome: grupoMetricas?.nome ?? grupoItens[0]?.templateItem?.grupo?.nome ?? 'Sem grupo',
          metricas: grupoMetricas,
          itens: [...grupoItens]
            .sort((a, b) => (a.templateItem?.ordem ?? 0) - (b.templateItem?.ordem ?? 0))
            .map((item, posicao) => this.itemDoRelatorio(item, `${numero}.${posicao + 1}`)),
        };
      });
  }

  private itemDoRelatorio(item: AuditoriaItem, numero: string): ItemDoRelatorio {
    const respondida = !!item.resposta && item.resposta !== RespostaItem.NAO_AVALIADO;
    const sentido = respondida ? (sentidoDaOpcao(item.templateItem, item.resposta) ?? 'neutra') : null;
    const assinatura =
      item.templateItem?.tipoRespostaCustomizada === TipoRespostaCustomizada.ASSINATURA &&
      ehImagemDeAssinatura(item.resposta)
        ? item.resposta
        : null;
    return {
      item,
      numero,
      ...this.visualDaResposta(item, sentido),
      ...(assinatura ? { icone: '✎', iconePersonalizado: false } : {}),
      respostaTexto: assinatura ? 'Assinado' : this.rotuloDaResposta(item.resposta),
      assinatura,
    };
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

  private corDaNota(valor: number, faixas: FaixaClassificacao[]): string {
    return classificar(valor, faixas).cor ?? COR_SEM_FAIXA;
  }

  private numeroDoGrupoHtml(numero: number | undefined): string {
    return numero ? `<span class="numero-grupo">${numero}.</span>` : '';
  }

  private dado(rotulo: string, valor: string): string {
    return `<div><div class="dado-rotulo">${rotulo}</div><div class="dado-valor">${valor}</div></div>`;
  }

  /**
   * Capa: nome do checklist, cliente e unidade, e os dados da avaliação.
   */
  private gerarCapa(auditoria: Auditoria): string {
    const codigo = (auditoria.id ?? '').slice(0, 8).toUpperCase();
    const temCoordenadas = auditoria.latitudeInicio != null && auditoria.longitudeInicio != null;
    const local = temCoordenadas
      ? `<a href="https://www.google.com/maps?q=${Number(auditoria.latitudeInicio)},${Number(auditoria.longitudeInicio)}">Ver no mapa</a>`
      : 'Não registrada';
    return `
  <header class="capa">
    <div class="capa-rotulo">Relatório de auditoria</div>
    <h1>${this.escapeHtml(auditoria.template?.nome || 'Checklist')}</h1>
    <div class="capa-local">${this.escapeHtml(this.nomeCliente(auditoria))} · ${this.escapeHtml(auditoria.unidade?.nome || 'Unidade')}</div>
    <div class="dados-avaliacao">
      ${this.dado('Auditor', this.escapeHtml(auditoria.consultor?.nome || 'Não informado'))}
      ${this.dado('Responsável pela unidade', this.escapeHtml(auditoria.unidade?.responsavel || 'Não informado'))}
      ${this.dado('Código', this.escapeHtml(codigo))}
      ${this.dado('Localização', local)}
      ${this.dado('Início', this.formatarDataHora(auditoria.dataInicio))}
      ${this.dado('Fim', this.formatarDataHora(auditoria.dataFim))}
      ${this.dado('Duração', this.escapeHtml(this.formatarDuracao(auditoria)))}
    </div>
  </header>`;
  }

  /** Anel com o aproveitamento, na cor da faixa. */
  private gerarMedidor(aproveitamento: number, cor: string): string {
    const raio = 62;
    const espessura = 13;
    const circunferencia = 2 * Math.PI * raio;
    const preenchido = (posicaoNaBarra(aproveitamento) / 100) * circunferencia;
    return `
      <div class="medidor">
        <svg width="150" height="150" viewBox="0 0 150 150">
          <circle cx="75" cy="75" r="${raio}" fill="none" stroke="#EEF1F5" stroke-width="${espessura}"/>
          <circle cx="75" cy="75" r="${raio}" fill="none" stroke="${this.escapeHtml(cor)}" stroke-width="${espessura}"
            stroke-linecap="round" stroke-dasharray="${preenchido.toFixed(2)} ${circunferencia.toFixed(2)}"
            transform="rotate(-90 75 75)"/>
        </svg>
        <div class="medidor-centro">
          <div class="medidor-valor" style="color:${this.escapeHtml(cor)};">${this.percentual(aproveitamento)}</div>
          <div class="medidor-legenda">Aproveitamento</div>
        </div>
      </div>`;
  }

  private textoTendencia(resultado: ResultadoAuditoria): string {
    const ultima = resultado.anteriores[0];
    if (!resultado.tendencia || !ultima) return '';
    const diferenca = Math.abs(resultado.aproveitamento - ultima.aproveitamento);
    const pontos = `${diferenca.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`;
    if (resultado.tendencia === 'subiu') return `<span class="tendencia subiu">▲ ${pontos} desde a última avaliação</span>`;
    if (resultado.tendencia === 'caiu') return `<span class="tendencia caiu">▼ ${pontos} desde a última avaliação</span>`;
    return '<span class="tendencia igual">Igual à última avaliação</span>';
  }

  /**
   * Cartão de resultado: anel com a nota, faixa, barra de faixas, avaliações anteriores e contadores.
   */
  private gerarCartaoResultado(resultado: ResultadoAuditoria): string {
    const { classificacao, faixas, anteriores, contadores } = resultado;
    const cor = classificacao.cor ?? COR_SEM_FAIXA;
    const segmentos = segmentosDaBarra(faixas);
    const barra = segmentos
      .map(
        (f) =>
          `<div class="faixa-segmento" style="left:${f.inicio.toFixed(4)}%;width:${f.largura.toFixed(4)}%;background:${this.escapeHtml(f.cor)};"></div>`,
      )
      .join('');
    const marcos = Array.from(new Set([0, ...segmentos.map((s) => Math.round(s.inicio)), 100])).sort((a, b) => a - b);
    const escala = marcos.map((m) => `<span style="left:${m}%;">${m}</span>`).join('');
    const emoji = classificacao.emoji ? `<span class="emoji">${this.escapeHtml(classificacao.emoji)}</span>` : '';
    const historico = anteriores.length
      ? `<div class="anteriores">${[...anteriores]
          .reverse()
          .map(
            (a) =>
              `<div class="anterior"><div class="anterior-data">${this.formatarDataCurta(a.dataFim)}</div><div class="anterior-valor" style="color:${this.escapeHtml(this.corDaNota(a.aproveitamento, faixas))};">${this.percentual(a.aproveitamento)}</div></div>`,
          )
          .join('')}<div class="anterior atual"><div class="anterior-data">Esta avaliação</div><div class="anterior-valor" style="color:${this.escapeHtml(cor)};">${this.percentual(resultado.aproveitamento)}</div></div></div>`
      : '';
    const naoAplicaveis = resultado.grupos.reduce((acc, g) => acc + g.naoAplicaveis, 0);
    const contador = (valor: string, rotulo: string, alerta = false) =>
      `<div class="contador${alerta ? ' alerta' : ''}"><div class="contador-valor">${valor}</div><div class="contador-rotulo">${rotulo}</div></div>`;

    return `
  <section class="resultado">
    ${this.gerarMedidor(resultado.aproveitamento, cor)}
    <div>
      <div class="faixa-atual">
        <span class="faixa-selo" style="background:${this.escapeHtml(cor)};">${emoji}${this.escapeHtml(classificacao.nome)}</span>
        ${this.textoTendencia(resultado)}
      </div>
      <div class="faixa-texto">${this.numero(contadores.pontosRealizados)} de ${this.numero(contadores.pontosPossiveis)} pontos possíveis</div>
      <div class="faixa-barra"><div class="faixa-trilho">${barra}</div><div class="faixa-marcador" style="left:${posicaoNaBarra(resultado.aproveitamento).toFixed(2)}%;"></div></div>
      <div class="faixa-escala">${escala}</div>
      ${historico}
    </div>
  </section>
  <section class="contadores">
    ${contador(`${this.numero(contadores.pontosRealizados)}<small> / ${this.numero(contadores.pontosPossiveis)}</small>`, 'Pontos realizados')}
    ${contador(String(contadores.naoConformidades), 'Não conformidades', contadores.naoConformidades > 0)}
    ${contador(String(naoAplicaveis), 'Não aplicáveis')}
    ${contador(String(contadores.fotos), 'Fotos')}
    ${contador(String(contadores.planosAcao), 'Planos de ação')}
  </section>`;
  }

  /**
   * Tabela por grupo com barra de aproveitamento na cor da faixa (linha "Geral" inclusa).
   */
  private gerarDesempenhoPorGrupo(resultado: ResultadoAuditoria, numeroDoGrupo: Map<string, number>): string {
    const { grupos, contadores, faixas } = resultado;
    const soma = (campo: 'naoAplicaveis' | 'naoRespondidas') => grupos.reduce((acc, g) => acc + g[campo], 0);
    const quantidade = (n: number, destaque = false) =>
      n > 0 ? `<span class="${destaque ? 'nc-destaque' : ''}">${n}</span>` : '<span class="zero">0</span>';
    const barra = (ap: number | null) =>
      ap == null
        ? ''
        : `<div class="barra-grupo"><div style="width:${posicaoNaBarra(ap).toFixed(2)}%;background:${this.escapeHtml(this.corDaNota(ap, faixas))};"></div></div>`;
    const linha = (
      nome: string,
      ap: number | null,
      pr: number,
      pp: number,
      na: number,
      nc: number,
      nr: number,
      classe = '',
    ) => `
        <tr${classe ? ` class="${classe}"` : ''}>
          <td class="grupo-nome">${nome}</td>
          <td class="grupo-barra">${barra(ap)}</td>
          <td class="valor-ap">${ap != null ? this.percentual(ap) : '—'}</td>
          <td>${this.numero(pr)} / ${this.numero(pp)}</td>
          <td>${quantidade(na)}</td>
          <td>${quantidade(nc, true)}</td>
          <td>${quantidade(nr)}</td>
        </tr>`;
    const legendaFaixas = [...faixas]
      .sort((a, b) => a.de - b.de)
      .map(
        (f) =>
          `<span class="legenda-item"><span class="legenda-cor" style="background:${this.escapeHtml(f.cor)};"></span>${this.escapeHtml(f.nome)} (${this.numero(f.de)}–${this.numero(f.ate)}%)</span>`,
      )
      .join('');

    return `
  <section class="secao">
    <h2 class="secao-titulo">Desempenho por grupo</h2>
    <table class="tabela-grupos">
      <thead>
        <tr><th>Grupo</th><th></th><th>AP</th><th>Pontos</th><th>NA</th><th>NC</th><th>NR</th></tr>
      </thead>
      <tbody>
        ${grupos
          .map((g) =>
            linha(
              `${this.numeroDoGrupoHtml(numeroDoGrupo.get(g.grupoId))}${this.escapeHtml(g.nome)}`,
              g.aproveitamento,
              g.pontosRealizados,
              g.pontosPossiveis,
              g.naoAplicaveis,
              g.naoConformidades,
              g.naoRespondidas,
            ),
          )
          .join('')}
        ${linha(
          'Geral',
          resultado.aproveitamento,
          contadores.pontosRealizados,
          contadores.pontosPossiveis,
          soma('naoAplicaveis'),
          contadores.naoConformidades,
          soma('naoRespondidas'),
          'total',
        )}
      </tbody>
    </table>
    <div class="legenda">${legendaFaixas}</div>
    <div class="legenda-siglas">AP: Aproveitamento | Pontos: realizados / possíveis | NA: Não aplicáveis | NC: Não conformidades | NR: Não respondidas</div>
  </section>`;
  }

  /**
   * Ícone e classe do item: o sentido da resposta define a cor; o ícone configurado
   * na opção (código do catálogo ou caractere) substitui o padrão do sentido.
   */
  private visualDaResposta(
    item: AuditoriaItem,
    sentido: SentidoResposta | null,
  ): { classe: ClasseResposta; icone: string; iconePersonalizado: boolean } {
    if (!sentido) return { classe: 'nao-respondida', icone: '?', iconePersonalizado: false };
    const configurado = (item.templateItem?.opcoesRespostaConfig || []).find((c) => c.valor === item.resposta)?.icone;
    if (configurado) {
      const icone = ICONES_RESPOSTA.find((i) => i.codigo === configurado)?.emoji ?? configurado;
      return { classe: sentido, icone, iconePersonalizado: true };
    }
    return { classe: sentido, icone: ICONE_PADRAO_POR_SENTIDO[sentido], iconePersonalizado: false };
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

  private gerarFotos(item: AuditoriaItem, assetsPdf: RelatorioAuditoriaPdfAssetsHtml | undefined, classe = ''): string {
    if (!item.fotos?.length) return '';
    const fotos = item.fotos
      .map((foto) => {
        const embutida = assetsPdf?.fotosDataUriPorId?.[foto.id];
        return embutida
          ? `<img class="foto" src="${embutida}" alt="Foto do item" />`
          : `<img class="foto" data-foto-id="${this.escapeHtml(foto.id)}" alt="Foto do item" />`;
      })
      .join('');
    return `<div class="fotos${classe ? ` ${classe}` : ''}">${fotos}</div>`;
  }

  /**
   * Lista das não conformidades com tudo o que o cliente precisa para corrigir:
   * justificativa, observação, legislação, análise e fotos.
   */
  private gerarNaoConformidades(
    grupos: GrupoDoRelatorio[],
    assetsPdf?: RelatorioAuditoriaPdfAssetsHtml,
  ): string {
    const naoConformes = grupos.flatMap((g) =>
      g.itens.filter((i) => i.classe === 'negativa').map((i) => ({ grupo: `Grupo ${g.numero} · ${g.nome}`, ...i })),
    );
    const corpo = naoConformes.length
      ? naoConformes
          .map(({ grupo, item, numero, respostaTexto }) => {
            const legislacao = nomesLegislacoesDoItem(item);
            const detalhe = (rotulo: string, valor: string | null | undefined) =>
              valor ? `<div class="detalhe-rotulo">${rotulo}</div><div>${this.escapeHtml(valor)}</div>` : '';
            return `
    <div class="nc-card">
      <div class="nc-grupo">${this.escapeHtml(grupo)}</div>
      <div class="nc-pergunta"><span class="numero">${numero}</span>${this.escapeHtml(item.templateItem?.pergunta || 'Pergunta não encontrada')}</div>
      <div class="detalhes">
        <div class="detalhe-rotulo">Resposta</div><div>${respostaTexto}</div>
        ${detalhe('Justificativa', item.descricaoNaoConformidade)}
        ${detalhe('Observação', item.observacao)}
        ${detalhe('Legislação', legislacao)}
        ${detalhe('Análise', item.descricaoIa)}
      </div>
      ${this.gerarFotos(item, assetsPdf)}
    </div>`;
          })
          .join('')
      : '<div class="sem-nc">Nenhuma não conformidade encontrada nesta avaliação.</div>';

    return `
  <section class="secao">
    <h2 class="secao-titulo">Não conformidades${naoConformes.length ? ` <small>${naoConformes.length} ${naoConformes.length === 1 ? 'item' : 'itens'}</small>` : ''}</h2>
    ${corpo}
  </section>`;
  }

  /**
   * Todas as respostas, grupo a grupo, em lista compacta.
   */
  private gerarRespostasPorGrupo(
    grupos: GrupoDoRelatorio[],
    faixas: FaixaClassificacao[],
    assetsPdf?: RelatorioAuditoriaPdfAssetsHtml,
  ): string {
    const html = grupos
      .map(({ numero: numeroGrupo, nome, metricas, itens }) => {
        const ap = metricas?.aproveitamento;
        const selo =
          ap != null
            ? `<span class="grupo-ap" style="background:${this.escapeHtml(this.corDaNota(ap, faixas))};">${this.percentual(ap)}</span>`
            : '';
        const linhas = itens
          .map(({ item, numero, classe, icone, iconePersonalizado, respostaTexto, assinatura }) => {
            const negativa = classe === 'negativa';
            const iconeHtml = iconePersonalizado ? `<span class="emoji">${this.escapeHtml(icone)}</span>` : this.escapeHtml(icone);
            return `
      <div class="item ${classe}">
        <span class="item-icone ${classe}${iconePersonalizado ? ' personalizado' : ''}">${iconeHtml}</span>
        <div>
          <div class="item-pergunta"><span class="numero">${numero}</span>${this.escapeHtml(item.templateItem?.pergunta || 'Pergunta não encontrada')}</div>
          ${assinatura ? `<img class="assinatura-imagem" src="${assinatura}" alt="Assinatura" />` : ''}
          ${!negativa && item.observacao ? `<div class="item-obs">Observação: ${this.escapeHtml(item.observacao)}</div>` : ''}
          ${!negativa ? this.gerarFotos(item, assetsPdf, 'pequenas') : ''}
        </div>
        <span class="item-resposta ${classe}">${respostaTexto}</span>
      </div>`;
          })
          .join('');
        return `
    <div class="grupo">
      <div class="grupo-cabecalho">
        <h3 class="grupo-titulo">${this.numeroDoGrupoHtml(numeroGrupo)}${this.escapeHtml(nome)}</h3>
        <div class="grupo-metricas">Pontos ${this.numero(metricas?.pontosRealizados ?? 0)} / ${this.numero(metricas?.pontosPossiveis ?? 0)}${selo}</div>
      </div>
      ${linhas}
    </div>`;
      })
      .join('');

    return `
  <section class="secao">
    <h2 class="secao-titulo">Respostas por grupo</h2>
    ${html}
  </section>`;
  }

  /**
   * Fechamento: dados principais da avaliação e linhas para assinatura.
   */
  private gerarFechamento(auditoria: Auditoria, resultado: ResultadoAuditoria): string {
    const auditor = auditoria.consultor?.nome || 'Auditor';
    const responsavel = auditoria.unidade?.responsavel || 'Responsável pela unidade';
    return `
  <section class="fechamento">
    <h2 class="secao-titulo">Assinaturas</h2>
    <div class="fechamento-resumo">
      ${this.dado('Unidade', this.escapeHtml(auditoria.unidade?.nome || 'Unidade'))}
      ${this.dado('Fim da avaliação', this.formatarDataHora(auditoria.dataFim))}
      ${this.dado('Aproveitamento', this.percentual(resultado.aproveitamento))}
      ${this.dado('Faixa', this.escapeHtml(resultado.classificacao.nome))}
    </div>
    <p class="data-local">____________________, ____ de ______________ de ________</p>
    <div class="assinaturas">
      <div class="assinatura">${this.escapeHtml(auditor)}<div class="assinatura-papel">Auditor</div></div>
      <div class="assinatura">${this.escapeHtml(responsavel)}<div class="assinatura-papel">Responsável pela unidade</div></div>
    </div>
  </section>`;
  }

  /**
   * Análise da avaliação gerada pela IA (resumo executivo).
   */
  private gerarResumoExecutivo(resumo: Auditoria['resumoExecutivo']): string {
    if (!resumo) {
      return '';
    }
    const lista = (itens: string[] | undefined, marca: string, cor: string) =>
      `<ul class="analise-lista">${(itens ?? [])
        .map((t) => `<li><span class="marca" style="color:${cor};">${marca}</span><span>${this.escapeHtml(t)}</span></li>`)
        .join('')}</ul>`;

    return `
  <section class="secao">
    <h2 class="secao-titulo">Análise da avaliação</h2>
    <div class="analise">
      <div class="analise-texto">${this.escapeHtml(resumo.resumo || '')}</div>
      <div class="analise-colunas">
        <div><div class="analise-subtitulo" style="color:#047857;">Pontos fortes</div>${lista(resumo.pontosFortes, '✓', '#10B981')}</div>
        <div><div class="analise-subtitulo" style="color:#DC2626;">Pontos fracos</div>${lista(resumo.pontosFracos, '✗', '#DC2626')}</div>
      </div>
      ${resumo.recomendacoesPrioritarias?.length
        ? `<div class="analise-subtitulo">Recomendações prioritárias</div>${resumo.recomendacoesPrioritarias
            .map((rec, idx) => `<div class="recomendacao"><b>${idx + 1}.</b><span>${this.escapeHtml(rec)}</span></div>`)
            .join('')}`
        : ''}
      <div class="analise-colunas" style="margin-top:10px;margin-bottom:0;">
        <div><div class="analise-subtitulo">Risco geral</div><span class="risco risco-${this.escapeHtml(resumo.riscoGeral)}">${this.getRiscoLabel(resumo.riscoGeral)}</span></div>
        <div><div class="analise-subtitulo">Tendências identificadas</div>${lista(resumo.tendencias, '→', '#00B8A9')}</div>
      </div>
    </div>
  </section>`;
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
        return this.escapeHtml(risco);
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

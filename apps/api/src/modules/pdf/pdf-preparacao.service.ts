import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { Auditoria } from '../auditoria/entities/auditoria.entity';
import { RelatorioTecnico } from '../relatorio-tecnico/entities/relatorio-tecnico.entity';

export interface PreparoRelatorioTecnicoPdf {
  readonly logoChekAiDataUri: string;
  readonly logoClienteDataUri: string | null;
  readonly fotosPorId: Record<string, string>;
}

export interface PreparoAuditoriaPdf {
  readonly logoChekAiDataUri: string;
  readonly logoConsultoriaDataUri: string | null;
  readonly logoClienteDataUri: string | null;
  readonly fotosPorId: Record<string, string>;
}

const LOGO_TRANSPARENTE_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const URL_LOGO_CHEKAI_PADRAO = 'https://chekai.com.br/images/logo-large.png';
const TIMEOUT_FETCH_MS = 15_000;

/**
 * Busca imagens, normaliza com sharp e monta templates de header/footer para PDF via Puppeteer.
 */
@Injectable()
export class PdfPreparacaoService {
  private readonly logger = new Logger(PdfPreparacaoService.name);

  private logoChekAiCache: string | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Monta o HTML do cabeçalho repetido em cada página: ChekAI à esquerda, cliente (e consultoria na auditoria) à direita.
   */
  montarHeaderTemplateHtml(opcoes: {
    readonly logoChekAiDataUri: string;
    readonly logoClienteDataUri: string | null;
    readonly logoConsultoriaDataUri?: string | null;
  }): string {
    const { logoChekAiDataUri, logoClienteDataUri, logoConsultoriaDataUri } = opcoes;
    const blocoDireito = `
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px;max-width:55%;">
        ${logoConsultoriaDataUri
          ? `<img src="${logoConsultoriaDataUri}" style="height:28px;max-width:140px;object-fit:contain;" alt="" />`
          : ''}
        ${logoClienteDataUri
          ? `<img src="${logoClienteDataUri}" style="height:28px;max-width:140px;object-fit:contain;" alt="" />`
          : '<span style="color:#9ca3af;font-size:10px;font-weight:700;">Cliente</span>'}
      </div>`;
    return `
      <div style="width:100%;-webkit-print-color-adjust:exact;padding:4px 10px 8px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #E5E9F0;box-sizing:border-box;">
        <div style="flex-shrink:0;"><img src="${logoChekAiDataUri}" style="height:28px;max-width:120px;object-fit:contain;" alt="ChekAI" /></div>
        ${blocoDireito}
      </div>`;
  }

  /**
   * Monta o rodapé com identificação ChekAI e numeração de páginas.
   */
  montarFooterTemplateHtml(opcoes: { readonly referenciaId: string }): string {
    const ref = opcoes.referenciaId.replace(/-/g, '').slice(0, 12);
    return `
      <div style="width:100%;text-align:center;font-size:8px;color:#6b7280;padding:4px 8px;box-sizing:border-box;">
        Documento gerado no ChekAI · <span class="pageNumber"></span> / <span class="totalPages"></span>
        · ${this.escapeHtmlTemplate(ref)}
      </div>`;
  }

  /**
   * Cabeçalho do relatório de auditoria: a consultoria assina o documento (logo à esquerda)
   * e o cliente aparece à direita. Sem logo da consultoria, usa a do ChekAI.
   */
  montarHeaderAuditoriaHtml(opcoes: {
    readonly logoChekAiDataUri: string;
    readonly logoConsultoriaDataUri: string | null;
    readonly logoClienteDataUri: string | null;
    readonly nomeCliente: string;
  }): string {
    const logoEsquerda = opcoes.logoConsultoriaDataUri || opcoes.logoChekAiDataUri;
    const cliente = opcoes.logoClienteDataUri
      ? `<img src="${opcoes.logoClienteDataUri}" style="height:34px;max-width:150px;object-fit:contain;" alt="" />`
      : `<span style="font-size:10px;font-weight:700;color:#1B2A4A;">${this.escapeHtmlTemplate(opcoes.nomeCliente)}</span>`;
    return `
      <div style="width:100%;-webkit-print-color-adjust:exact;padding:0 12mm 6px;box-sizing:border-box;font-family:'Inter',Arial,sans-serif;">
        <div style="display:flex;justify-content:space-between;align-items:center;height:38px;border-bottom:1.5px solid #00B8A9;padding-bottom:6px;">
          <img src="${logoEsquerda}" style="height:34px;max-width:170px;object-fit:contain;" alt="" />
          ${cliente}
        </div>
      </div>`;
  }

  /**
   * Rodapé do relatório de auditoria: ChekAI discreto, código do documento e página.
   */
  montarFooterAuditoriaHtml(opcoes: { readonly logoChekAiDataUri: string; readonly referenciaId: string }): string {
    const ref = opcoes.referenciaId.replace(/-/g, '').slice(0, 8).toUpperCase();
    return `
      <div style="width:100%;padding:0 12mm;box-sizing:border-box;font-family:'Inter',Arial,sans-serif;font-size:7.5px;color:#8A97AB;">
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #E5E9F0;padding-top:5px;">
          <span style="display:flex;align-items:center;gap:4px;">Gerado com <img src="${opcoes.logoChekAiDataUri}" style="height:11px;object-fit:contain;" alt="ChekAI" /></span>
          <span>Código ${this.escapeHtmlTemplate(ref)}</span>
          <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
        </div>
      </div>`;
  }

  async prepararRelatorioTecnico(relatorio: RelatorioTecnico): Promise<PreparoRelatorioTecnicoPdf> {
    const logoChekAiDataUri = await this.obterLogoChekAiDataUri();
    const logoClienteUrl = relatorio.cliente?.logoUrl ?? null;
    const logoClienteDataUri = logoClienteUrl
      ? await this.logoUrlParaDataUriPng(logoClienteUrl).catch(() => null)
      : null;
    const fotosPorId: Record<string, string> = {};
    const lista = relatorio.fotos || [];
    for (let i = 0; i < lista.length; i += 1) {
      const foto = lista[i];
      if (!foto.url) {
        continue;
      }
      if (foto.url.startsWith('data:')) {
        fotosPorId[foto.id] = await this.normalizarDataUriImagem(foto.url, 420).catch(() => foto.url);
        continue;
      }
      try {
        fotosPorId[foto.id] = await this.imagemUrlParaDataUriJpeg(foto.url, 420);
      } catch (err) {
        this.logger.warn(`Foto técnica ${foto.id}: falha ao embutir (${foto.url?.slice(0, 80)}…)`, err);
      }
    }
    return {
      logoChekAiDataUri,
      logoClienteDataUri,
      fotosPorId,
    };
  }

  async prepararAuditoria(auditoria: Auditoria): Promise<PreparoAuditoriaPdf> {
    const logoChekAiDataUri = await this.obterLogoChekAiDataUri();
    const gestor = auditoria.unidade?.cliente?.gestor as { logoUrl?: string | null } | undefined;
    const logoConsultoriaUrl = gestor?.logoUrl || null;
    const logoClienteUrl = (auditoria.unidade?.cliente as { logoUrl?: string | null })?.logoUrl || null;
    const [logoConsultoriaDataUri, logoClienteDataUri] = await Promise.all([
      logoConsultoriaUrl ? this.logoUrlParaDataUriPng(logoConsultoriaUrl).catch(() => null) : Promise.resolve(null),
      logoClienteUrl ? this.logoUrlParaDataUriPng(logoClienteUrl).catch(() => null) : Promise.resolve(null),
    ]);
    const fotosPorId: Record<string, string> = {};
    const fotos: { id: string; url: string }[] = [];
    auditoria.itens?.forEach((item) => {
      item.fotos?.forEach((foto) => {
        if (foto.id && foto.url) {
          fotos.push({ id: foto.id, url: foto.url });
        }
      });
    });
    for (let i = 0; i < fotos.length; i += 1) {
      const { id, url } = fotos[i];
      try {
        fotosPorId[id] = await this.imagemUrlParaDataUriJpeg(url, 400);
      } catch (err) {
        this.logger.warn(`Foto auditoria ${id}: falha ao embutir`, err);
      }
    }
    return {
      logoChekAiDataUri,
      logoConsultoriaDataUri,
      logoClienteDataUri,
      fotosPorId,
    };
  }

  private escapeHtmlTemplate(texto: string): string {
    return texto
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private async obterLogoChekAiDataUri(): Promise<string> {
    if (this.logoChekAiCache) {
      return this.logoChekAiCache;
    }
    const urlEnv = this.configService.get<string>('CHEKAI_LOGO_URL')?.trim();
    const url = urlEnv || URL_LOGO_CHEKAI_PADRAO;
    let out: Buffer;
    try {
      const buf = await this.fetchBuffer(url);
      out = await sharp(buf).resize(400, 400, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
    } catch (err) {
      // A logo é decorativa: sem ela o PDF ainda deve ser gerado (e não fica em cache para tentar de novo)
      this.logger.warn(`Logo ChekAI indisponível (${url}): ${err instanceof Error ? err.message : String(err)}`);
      return LOGO_TRANSPARENTE_DATA_URI;
    }
    this.logoChekAiCache = `data:image/png;base64,${out.toString('base64')}`;
    return this.logoChekAiCache;
  }

  private async fetchBuffer(url: string): Promise<Buffer> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_FETCH_MS);
    try {
      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return Buffer.from(await res.arrayBuffer());
    } finally {
      clearTimeout(timer);
    }
  }

  /** Logos ficam em PNG para manter a transparência (em JPEG o fundo transparente vira preto). */
  private async logoUrlParaDataUriPng(url: string): Promise<string> {
    const buf = await this.fetchBuffer(url);
    const out = await sharp(buf)
      .resize(480, 160, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return `data:image/png;base64,${out.toString('base64')}`;
  }

  private async imagemUrlParaDataUriJpeg(url: string, maxLado: number): Promise<string> {
    const buf = await this.fetchBuffer(url);
    const out = await sharp(buf)
      .resize(maxLado, maxLado, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  }

  private async normalizarDataUriImagem(dataUri: string, maxLado: number): Promise<string> {
    const m = /^data:image\/(\w+);base64,(.+)$/i.exec(dataUri);
    if (!m) {
      return dataUri;
    }
    const buf = Buffer.from(m[2], 'base64');
    const out = await sharp(buf)
      .resize(maxLado, maxLado, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 78 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString('base64')}`;
  }
}

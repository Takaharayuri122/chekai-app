import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { PdfPreparacaoService } from '../../pdf/pdf-preparacao.service';
import { registrarMetricaGeracaoPdf } from '../../pdf/pdf-geracao-metricas.util';
import { SupabaseService } from '../../supabase/supabase.service';
import { RelatorioTecnico } from '../entities/relatorio-tecnico.entity';
import { RelatorioTecnicoHtmlService } from './relatorio-tecnico-html.service';

@Injectable()
export class RelatorioTecnicoPdfPuppeteerService {
  private readonly logger = new Logger(RelatorioTecnicoPdfPuppeteerService.name);
  private browser: Browser | null = null;
  private readonly bucketName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly relatorioTecnicoHtmlService: RelatorioTecnicoHtmlService,
    private readonly pdfPreparacao: PdfPreparacaoService,
  ) {
    this.bucketName =
      this.configService.get<string>('SUPABASE_STORAGE_BUCKET_RELATORIOS') ||
      'relatorios';
  }

  async gerarPdf(relatorio: RelatorioTecnico): Promise<Buffer> {
    const metricas = this.configService.get<string>('PDF_GERACAO_METRICAS') === 'true';
    const t0 = process.hrtime.bigint();
    let browser: Browser;
    try {
      browser = await this.getBrowser();
    } catch (err) {
      this.logger.error('Falha ao iniciar browser Puppeteer', err);
      this.browser = null;
      throw err;
    }
    let page: Page | null = null;
    try {
      page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 800 });
      const preparo = await this.pdfPreparacao.prepararRelatorioTecnico(relatorio);
      const html = this.relatorioTecnicoHtmlService.gerarHtml(relatorio, {
        fotosPorId: preparo.fotosPorId,
      });
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
      const fotosLegadasSemEmbutir = (relatorio.fotos || []).filter(
        (f) => f.url?.startsWith('data:') && !preparo.fotosPorId[f.id],
      );
      if (fotosLegadasSemEmbutir.length > 0) {
        const fotosMap = fotosLegadasSemEmbutir.map((f) => ({ id: f.id, url: f.url! }));
        await page.evaluate((lista: Array<{ id: string; url: string }>) => {
          for (const item of lista) {
            const img = document.querySelector<HTMLImageElement>(`img[data-foto-id="${item.id}"]`);
            if (img) {
              img.src = item.url;
            }
          }
        }, fotosMap);
      }
      await page.evaluate(() =>
        Promise.all(
          Array.from(document.images)
            .filter((img) => img.src && !img.complete)
            .map((img) => new Promise((r) => { img.onload = r; img.onerror = r; })),
        ),
      );
      await page.evaluateHandle('document.fonts.ready');
      const headerTemplate = this.pdfPreparacao.montarHeaderTemplateHtml({
        logoChekAiDataUri: preparo.logoChekAiDataUri,
        logoClienteDataUri: preparo.logoClienteDataUri,
      });
      const footerTemplate = this.pdfPreparacao.montarFooterTemplateHtml({
        referenciaId: relatorio.id,
      });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        margin: { top: '18mm', right: '6mm', bottom: '16mm', left: '6mm' },
      });
      const buf = Buffer.from(pdf);
      registrarMetricaGeracaoPdf(
        this.logger,
        metricas,
        t0,
        `relatório-técnico ${relatorio.id}`,
        buf.length,
      );
      return buf;
    } catch (err) {
      this.logger.error('Erro ao gerar PDF do relatório técnico', err);
      await this.fecharBrowser();
      throw err;
    } finally {
      if (page) {
        await page.close().catch(() => undefined);
      }
    }
  }

  private async fecharBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
  }

  async salvarPdfNoStorage(relatorioId: string, pdfBuffer: Buffer): Promise<string> {
    const supabase = this.supabaseService.getClient();
    await this.garantirBucketExiste();
    const filePath = `relatorios-tecnicos/${relatorioId}/relatorio-${Date.now()}.pdf`;
    const { error } = await supabase.storage
      .from(this.bucketName)
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: false });
    if (error) {
      throw error;
    }
    const { data } = supabase.storage.from(this.bucketName).getPublicUrl(filePath);
    return data.publicUrl;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
    }
    const executablePath = this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH');
    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless: true,
      protocolTimeout: 180_000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
      ],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }
    this.browser = await puppeteer.launch(launchOptions);
    return this.browser;
  }

  private async garantirBucketExiste(): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      throw new Error('Não foi possível verificar buckets do storage');
    }
    const bucketExiste = buckets?.some((bucket) => bucket.name === this.bucketName);
    if (bucketExiste) {
      return;
    }
    this.logger.log(`Bucket "${this.bucketName}" não encontrado. Tentando criar...`);
    const { error: createError } = await supabase.storage.createBucket(this.bucketName, {
      public: true,
      fileSizeLimit: 100 * 1024 * 1024,
      allowedMimeTypes: ['application/pdf'],
    });
    if (createError) {
      throw new Error(
        `Bucket "${this.bucketName}" não existe e não foi possível criá-lo automaticamente.`,
      );
    }
  }

}

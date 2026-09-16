import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { Browser } from 'puppeteer';
import { registrarMetricaGeracaoPdf } from '../pdf/pdf-geracao-metricas.util';
import { RelatorioHorasCheckin } from './checkin.service';
import { montarHtmlRelatorioHoras } from './checkin-relatorio-html';

@Injectable()
export class CheckinRelatorioPdfService {
  private readonly logger = new Logger(CheckinRelatorioPdfService.name);
  private browser: Browser | null = null;

  constructor(private readonly configService: ConfigService) {}

  async gerarPdf(relatorio: RelatorioHorasCheckin): Promise<Buffer> {
    const inicioHr = process.hrtime.bigint();
    const metricas = this.configService.get<string>('PDF_GERACAO_METRICAS') === 'true';
    const html = montarHtmlRelatorioHoras(relatorio);
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '16mm', right: '12mm', bottom: '16mm', left: '12mm' },
      });
      const buffer = Buffer.from(pdf);
      registrarMetricaGeracaoPdf(
        this.logger,
        metricas,
        inicioHr,
        'checkin-relatorio-horas',
        buffer.length,
      );
      return buffer;
    } finally {
      await page.close();
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        this.browser = null;
      }
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
      ],
    };
    if (executablePath) {
      launchOptions.executablePath = executablePath;
    }
    this.browser = await puppeteer.launch(launchOptions);
    return this.browser;
  }
}

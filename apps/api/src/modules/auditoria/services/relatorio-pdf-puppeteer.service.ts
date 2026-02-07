import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import puppeteer, { Browser, Page } from 'puppeteer';
import { SupabaseService } from '../../supabase/supabase.service';
import { Auditoria } from '../entities/auditoria.entity';
import { RelatorioHtmlService } from './relatorio-html.service';

/**
 * Serviço responsável pela geração de PDF do relatório de auditoria usando Puppeteer.
 */
@Injectable()
export class RelatorioPdfPuppeteerService {
  private readonly logger = new Logger(RelatorioPdfPuppeteerService.name);
  private browser: Browser | null = null;
  private readonly bucketName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly relatorioHtmlService: RelatorioHtmlService,
  ) {
    this.bucketName =
      this.configService.get<string>('SUPABASE_STORAGE_BUCKET_RELATORIOS') ||
      'relatorios';
  }

  /**
   * Inicializa o navegador Puppeteer (reutilizável para performance).
   * Se a conexão estiver fechada, descarta a instância e cria uma nova.
   */
  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // ignora erro ao fechar
      }
      this.browser = null;
    }
    const executablePath = this.configService.get<string>('PUPPETEER_EXECUTABLE_PATH');
    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless: true,
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

  private resetBrowser(): void {
    if (this.browser) {
      this.browser = null;
    }
  }

  /**
   * Gera o PDF do relatório de auditoria a partir do HTML gerado.
   * @param historico - Lista de auditorias finalizadas da mesma unidade (para seção de evolução no PDF)
   */
  async gerarPdf(auditoria: Auditoria, historico?: Auditoria[]): Promise<Buffer> {
    return this.executarGeracaoPdf(auditoria, historico, false);
  }

  private async executarGeracaoPdf(
    auditoria: Auditoria,
    historico: Auditoria[] | undefined,
    jaTentouRecuperar: boolean,
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    let page: Page | null = null;

    try {
      page = await browser.newPage();
      
      // Configurar viewport e encoding
      await page.setViewport({
        width: 1200,
        height: 800,
      });
      
      this.logger.log(`Gerando HTML do relatório para auditoria ${auditoria.id}`);
      const html = this.relatorioHtmlService.gerarHtml(auditoria, historico);
      
      // Validar que o HTML foi gerado
      if (!html || html.length === 0) {
        throw new Error('HTML gerado está vazio');
      }
      
      this.logger.log(`Convertendo HTML para PDF para auditoria ${auditoria.id} (HTML: ${html.length} caracteres)`);
      
      await page.setContent(html, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      const fotos: { id: string; url: string }[] = [];
      auditoria.itens?.forEach((item) => {
        item.fotos?.forEach((foto) => {
          if (foto.id && foto.url) {
            fotos.push({ id: foto.id, url: foto.url });
          }
        });
      });
      for (const { id, url } of fotos) {
        await page.evaluate(
          (fotoId: string, fotoUrl: string) => {
            const img = Array.from(document.querySelectorAll<HTMLImageElement>('img[data-foto-id]'))
              .find((el) => el.getAttribute('data-foto-id') === fotoId);
            if (img) {
              img.src = fotoUrl;
            }
          },
          id,
          url,
        );
      }
      if (fotos.length > 0) {
        await page.evaluate(() => Promise.all(
          Array.from(document.images)
            .filter((img) => img.dataset.fotoId)
            .map((img) => (img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; }))),
        ));
        await page.evaluate(() => {
          const maxSize = 200;
          document.querySelectorAll<HTMLImageElement>('img[data-foto-id]').forEach((img) => {
            if (!img.complete || !img.naturalWidth) return;
            const w = img.naturalWidth;
            const h = img.naturalHeight;
            let cw = w;
            let ch = h;
            if (w > maxSize || h > maxSize) {
              if (w > h) {
                cw = maxSize;
                ch = Math.round((h * maxSize) / w);
              } else {
                ch = maxSize;
                cw = Math.round((w * maxSize) / h);
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(img, 0, 0, cw, ch);
            try {
              const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
              if (dataUrl && dataUrl.length > 0) {
                img.src = dataUrl;
              }
            } catch {
              // mantém src original se canvas falhar
            }
          });
        });
        await new Promise((r) => setTimeout(r, 200));
      }

      await page.evaluateHandle('document.fonts.ready');

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        margin: {
          top: '5mm',
          right: '5mm',
          bottom: '5mm',
          left: '5mm',
        },
      });

      this.logger.log(`PDF gerado com sucesso para auditoria ${auditoria.id} (${pdfBuffer.length} bytes)`);
      
      // Garantir que o buffer está correto
      if (!pdfBuffer || pdfBuffer.length === 0) {
        throw new Error('PDF gerado está vazio');
      }
      
      return Buffer.from(pdfBuffer);
    } catch (error: unknown) {
      const isConnectionClosed =
        error instanceof Error &&
        (error.name === 'ConnectionClosedError' || error.message?.includes('Connection closed'));
      if (isConnectionClosed && !jaTentouRecuperar) {
        this.logger.warn(`Conexão do browser fechada. Reiniciando e tentando novamente para auditoria ${auditoria.id}`);
        this.resetBrowser();
        if (page) {
          try {
            await page.close();
          } catch {
            // ignora
          }
        }
        return this.executarGeracaoPdf(auditoria, historico, true);
      }
      this.logger.error(`Erro ao gerar PDF para auditoria ${auditoria.id}:`, error);
      throw error;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch {
          // ignora erro ao fechar página
        }
      }
    }
  }

  /**
   * Verifica se o bucket existe e cria se necessário.
   */
  private async garantirBucketExiste(): Promise<void> {
    const supabase = this.supabaseService.getClient();
    
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      this.logger.error('Erro ao listar buckets:', listError);
      throw new Error('Não foi possível verificar buckets do storage');
    }

    const bucketExiste = buckets?.some((bucket) => bucket.name === this.bucketName);
    
    if (!bucketExiste) {
      this.logger.log(`Bucket "${this.bucketName}" não encontrado. Tentando criar...`);
      
      const { data: newBucket, error: createError } = await supabase.storage.createBucket(
        this.bucketName,
        {
          public: true,
          fileSizeLimit: 100 * 1024 * 1024, // 100MB
          allowedMimeTypes: ['application/pdf'],
        },
      );

      if (createError) {
        this.logger.error(`Erro ao criar bucket "${this.bucketName}":`, createError);
        throw new Error(
          `Bucket "${this.bucketName}" não existe e não foi possível criá-lo automaticamente. ` +
          'Por favor, crie o bucket manualmente no Supabase Dashboard.',
        );
      }

      this.logger.log(`Bucket "${this.bucketName}" criado com sucesso`);
    }
  }

  /**
   * Salva o PDF no Supabase Storage e retorna a URL pública.
   */
  async salvarPdfNoStorage(
    auditoriaId: string,
    pdfBuffer: Buffer,
  ): Promise<string> {
    const supabase = this.supabaseService.getClient();
    
    await this.garantirBucketExiste();
    
    const fileName = `relatorio-${auditoriaId}-${Date.now()}.pdf`;
    const filePath = `auditorias/${auditoriaId}/${fileName}`;

    this.logger.log(`Salvando PDF no storage: ${filePath}`);

    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      this.logger.error(`Erro ao salvar PDF no storage:`, error);
      throw error;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(this.bucketName).getPublicUrl(filePath);

    this.logger.log(`PDF salvo com sucesso. URL: ${publicUrl}`);
    return publicUrl;
  }

  /**
   * Verifica se já existe um PDF no storage para a auditoria.
   */
  async verificarPdfExistente(auditoriaId: string): Promise<string | null> {
    const supabase = this.supabaseService.getClient();

    try {
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .list(`auditorias/${auditoriaId}`, {
          limit: 1,
          sortBy: { column: 'created_at', order: 'desc' },
        });

      if (error) {
        if (error.message?.includes('Bucket not found')) {
          this.logger.warn(`Bucket "${this.bucketName}" não encontrado ao verificar PDF existente`);
          return null;
        }
        this.logger.warn('Erro ao verificar PDF existente:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const arquivo = data[0];
      const filePath = `auditorias/${auditoriaId}/${arquivo.name}`;

      const {
        data: { publicUrl },
      } = supabase.storage.from(this.bucketName).getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      this.logger.warn('Erro ao verificar PDF existente:', error);
      return null;
    }
  }

  /**
   * Limpa PDFs antigos (mais de 30 dias) do storage.
   */
  async limparPdfsAntigos(): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    try {
      const { data: pastas, error: errorPastas } = await supabase.storage
        .from(this.bucketName)
        .list('auditorias', {
          limit: 1000,
        });

      if (errorPastas || !pastas) {
        this.logger.warn('Erro ao listar pastas de auditorias:', errorPastas);
        return;
      }

      for (const pasta of pastas) {
        const { data: arquivos, error: errorArquivos } = await supabase.storage
          .from(this.bucketName)
          .list(`auditorias/${pasta.name}`, {
            limit: 1000,
          });

        if (errorArquivos || !arquivos) {
          continue;
        }

        for (const arquivo of arquivos) {
          const dataCriacao = new Date(arquivo.created_at);
          if (dataCriacao < trintaDiasAtras) {
            const filePath = `auditorias/${pasta.name}/${arquivo.name}`;
            await supabase.storage.from(this.bucketName).remove([filePath]);
            this.logger.log(`PDF antigo removido: ${filePath}`);
          }
        }
      }
    } catch (error) {
      this.logger.error('Erro ao limpar PDFs antigos:', error);
    }
  }

  /**
   * Fecha o navegador quando o serviço é destruído.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

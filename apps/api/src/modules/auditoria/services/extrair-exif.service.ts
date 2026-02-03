import { Injectable, Logger } from '@nestjs/common';
import { parse as exifrParse } from 'exifr';

/**
 * Serviço para extração de metadados EXIF de imagens (para auditoria futura).
 */
@Injectable()
export class ExtrairExifService {
  private readonly logger = new Logger(ExtrairExifService.name);

  /**
   * Extrai EXIF do buffer da imagem. Retorna null se não houver EXIF ou em caso de erro.
   */
  async extrair(buffer: Buffer): Promise<Record<string, unknown> | null> {
    try {
      const exif = await exifrParse(buffer, true);
      if (!exif || typeof exif !== 'object') {
        return null;
      }
      const sanitizado = this.sanitizarParaJson(exif);
      if (Object.keys(sanitizado).length === 0) {
        return null;
      }
      return sanitizado;
    } catch (error) {
      this.logger.debug('EXIF não encontrado ou erro ao extrair:', error);
      return null;
    }
  }

  private sanitizarParaJson(obj: unknown): Record<string, unknown> {
    if (obj === null || typeof obj !== 'object') {
      return {};
    }
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        out[key] = value;
      } else if (Array.isArray(value)) {
        out[key] = value.map((v) => (typeof v === 'object' && v !== null ? this.sanitizarParaJson(v) : v));
      } else if (typeof value === 'object' && (value as object).constructor?.name === 'Date') {
        out[key] = (value as Date).toISOString();
      } else if (typeof value === 'object') {
        out[key] = this.sanitizarParaJson(value);
      }
    }
    return out;
  }
}

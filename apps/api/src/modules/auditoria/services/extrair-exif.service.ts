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
      if (value instanceof Buffer || value instanceof Uint8Array) continue;
      if (typeof value === 'string') {
        out[key] = this.sanitizarString(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        out[key] = value;
      } else if (Array.isArray(value)) {
        out[key] = value
          .filter((v) => !(v instanceof Buffer || v instanceof Uint8Array))
          .map((v) => {
            if (typeof v === 'string') return this.sanitizarString(v);
            if (typeof v === 'object' && v !== null) return this.sanitizarParaJson(v);
            return v;
          });
      } else if (typeof value === 'object' && (value as object).constructor?.name === 'Date') {
        out[key] = (value as Date).toISOString();
      } else if (typeof value === 'object') {
        out[key] = this.sanitizarParaJson(value);
      }
    }
    return out;
  }

  /**
   * Remove null bytes e caracteres de controle que o PostgreSQL não suporta em text/jsonb.
   */
  private sanitizarString(valor: string): string {
    return valor.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }
}

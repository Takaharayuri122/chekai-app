import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

const LADO_MAXIMO_PX = 1920;
const QUALIDADE_JPEG = 85;

export interface ResultadoCompressao {
  buffer: Buffer;
  mimeType: string;
  largura: number;
  altura: number;
}

/**
 * Serviço de compressão de imagens para upload de fotos da auditoria.
 * Redimensiona e comprime ao máximo sem perder resolução útil (até 1920px, JPEG 85).
 */
@Injectable()
export class ComprimirImagemService {
  private readonly logger = new Logger(ComprimirImagemService.name);

  /**
   * Comprime a imagem: redimensiona se passar do lado máximo e reencoda em JPEG.
   * Mantém proporção e usa qualidade alta para não perder resolução visível.
   */
  async comprimir(buffer: Buffer, mimeTypeEntrada: string): Promise<ResultadoCompressao> {
    const formatoEntrada = this.normalizarMimeType(mimeTypeEntrada);
    try {
      let pipeline = sharp(buffer);
      const metadata = await pipeline.metadata();
      const largura = metadata.width ?? 0;
      const altura = metadata.height ?? 0;
      if (largura === 0 || altura === 0) {
        throw new Error('Dimensões da imagem não puderam ser lidas');
      }
      const precisaRedimensionar =
        largura > LADO_MAXIMO_PX || altura > LADO_MAXIMO_PX;
      if (precisaRedimensionar) {
        pipeline = pipeline.resize(LADO_MAXIMO_PX, LADO_MAXIMO_PX, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
      const { data, info } = await pipeline
        .jpeg({ quality: QUALIDADE_JPEG, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      this.logger.log(
        `Imagem comprimida: ${largura}x${altura} -> ${info.width}x${info.height}, ${buffer.length} -> ${data.length} bytes`,
      );
      return {
        buffer: data,
        mimeType: 'image/jpeg',
        largura: info.width,
        altura: info.height,
      };
    } catch (error) {
      this.logger.warn(`Falha ao comprimir imagem (${formatoEntrada}):`, error);
      throw error;
    }
  }

  private normalizarMimeType(mime: string): string {
    if (!mime) return 'image/jpeg';
    const lower = mime.toLowerCase();
    if (lower.startsWith('image/')) return lower;
    return 'image/jpeg';
  }
}

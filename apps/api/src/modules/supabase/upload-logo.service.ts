import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';

const BUCKET_ASSETS = 'assets';
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MIME_IMAGES = /^image\/(jpeg|png|webp|gif)$/i;

/**
 * Serviço para upload de logos (consultoria e cliente) no Supabase Storage.
 */
@Injectable()
export class UploadLogoService {
  private readonly logger = new Logger(UploadLogoService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  getBucketName(): string {
    return this.configService.get<string>('SUPABASE_STORAGE_BUCKET_ASSETS') || BUCKET_ASSETS;
  }

  validarArquivo(buffer: Buffer, mimetype: string): void {
    if (!mimetype || !MIME_IMAGES.test(mimetype)) {
      throw new Error('Arquivo deve ser uma imagem (JPEG, PNG, WebP ou GIF)');
    }
    if (buffer.length > MAX_SIZE_BYTES) {
      throw new Error(`Imagem deve ter no máximo ${MAX_SIZE_BYTES / 1024 / 1024}MB`);
    }
  }

  private async garantirBucketExiste(): Promise<void> {
    const supabase = this.supabaseService.getClient();
    const bucketName = this.getBucketName();
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      this.logger.error('Erro ao listar buckets:', listError);
      throw new Error('Não foi possível verificar buckets do storage');
    }
    const existe = buckets?.some((b) => b.name === bucketName);
    if (!existe) {
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: MAX_SIZE_BYTES,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      });
      if (createError) {
        this.logger.error(`Erro ao criar bucket "${bucketName}":`, createError);
        throw new Error(
          `Bucket "${bucketName}" não existe. Crie-o no Supabase Dashboard ou configure SUPABASE_STORAGE_BUCKET_ASSETS.`,
        );
      }
      this.logger.log(`Bucket "${bucketName}" criado`);
    }
  }

  /**
   * Faz upload da logo e retorna a URL pública.
   * @param pasta - Ex: 'logos-consultoria' ou 'logos-clientes'
   * @param id - ID do usuário ou cliente
   * @param buffer - Conteúdo da imagem
   * @param mimeType - Ex: image/jpeg
   */
  async uploadLogo(
    pasta: string,
    id: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<string> {
    this.validarArquivo(buffer, mimeType);
    await this.garantirBucketExiste();
    const bucketName = this.getBucketName();
    const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
    const fileName = `logo-${Date.now()}.${ext}`;
    const filePath = `${pasta}/${id}/${fileName}`;
    const supabase = this.supabaseService.getClient();
    const { error } = await supabase.storage.from(bucketName).upload(filePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });
    if (error) {
      this.logger.error('Erro ao fazer upload da logo:', error);
      throw new Error('Falha ao enviar imagem. Tente novamente.');
    }
    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return data.publicUrl;
  }
}

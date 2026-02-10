import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseService } from './supabase.service';
import { UploadLogoService } from './upload-logo.service';

/**
 * Módulo global do Supabase.
 * Fornece o cliente Supabase para toda a aplicação.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [SupabaseService, UploadLogoService],
  exports: [SupabaseService, UploadLogoService],
})
export class SupabaseModule {}


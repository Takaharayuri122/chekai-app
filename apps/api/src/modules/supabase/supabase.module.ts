import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseService } from './supabase.service';

/**
 * Módulo global do Supabase.
 * Fornece o cliente Supabase para toda a aplicação.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [SupabaseService],
  exports: [SupabaseService],
})
export class SupabaseModule {}


import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Serviço que fornece o cliente Supabase.
 * Usa service role key para permitir operações server-side sem RLS.
 */
@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Inicializa o cliente Supabase no início do módulo.
   */
  onModuleInit(): void {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error(
        'SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias. Configure no arquivo .env',
      );
    }
    this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Retorna o cliente Supabase.
   */
  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error('Cliente Supabase não foi inicializado');
    }
    return this.client;
  }
}


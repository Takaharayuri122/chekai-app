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
    
    console.log('[SupabaseService] Inicializando cliente Supabase...');
    console.log('[SupabaseService] SUPABASE_URL presente:', !!supabaseUrl);
    console.log('[SupabaseService] SUPABASE_URL:', supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'N/A');
    console.log('[SupabaseService] SUPABASE_SERVICE_ROLE_KEY presente:', !!supabaseServiceRoleKey);
    console.log('[SupabaseService] SUPABASE_SERVICE_ROLE_KEY length:', supabaseServiceRoleKey?.length || 0);
    console.log('[SupabaseService] SUPABASE_SERVICE_ROLE_KEY prefix:', supabaseServiceRoleKey?.substring(0, 10) || 'N/A');
    
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
    
    console.log('[SupabaseService] Cliente Supabase inicializado com sucesso');
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


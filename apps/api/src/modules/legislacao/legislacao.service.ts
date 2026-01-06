import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SupabaseService } from '../supabase/supabase.service';
import { Legislacao, TipoLegislacao } from './entities/legislacao.entity';
import { LegislacaoChunk } from './entities/legislacao-chunk.entity';

interface ChunkInput {
  conteudo: string;
  artigo?: string;
  inciso?: string;
  paragrafo?: string;
}

interface BuscaSimilarResult {
  chunk: LegislacaoChunk;
  similaridade: number;
  legislacao: {
    tipo: string;
    numero: string;
    ano: number;
    titulo: string;
  };
}

/**
 * Serviço responsável pela gestão de legislações e RAG.
 */
@Injectable()
export class LegislacaoService {
  private openai: OpenAI;

  constructor(
    @InjectRepository(Legislacao)
    private readonly legislacaoRepository: Repository<Legislacao>,
    @InjectRepository(LegislacaoChunk)
    private readonly chunkRepository: Repository<LegislacaoChunk>,
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    console.log('[LegislacaoService] Verificando OPENAI_API_KEY...');
    console.log('[LegislacaoService] API Key presente:', !!apiKey);
    console.log('[LegislacaoService] API Key length:', apiKey?.length || 0);
    console.log('[LegislacaoService] API Key prefix:', apiKey?.substring(0, 7) || 'N/A');
    
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY não configurada. Configure a variável de ambiente OPENAI_API_KEY no arquivo .env',
      );
    }
    
    const trimmedKey = apiKey.trim();
    console.log('[LegislacaoService] API Key após trim length:', trimmedKey.length);
    console.log('[LegislacaoService] API Key após trim prefix:', trimmedKey.substring(0, 7));
    
    this.openai = new OpenAI({
      apiKey: trimmedKey,
    });
    
    console.log('[LegislacaoService] Cliente OpenAI inicializado com sucesso');
  }

  /**
   * Cria uma nova legislação.
   */
  async criarLegislacao(data: {
    tipo: TipoLegislacao;
    numero: string;
    ano: number;
    titulo: string;
    ementa?: string;
    orgaoEmissor?: string;
    linkOficial?: string;
  }): Promise<Legislacao> {
    const legislacao = this.legislacaoRepository.create(data);
    return this.legislacaoRepository.save(legislacao);
  }

  /**
   * Lista todas as legislações.
   */
  async listarLegislacoes(): Promise<Legislacao[]> {
    return this.legislacaoRepository.find({
      where: { ativo: true },
      order: { ano: 'DESC', numero: 'ASC' },
    });
  }

  /**
   * Busca uma legislação pelo ID.
   */
  async buscarLegislacaoPorId(id: string): Promise<Legislacao> {
    const legislacao = await this.legislacaoRepository.findOne({
      where: { id },
      relations: ['chunks'],
    });
    if (!legislacao) {
      throw new NotFoundException('Legislação não encontrada');
    }
    return legislacao;
  }

  /**
   * Atualiza uma legislação.
   */
  async atualizarLegislacao(
    id: string,
    data: Partial<{
      tipo: TipoLegislacao;
      numero: string;
      ano: number;
      titulo: string;
      ementa?: string;
      orgaoEmissor?: string;
      linkOficial?: string;
      ativo?: boolean;
    }>,
  ): Promise<Legislacao> {
    const legislacao = await this.buscarLegislacaoPorId(id);
    Object.assign(legislacao, data);
    return this.legislacaoRepository.save(legislacao);
  }

  /**
   * Remove (desativa) uma legislação.
   */
  async removerLegislacao(id: string): Promise<void> {
    const legislacao = await this.buscarLegislacaoPorId(id);
    legislacao.ativo = false;
    await this.legislacaoRepository.save(legislacao);
  }

  /**
   * Remove um chunk de legislação.
   */
  async removerChunk(chunkId: string): Promise<void> {
    const chunk = await this.chunkRepository.findOne({
      where: { id: chunkId },
    });
    if (!chunk) {
      throw new NotFoundException('Chunk não encontrado');
    }
    await this.chunkRepository.remove(chunk);
  }

  /**
   * Lista chunks de uma legislação.
   */
  async listarChunks(legislacaoId: string): Promise<LegislacaoChunk[]> {
    await this.buscarLegislacaoPorId(legislacaoId);
    return this.chunkRepository.find({
      where: { legislacaoId },
      order: { ordem: 'ASC' },
    });
  }

  /**
   * Gera embedding para um texto usando OpenAI.
   */
  async gerarEmbedding(texto: string): Promise<number[]> {
    console.log('[LegislacaoService] Gerando embedding para texto:', texto.substring(0, 50) + '...');
    console.log('[LegislacaoService] Modelo:', 'text-embedding-3-small');
    
    try {
      const apiKey = this.configService.get<string>('OPENAI_API_KEY');
      console.log('[LegislacaoService] API Key sendo usada (prefix):', apiKey?.substring(0, 7) || 'N/A');
      console.log('[LegislacaoService] API Key length:', apiKey?.length || 0);
      
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texto,
      });
      
      console.log('[LegislacaoService] Embedding gerado com sucesso. Tamanho:', response.data[0].embedding.length);
      return response.data[0].embedding;
    } catch (error: any) {
      console.error('[LegislacaoService] Erro ao gerar embedding:', {
        status: error?.status,
        message: error?.message,
        code: error?.code,
        type: error?.type,
      });
      
      if (error?.status === 401 || error?.message?.includes('Invalid API key') || error?.message?.includes('Incorrect API key')) {
        const apiKey = this.configService.get<string>('OPENAI_API_KEY');
        console.error('[LegislacaoService] API Key inválida detectada. Key prefix:', apiKey?.substring(0, 7) || 'N/A');
        throw new Error(
          'Chave de API da OpenAI inválida ou expirada. Verifique a variável OPENAI_API_KEY no arquivo .env e certifique-se de que a chave está correta e ativa.',
        );
      }
      throw new Error(`Erro ao gerar embedding: ${error?.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Adiciona chunks a uma legislação e gera embeddings.
   */
  async adicionarChunks(
    legislacaoId: string,
    chunks: ChunkInput[],
  ): Promise<void> {
    await this.buscarLegislacaoPorId(legislacaoId);
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.gerarEmbedding(chunk.conteudo);
      const novoChunk = this.chunkRepository.create({
        legislacaoId,
        conteudo: chunk.conteudo,
        artigo: chunk.artigo,
        inciso: chunk.inciso,
        paragrafo: chunk.paragrafo,
        ordem: i,
        tokenCount: Math.ceil(chunk.conteudo.length / 4),
        embedding: `[${embedding.join(',')}]`,
      });
      await this.chunkRepository.save(novoChunk);
    }
  }

  /**
   * Busca chunks similares usando busca vetorial via Supabase RPC.
   * Requer que a função buscar_chunks_similares esteja criada no Supabase.
   * Execute o script: scripts/supabase-busca-vetorial-function.sql
   */
  async buscarChunksSimilares(
    query: string,
    limite = 5,
  ): Promise<BuscaSimilarResult[]> {
    console.log('[LegislacaoService] Iniciando busca de chunks similares...');
    console.log('[LegislacaoService] Query:', query.substring(0, 50) + '...');
    console.log('[LegislacaoService] Limite:', limite);
    
    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.gerarEmbedding(query);
      console.log('[LegislacaoService] Embedding gerado. Tamanho:', queryEmbedding.length);
    } catch (error: any) {
      console.error('[LegislacaoService] Erro ao gerar embedding:', error.message);
      // Propaga o erro de embedding com mensagem clara
      throw error;
    }
    
    console.log('[LegislacaoService] Obtendo cliente Supabase...');
    const supabase = this.supabaseService.getClient();
    console.log('[LegislacaoService] Cliente Supabase obtido com sucesso');
    
    console.log('[LegislacaoService] Chamando RPC buscar_chunks_similares...');
    console.log('[LegislacaoService] Parâmetros:', {
      query_embedding_length: queryEmbedding.length,
      match_limit: limite,
    });
    
    // Chama a função stored procedure via RPC
    const { data, error } = await supabase.rpc('buscar_chunks_similares', {
      query_embedding: queryEmbedding,
      match_limit: limite,
    });
    
    if (error) {
      console.error('[LegislacaoService] Erro na chamada RPC:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      
      if (
        error.code === '42883' ||
        error.code === 'PGRST202' ||
        error.message?.includes('function') ||
        error.message?.includes('Could not find the function')
      ) {
        throw new Error(
          'Função buscar_chunks_similares não encontrada no banco de dados.\n\n' +
            'Para resolver:\n' +
            '1. Acesse o Supabase Dashboard: https://supabase.com/dashboard\n' +
            '2. Selecione seu projeto\n' +
            '3. Vá em SQL Editor (menu lateral)\n' +
            '4. Copie e cole o conteúdo do arquivo: scripts/supabase-busca-vetorial-function.sql\n' +
            '5. Execute o script (botão Run ou Ctrl+Enter)\n' +
            '6. Aguarde a confirmação de sucesso\n\n' +
            'Após executar, reinicie a aplicação.',
        );
      }
      
      // Verifica se é erro de autenticação/API key
      if (error.message?.includes('Invalid API key') || error.message?.includes('JWT') || error.code === 'PGRST301') {
        throw new Error(
          `Erro de autenticação do Supabase: ${error.message}. Verifique a variável SUPABASE_SERVICE_ROLE_KEY no arquivo .env e certifique-se de que está usando a Service Role Key (não a anon key).`,
        );
      }
      
      throw new Error(`Erro ao buscar chunks similares: ${error.message}`);
    }
    
    console.log('[LegislacaoService] RPC executado com sucesso. Resultados encontrados:', data?.length || 0);
    return this.mapearResultadosBusca(data || []);
  }

  /**
   * Mapeia os resultados da busca para o formato esperado.
   */
  private mapearResultadosBusca(data: any[]): BuscaSimilarResult[] {
    if (!data || data.length === 0) {
      return [];
    }
    return data.map((row: {
      id: string;
      conteudo: string;
      artigo: string;
      inciso: string;
      paragrafo: string;
      tipo: string;
      numero: string;
      ano: number;
      titulo: string;
      similaridade: number;
    }) => ({
      chunk: {
        id: row.id,
        conteudo: row.conteudo,
        artigo: row.artigo,
        inciso: row.inciso,
        paragrafo: row.paragrafo,
      } as LegislacaoChunk,
      similaridade: row.similaridade,
      legislacao: {
        tipo: row.tipo,
        numero: row.numero,
        ano: row.ano,
        titulo: row.titulo,
      },
    }));
  }

  /**
   * Gera contexto RAG para uma query.
   */
  async gerarContextoRag(query: string): Promise<string> {
    const chunksSimilares = await this.buscarChunksSimilares(query, 5);
    if (chunksSimilares.length === 0) {
      return 'Nenhuma legislação relevante encontrada.';
    }
    const contexto = chunksSimilares
      .map((result) => {
        const ref = `${result.legislacao.tipo.toUpperCase()} ${result.legislacao.numero}/${result.legislacao.ano}`;
        const artigo = result.chunk.artigo ? `, ${result.chunk.artigo}` : '';
        return `[${ref}${artigo}]: ${result.chunk.conteudo}`;
      })
      .join('\n\n');
    return contexto;
  }
}


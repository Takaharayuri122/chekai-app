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
    this.openai = new OpenAI({
      apiKey: this.configService.get<string>('OPENAI_API_KEY'),
    });
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
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texto,
    });
    return response.data[0].embedding;
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
    const queryEmbedding = await this.gerarEmbedding(query);
    const supabase = this.supabaseService.getClient();
    // Chama a função stored procedure via RPC
    const { data, error } = await supabase.rpc('buscar_chunks_similares', {
      query_embedding: queryEmbedding,
      match_limit: limite,
    });
    if (error) {
      if (error.code === '42883' || error.message.includes('function')) {
        throw new Error(
          'Função buscar_chunks_similares não encontrada. Execute o script scripts/supabase-busca-vetorial-function.sql no SQL Editor do Supabase.',
        );
      }
      throw new Error(`Erro ao buscar chunks similares: ${error.message}`);
    }
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


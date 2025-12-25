import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
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
    private readonly dataSource: DataSource,
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
   * Busca chunks similares usando busca vetorial.
   */
  async buscarChunksSimilares(
    query: string,
    limite = 5,
  ): Promise<BuscaSimilarResult[]> {
    const queryEmbedding = await this.gerarEmbedding(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const results = await this.dataSource.query(
      `
      SELECT 
        c.id,
        c.conteudo,
        c.artigo,
        c.inciso,
        c.paragrafo,
        l.tipo,
        l.numero,
        l.ano,
        l.titulo,
        1 - (c.embedding <=> $1::vector) as similaridade
      FROM legislacao_chunks c
      JOIN legislacoes l ON l.id = c.legislacao_id
      WHERE l.ativo = true
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2
    `,
      [embeddingStr, limite],
    );
    return results.map((row: {
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


import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { SupabaseService } from '../supabase/supabase.service';
import { Legislacao, SituacaoLegislacao, StatusLeitura } from './entities/legislacao.entity';
import { nomeCurtoLegislacao } from './lib/nome-legislacao';
import { CriarLegislacaoDto } from './dto/criar-legislacao.dto';
import { AtualizarLegislacaoDto } from './dto/atualizar-legislacao.dto';
import { ListarLegislacoesQueryDto } from './dto/listar-legislacoes-query.dto';
import { LegislacaoChunk } from './entities/legislacao-chunk.entity';
import { LegislacaoLeituraService, UsuarioAutenticado } from './legislacao-leitura.service';
import { LinkInvalidoError, normalizarLink } from './lib/url-segura';

interface ChunkInput {
  conteudo: string;
  artigo?: string;
  inciso?: string;
  paragrafo?: string;
}

export interface LegislacaoOpcao {
  id: string;
  nome: string;
  titulo: string;
  situacao: SituacaoLegislacao | null;
}

export interface LegislacaoParaPrompt {
  nome: string;
  ementa: string | null;
}

export type LegislacaoListada = Legislacao & { totalTrechos: number };

interface BuscaSimilarResult {
  chunk: LegislacaoChunk;
  similaridade: number;
  legislacao: {
    id?: string;
    tipo: string;
    numero: string;
    ano: number;
    titulo: string;
    linkOficial?: string | null;
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
    private readonly leituraService: LegislacaoLeituraService,
  ) {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error(
        'OPENAI_API_KEY não configurada. Configure a variável de ambiente OPENAI_API_KEY no arquivo .env',
      );
    }
    this.openai = new OpenAI({ apiKey: apiKey.trim() });
  }

  /**
   * Cadastra uma legislação pelo link oficial e dispara a leitura em segundo plano.
   * Link inválido ou não público → 400; link já cadastrado → 409 com o id da existente.
   */
  async criarLegislacao(
    data: CriarLegislacaoDto,
    usuario: UsuarioAutenticado,
  ): Promise<Legislacao> {
    const linkOficial = await this.prepararLink(data.linkOficial);

    const legislacao = this.legislacaoRepository.create({
      linkOficial,
      titulo: data.titulo,
      informacoes: data.informacoes ?? null,
      statusLeitura: StatusLeitura.PENDENTE,
      criadoPorId: usuario.id,
    });
    let salva: Legislacao;
    try {
      salva = await this.legislacaoRepository.save(legislacao);
    } catch (erro) {
      // Corrida com outro cadastro do mesmo link (índice único legislacoes_link_unico).
      if ((erro as { code?: string })?.code === '23505') {
        await this.garantirLinkNovo(linkOficial);
      }
      throw erro;
    }
    return this.leituraService.iniciar(salva.id, usuario, { tipo: 'link' });
  }

  /**
   * Normaliza e valida o link (400 se inválido/não público) e garante que não está cadastrado (409).
   */
  private async prepararLink(link: string, ignorarId?: string): Promise<string> {
    let linkOficial: string;
    try {
      linkOficial = normalizarLink(link);
      await this.leituraService.validarLink(linkOficial);
    } catch (erro) {
      if (erro instanceof LinkInvalidoError) {
        throw new BadRequestException(erro.message);
      }
      throw erro;
    }
    await this.garantirLinkNovo(linkOficial, ignorarId);
    return linkOficial;
  }

  private async garantirLinkNovo(linkOficial: string, ignorarId?: string): Promise<void> {
    const qb = this.legislacaoRepository
      .createQueryBuilder('legislacao')
      .select(['legislacao.id'])
      .where('lower(legislacao.linkOficial) = lower(:linkOficial)', { linkOficial });
    if (ignorarId) {
      qb.andWhere('legislacao.id <> :ignorarId', { ignorarId });
    }
    const existente = await qb.getOne();
    if (existente) {
      throw new ConflictException({ message: 'Esta legislação já está cadastrada.', id: existente.id });
    }
  }

  /**
   * Lista as legislações com a contagem de trechos, aplicando os filtros.
   */
  async listar(filtros: ListarLegislacoesQueryDto = {}): Promise<LegislacaoListada[]> {
    const qb = this.legislacaoRepository
      .createQueryBuilder('legislacao')
      .loadRelationCountAndMap('legislacao.totalTrechos', 'legislacao.chunks');
    if (filtros.busca?.trim()) {
      qb.andWhere(
        '(legislacao.titulo ILIKE :busca OR legislacao.numero ILIKE :busca OR legislacao.ementa ILIKE :busca)',
        { busca: `%${filtros.busca.trim()}%` },
      );
    }
    if (filtros.statusLeitura) {
      qb.andWhere('legislacao.statusLeitura = :statusLeitura', {
        statusLeitura: filtros.statusLeitura,
      });
    }
    if (filtros.ativo) {
      qb.andWhere('legislacao.ativo = :ativo', { ativo: filtros.ativo === 'true' });
    }
    qb.orderBy('legislacao.ano', 'DESC', 'NULLS LAST').addOrderBy('legislacao.titulo', 'ASC');
    return (await qb.getMany()) as LegislacaoListada[];
  }

  /**
   * Opções para os seletores: legislações ativas, ordenadas pelo nome curto.
   */
  async listarOpcoes(): Promise<LegislacaoOpcao[]> {
    const ativas = await this.legislacaoRepository.find({ where: { ativo: true } });
    return ativas
      .map((l) => ({
        id: l.id,
        nome: nomeCurtoLegislacao(l),
        titulo: l.titulo,
        situacao: l.situacao,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  }

  /**
   * Legislações ativas (nome curto + ementa) para listar nos prompts da IA, limitadas para economizar tokens.
   */
  async listarParaPrompt(limite = 80): Promise<LegislacaoParaPrompt[]> {
    const ativas = await this.legislacaoRepository.find({ where: { ativo: true } });
    return ativas
      .map((l) => ({ nome: nomeCurtoLegislacao(l), ementa: l.ementa ?? null }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
      .slice(0, limite);
  }

  /**
   * Busca legislações ativas pelos IDs; falha se alguma não existir ou estiver inativa.
   */
  async buscarPorIds(ids: string[]): Promise<Legislacao[]> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) {
      return [];
    }
    const encontradas = await this.legislacaoRepository.find({
      where: { id: In(unicos), ativo: true },
    });
    if (encontradas.length !== unicos.length) {
      throw new BadRequestException('Legislação não encontrada.');
    }
    // Preserva a ordem enviada (o texto derivado segue essa ordem)
    const porId = new Map(encontradas.map((l) => [l.id, l]));
    return unicos.map((id) => porId.get(id) as Legislacao);
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
   * Atualiza os dados de uma legislação.
   */
  async atualizarLegislacao(id: string, data: AtualizarLegislacaoDto): Promise<Legislacao> {
    const legislacao = await this.buscarLegislacaoPorId(id);
    const dados = { ...data };
    if (dados.linkOficial !== undefined) {
      dados.linkOficial = await this.prepararLink(dados.linkOficial, id);
    }
    Object.assign(legislacao, dados);
    try {
      return await this.legislacaoRepository.save(legislacao);
    } catch (erro) {
      if ((erro as { code?: string })?.code === '23505' && dados.linkOficial) {
        await this.garantirLinkNovo(dados.linkOficial, id);
      }
      throw erro;
    }
  }

  /**
   * Ativa ou desativa uma legislação.
   */
  async alterarAtivo(id: string, ativo: boolean): Promise<Legislacao> {
    const legislacao = await this.buscarLegislacaoPorId(id);
    legislacao.ativo = ativo;
    return this.legislacaoRepository.save(legislacao);
  }

  /**
   * Remove uma legislação; se estiver ligada a perguntas ou não conformidades, só pode ser desativada.
   */
  async remover(id: string): Promise<void> {
    const legislacao = await this.buscarLegislacaoPorId(id);
    const [vinculos] = await this.legislacaoRepository.query(
      `SELECT
         (SELECT COUNT(*) FROM template_item_legislacoes WHERE legislacao_id = $1)
         + (SELECT COUNT(*) FROM auditoria_item_legislacoes WHERE legislacao_id = $1) AS total`,
      [id],
    );
    if (Number(vinculos?.total) > 0) {
      throw new ConflictException(
        'Esta legislação está ligada a perguntas ou não conformidades. Desative em vez de remover.',
      );
    }
    await this.chunkRepository.delete({ legislacaoId: id });
    await this.legislacaoRepository.remove(legislacao);
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
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: texto,
      });
      return response.data[0].embedding;
    } catch (error: any) {
      if (error?.status === 401 || error?.message?.includes('Invalid API key') || error?.message?.includes('Incorrect API key')) {
        throw new Error(
          'Chave de API da OpenAI inválida ou expirada. Verifique a variável OPENAI_API_KEY no arquivo .env e certifique-se de que a chave está correta e ativa.',
        );
      }
      throw new Error(`Erro ao gerar embedding: ${error?.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Adiciona chunks a uma legislação e gera embeddings, continuando a ordem a partir do maior existente.
   */
  async adicionarChunks(
    legislacaoId: string,
    chunks: ChunkInput[],
  ): Promise<void> {
    await this.buscarLegislacaoPorId(legislacaoId);
    const ultimo = await this.chunkRepository.findOne({
      where: { legislacaoId },
      order: { ordem: 'DESC' },
    });
    const inicio = ultimo ? ultimo.ordem + 1 : 0;
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embedding = await this.gerarEmbedding(chunk.conteudo);
      const novoChunk = this.chunkRepository.create({
        legislacaoId,
        conteudo: chunk.conteudo,
        artigo: chunk.artigo,
        inciso: chunk.inciso,
        paragrafo: chunk.paragrafo,
        ordem: inicio + i,
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
    opcoes?: { legislacaoIds?: string[] },
  ): Promise<BuscaSimilarResult[]> {
    const queryEmbedding = await this.gerarEmbedding(query);
    const supabase = this.supabaseService.getClient();

    // Chama a função stored procedure via RPC
    const { data, error } = await supabase.rpc('buscar_chunks_similares', {
      query_embedding: queryEmbedding,
      match_limit: limite,
      ...(opcoes?.legislacaoIds?.length ? { filtro_legislacao_ids: opcoes.legislacaoIds } : {}),
    });

    if (error) {
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
      legislacao_id?: string;
      link_oficial?: string | null;
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
        id: row.legislacao_id,
        tipo: row.tipo,
        numero: row.numero,
        ano: row.ano,
        titulo: row.titulo,
        linkOficial: row.link_oficial,
      },
    }));
  }

  /**
   * Gera contexto RAG para uma query. Com `legislacaoIds`, os trechos dessas legislações vêm primeiro;
   * se forem poucos (< 3), completa com a busca em toda a base, sem repetir trechos (máx. 5).
   */
  async gerarContextoRag(
    query: string,
    opcoes?: { legislacaoIds?: string[] },
  ): Promise<string> {
    const limite = 5;
    let chunksSimilares: BuscaSimilarResult[];
    if (opcoes?.legislacaoIds?.length) {
      chunksSimilares = await this.buscarChunksSimilares(query, limite, opcoes);
      if (chunksSimilares.length < 3) {
        const gerais = await this.buscarChunksSimilares(query, limite);
        const vistos = new Set(chunksSimilares.map((r) => r.chunk.id));
        chunksSimilares = [
          ...chunksSimilares,
          ...gerais.filter((r) => !vistos.has(r.chunk.id)),
        ].slice(0, limite);
      }
    } else {
      chunksSimilares = await this.buscarChunksSimilares(query, limite);
    }
    if (chunksSimilares.length === 0) {
      return 'Nenhuma legislação relevante encontrada.';
    }
    return chunksSimilares
      .map((result) => {
        const ref = nomeCurtoLegislacao(result.legislacao as Parameters<typeof nomeCurtoLegislacao>[0]);
        const artigo = result.chunk.artigo ? `, ${result.chunk.artigo}` : '';
        return `[${ref}${artigo}]: ${result.chunk.conteudo}`;
      })
      .join('\n\n');
  }
}

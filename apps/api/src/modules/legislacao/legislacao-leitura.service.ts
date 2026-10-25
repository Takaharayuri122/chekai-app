import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, LessThan, Not, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import OpenAI from 'openai';
import {
  Legislacao,
  OrigemTexto,
  SituacaoLegislacao,
  StatusLeitura,
  TipoLegislacao,
} from './entities/legislacao.entity';
import { LegislacaoChunk } from './entities/legislacao-chunk.entity';
import { LegislacaoVinculoService } from './legislacao-vinculo.service';
import { CreditoService } from '../credito/credito.service';
import { ProvedorIa } from '../credito/entities/uso-credito.entity';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { LinkInvalidoError, validarUrlPublica } from './lib/url-segura';
import { BuscarFn, buscarHttp, RespostaHttp } from './lib/buscar-http';
import { decodificarHtml, ehPdf, extrairTextoHtml, extrairTextoPdf } from './lib/extrair-texto';
import { dividirEmTrechos } from './lib/dividir-trechos';

/**
 * De onde vem o texto a ser lido.
 */
export type FonteLeitura =
  | { tipo: 'link' }
  | { tipo: 'pdf'; buffer: Buffer }
  | { tipo: 'texto'; texto: string };

/**
 * Quem disparou a leitura (paga os créditos de IA, exceto MASTER).
 */
export interface UsuarioAutenticado {
  id: string;
  perfil: PerfilUsuario;
  gestorId?: string | null;
}

interface DadosLidos {
  tipo: TipoLegislacao | null;
  numero: string | null;
  ano: number | null;
  orgaoEmissor: string | null;
  ementa: string | null;
  dataPublicacao: string | null;
  situacao: SituacaoLegislacao | null;
}

/** Falha com mensagem pronta para o usuário (gravada em `erroLeitura`). */
class FalhaLeitura extends Error {}

const MSG = {
  semTexto: 'Não foi possível ler o texto deste link. Anexe o PDF ou cole o texto da legislação.',
  semCreditos: 'Sem créditos de IA para ler a legislação.',
  demorou: 'O site demorou demais para responder. Anexe o PDF ou cole o texto da legislação.',
  semAcesso: 'Não foi possível abrir este link. Anexe o PDF ou cole o texto da legislação.',
  grande: 'O conteúdo deste link passa de 20 MB. Anexe o PDF ou cole o texto da legislação.',
  redirects: 'O link redireciona vezes demais. Anexe o PDF ou cole o texto da legislação.',
  pdfIlegivel: 'Não foi possível ler o texto deste PDF. Cole o texto da legislação.',
  textoCurto: 'O texto colado é curto demais. Cole o texto completo da legislação.',
  iaIndisponivel: 'A leitura não pôde ser concluída agora. Tente de novo em alguns minutos.',
  generica: 'Não foi possível ler esta legislação. Tente de novo.',
  interrompida: 'A leitura foi interrompida. Tente de novo.',
  emAndamento: 'A leitura desta legislação já está em andamento.',
  semLink: 'Esta legislação não tem link. Envie o PDF ou cole o texto.',
};

const MIN_CARACTERES = 500;
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 30_000;
const TIMEOUT_IA_MS = 60_000;
const LOTE_EMBEDDINGS = 100;
const TRAVADA_MS = 10 * 60 * 1000;
const MODELO_DADOS = 'deepseek-chat';
const MODELO_EMBEDDING = 'text-embedding-3-small';

const CABECALHOS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

function cabecalho(resposta: RespostaHttp, nome: string): string | null {
  const valor = resposta.headers[nome];
  if (Array.isArray(valor)) return valor[0] ?? null;
  return valor ?? null;
}

function textoOuNulo(valor: unknown, max: number): string | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const texto = String(valor).trim();
  return texto ? texto.slice(0, max) : null;
}

function anoValido(valor: unknown): number | null {
  const texto = typeof valor === 'number' ? String(valor) : typeof valor === 'string' ? valor.trim() : '';
  if (!/^\d{4}$/.test(texto)) return null;
  const ano = Number(texto);
  return ano >= 1800 && ano <= 2100 ? ano : null;
}

function dataValida(valor: unknown): string | null {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor.trim())) return null;
  const data = new Date(`${valor.trim()}T00:00:00Z`);
  return !isNaN(data.getTime()) && data.toISOString().startsWith(valor.trim()) ? valor.trim() : null;
}

function enumValido<T extends string>(valores: T[], valor: unknown): T | null {
  return typeof valor === 'string' && (valores as string[]).includes(valor.trim().toLowerCase())
    ? (valor.trim().toLowerCase() as T)
    : null;
}

/**
 * Leitura automática de legislações: busca o conteúdo (link, PDF ou texto), extrai os dados
 * com IA, divide em trechos, gera embeddings e grava, em segundo plano.
 */
@Injectable()
export class LegislacaoLeituraService implements OnModuleInit {
  private readonly logger = new Logger(LegislacaoLeituraService.name);
  private openai: OpenAI;
  private deepseek: OpenAI;

  /** Busca HTTP de um salto (injetável nos testes). */
  fetchFn: BuscarFn = buscarHttp;
  /** Resolução de DNS usada na validação do link (injetável nos testes). */
  resolverFn?: (host: string) => Promise<string[]>;
  /** Tempo máximo da busca do link (ajustável nos testes). */
  timeoutMs = TIMEOUT_MS;

  constructor(
    @InjectRepository(Legislacao)
    private readonly legislacaoRepository: Repository<Legislacao>,
    private readonly dataSource: DataSource,
    private readonly creditoService: CreditoService,
    private readonly vinculoService: LegislacaoVinculoService,
    configService: ConfigService,
  ) {
    // Timeout explícito: sem ele uma chamada pendurada deixaria a legislação presa em "lendo".
    this.openai = new OpenAI({
      apiKey: (configService.get<string>('OPENAI_API_KEY') ?? '').trim(),
      timeout: TIMEOUT_IA_MS,
      maxRetries: 1,
    });
    this.deepseek = new OpenAI({
      apiKey: configService.get<string>('DEEPSEEK_API_KEY'),
      baseURL: configService.get<string>('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
      timeout: TIMEOUT_IA_MS,
      maxRetries: 1,
    });
  }

  /**
   * Leituras que ficaram em andamento (ex.: queda do processo) viram falha.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.legislacaoRepository.update(
        {
          statusLeitura: StatusLeitura.LENDO,
          atualizadoEm: LessThan(new Date(Date.now() - TRAVADA_MS)),
        },
        { statusLeitura: StatusLeitura.FALHOU, erroLeitura: MSG.interrompida },
      );
    } catch (erro) {
      this.logger.error(`Falha ao encerrar leituras interrompidas: ${(erro as Error).message}`);
    }
  }

  /**
   * Valida o link (formato e destino público). Lança `LinkInvalidoError`.
   */
  async validarLink(url: string): Promise<void> {
    await validarUrlPublica(url, this.resolverFn);
  }

  /**
   * Marca a legislação como `lendo`, dispara o processamento sem aguardar e devolve a entidade.
   */
  async iniciar(id: string, usuario: UsuarioAutenticado, fonte: FonteLeitura): Promise<Legislacao> {
    const legislacao = await this.legislacaoRepository.findOne({ where: { id } });
    if (!legislacao) {
      throw new NotFoundException('Legislação não encontrada');
    }
    if (legislacao.statusLeitura === StatusLeitura.LENDO) {
      throw new ConflictException(MSG.emAndamento);
    }
    if (fonte.tipo === 'link' && !legislacao.linkOficial) {
      throw new BadRequestException(MSG.semLink);
    }
    // Atualização condicional: dois pedidos simultâneos não disparam duas leituras.
    const resultado = await this.legislacaoRepository.update(
      { id, statusLeitura: Not(StatusLeitura.LENDO) },
      { statusLeitura: StatusLeitura.LENDO, erroLeitura: null },
    );
    if (!resultado.affected) {
      throw new ConflictException(MSG.emAndamento);
    }
    legislacao.statusLeitura = StatusLeitura.LENDO;
    legislacao.erroLeitura = null;

    void this.processar(id, usuario, fonte).catch((erro) =>
      this.logger.error(`Falha inesperada na leitura da legislação ${id}: ${(erro as Error)?.message}`),
    );
    return legislacao;
  }

  /**
   * Processa a leitura. Nunca lança: em caso de erro grava `falhou` com a mensagem,
   * mantendo os trechos e os dados anteriores.
   */
  async processar(id: string, usuario: UsuarioAutenticado, fonte: FonteLeitura): Promise<void> {
    try {
      const legislacao = await this.legislacaoRepository.findOne({ where: { id } });
      if (!legislacao) {
        return;
      }

      let gestorId: string | undefined;
      if (usuario.perfil !== PerfilUsuario.MASTER) {
        try {
          gestorId = this.creditoService.identificarGestorId(usuario);
          await this.creditoService.validarSaldoDisponivel(gestorId);
        } catch {
          throw new FalhaLeitura(MSG.semCreditos);
        }
      }

      const { texto, indicioSituacao, origem } = await this.obterTexto(legislacao, fonte);
      const msgCurto =
        fonte.tipo === 'pdf' ? MSG.pdfIlegivel : fonte.tipo === 'texto' ? MSG.textoCurto : MSG.semTexto;
      if (texto.trim().length < MIN_CARACTERES) {
        throw new FalhaLeitura(msgCurto);
      }

      const dados = this.mesclarDados(
        legislacao,
        await this.extrairDados(texto, indicioSituacao, usuario, gestorId),
      );
      const trechos = dividirEmTrechos(texto);
      if (trechos.length === 0) {
        throw new FalhaLeitura(msgCurto);
      }
      const embeddings = await this.gerarEmbeddingsLote(
        trechos.map((t) => t.conteudo),
        usuario,
        gestorId,
      );

      const lidoEm = new Date();
      await this.dataSource.transaction(async (manager) => {
        await manager.delete(LegislacaoChunk, { legislacaoId: id });
        const linhas = trechos.map((t, i) => ({
          legislacaoId: id,
          conteudo: t.conteudo,
          artigo: t.artigo ? t.artigo.slice(0, 100) : null,
          ordem: i,
          tokenCount: Math.ceil(t.conteudo.length / 4),
          embedding: `[${embeddings[i].join(',')}]`,
        }));
        for (let i = 0; i < linhas.length; i += LOTE_EMBEDDINGS) {
          await manager.insert(LegislacaoChunk, linhas.slice(i, i + LOTE_EMBEDDINGS) as never);
        }
        await manager.update(Legislacao, id, {
          ...dados,
          statusLeitura: StatusLeitura.CONCLUIDA,
          erroLeitura: null,
          lidoEm,
          origemTexto: origem,
        } as QueryDeepPartialEntity<Legislacao>);
      });

      try {
        await this.vinculoService.ligarReferenciasAntigas({ ...legislacao, ...dados } as Legislacao);
      } catch (erro) {
        this.logger.error(`Falha ao ligar referências antigas da legislação ${id}: ${(erro as Error).message}`);
      }
    } catch (erro) {
      const mensagem = erro instanceof FalhaLeitura ? erro.message : MSG.generica;
      if (!(erro instanceof FalhaLeitura)) {
        this.logger.error(`Falha na leitura da legislação ${id}: ${(erro as Error)?.message}`);
      }
      await this.marcarFalha(id, mensagem);
    }
  }

  /**
   * Busca o conteúdo do link: valida cada salto (anti-SSRF), segue até 5 redirects,
   * timeout de 30 s e limite de 20 MB. Lança `FalhaLeitura` com mensagem para o usuário.
   */
  async buscarConteudo(url: string): Promise<{ buffer: Buffer; contentType: string | null }> {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), this.timeoutMs);
    try {
      let atual = url;
      for (let salto = 0; salto <= MAX_REDIRECTS; salto++) {
        try {
          await validarUrlPublica(atual, this.resolverFn);
        } catch (erro) {
          if (erro instanceof LinkInvalidoError) throw new FalhaLeitura(`${erro.message} Anexe o PDF ou cole o texto da legislação.`);
          throw erro;
        }

        const resposta = await this.fetchFn(atual, { headers: CABECALHOS, signal: controle.signal });
        const local = cabecalho(resposta, 'location');
        if (resposta.status >= 300 && resposta.status < 400 && local) {
          resposta.descartar?.();
          atual = new URL(local, atual).toString();
          continue;
        }
        if (resposta.status < 200 || resposta.status >= 300) {
          resposta.descartar?.();
          throw new FalhaLeitura(
            `Não foi possível abrir este link (código ${resposta.status}). Anexe o PDF ou cole o texto da legislação.`,
          );
        }

        const partes: Buffer[] = [];
        let total = 0;
        for await (const parte of resposta.body) {
          total += parte.length;
          if (total > MAX_BYTES) {
            resposta.descartar?.();
            controle.abort();
            throw new FalhaLeitura(MSG.grande);
          }
          partes.push(Buffer.from(parte));
        }
        return { buffer: Buffer.concat(partes), contentType: cabecalho(resposta, 'content-type') };
      }
      throw new FalhaLeitura(MSG.redirects);
    } catch (erro) {
      if (erro instanceof FalhaLeitura) throw erro;
      if (controle.signal.aborted) throw new FalhaLeitura(MSG.demorou);
      if (erro instanceof LinkInvalidoError) {
        throw new FalhaLeitura(`${erro.message} Anexe o PDF ou cole o texto da legislação.`);
      }
      throw new FalhaLeitura(MSG.semAcesso);
    } finally {
      clearTimeout(timer);
    }
  }

  private async obterTexto(
    legislacao: Legislacao,
    fonte: FonteLeitura,
  ): Promise<{ texto: string; indicioSituacao: SituacaoLegislacao | null; origem: OrigemTexto }> {
    if (fonte.tipo === 'texto') {
      return { texto: fonte.texto.trim(), indicioSituacao: null, origem: OrigemTexto.TEXTO };
    }
    if (fonte.tipo === 'pdf') {
      return { texto: await this.lerPdf(fonte.buffer), indicioSituacao: null, origem: OrigemTexto.PDF };
    }
    if (!legislacao.linkOficial) {
      throw new FalhaLeitura(MSG.semLink);
    }
    const { buffer, contentType } = await this.buscarConteudo(legislacao.linkOficial);
    if (ehPdf(buffer, contentType)) {
      return { texto: await this.lerPdf(buffer), indicioSituacao: null, origem: OrigemTexto.LINK };
    }
    const { texto, indicioSituacao } = extrairTextoHtml(decodificarHtml(buffer, contentType));
    return { texto, indicioSituacao, origem: OrigemTexto.LINK };
  }

  private async lerPdf(buffer: Buffer): Promise<string> {
    try {
      return await extrairTextoPdf(buffer);
    } catch {
      throw new FalhaLeitura(MSG.pdfIlegivel);
    }
  }

  /**
   * Extrai tipo, número, ano, órgão, ementa, data e situação com a IA. Inválidos viram nulo.
   */
  private async extrairDados(
    texto: string,
    indicioSituacao: SituacaoLegislacao | null,
    usuario: UsuarioAutenticado,
    gestorId: string | undefined,
  ): Promise<DadosLidos> {
    const amostra =
      texto.length > 14_000 ? `${texto.slice(0, 12_000)}\n[...]\n${texto.slice(-2_000)}` : texto;
    const tipos = Object.values(TipoLegislacao).join(', ');
    const situacoes = Object.values(SituacaoLegislacao).join(', ');
    const prompt = `Você recebe o texto de uma legislação brasileira. Identifique os dados dela.

Retorne APENAS um JSON com as chaves:
- tipo: um destes valores: ${tipos}
- numero: número do ato, só o número (ex.: "216")
- ano: ano do ato com 4 dígitos (número)
- orgaoEmissor: órgão que emitiu (ex.: "ANVISA")
- ementa: a ementa oficial, sem alterar o texto
- dataPublicacao: data de publicação no formato AAAA-MM-DD
- situacao: um destes valores: ${situacoes}
Use null quando não souber.
${indicioSituacao ? `\nIndício de situação encontrado na página: ${indicioSituacao}\n` : ''}
TEXTO:
${amostra}`;

    let resposta: OpenAI.Chat.Completions.ChatCompletion;
    try {
      resposta = await this.deepseek.chat.completions.create({
        model: MODELO_DADOS,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0,
        response_format: { type: 'json_object' },
      });
    } catch (erro) {
      this.logger.error(`Falha na IA ao ler legislação: ${(erro as Error)?.message}`);
      throw new FalhaLeitura(MSG.iaIndisponivel);
    }

    if (gestorId && resposta.usage) {
      await this.creditoService.registrarUso({
        gestorId,
        usuarioId: usuario.id,
        provedor: ProvedorIa.DEEPSEEK,
        modelo: MODELO_DADOS,
        tokensInput: resposta.usage.prompt_tokens || 0,
        tokensOutput: resposta.usage.completion_tokens || 0,
        metodoChamado: 'lerLegislacao',
        contexto: 'Leitura automática de legislação',
      });
    }

    let bruto: Record<string, unknown> = {};
    try {
      const conteudo = (resposta.choices[0]?.message?.content ?? '{}')
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      const lido = JSON.parse(conteudo);
      if (lido && typeof lido === 'object') bruto = lido;
    } catch {
      bruto = {};
    }

    return {
      tipo: enumValido(Object.values(TipoLegislacao), bruto.tipo),
      numero: textoOuNulo(bruto.numero, 50),
      ano: anoValido(bruto.ano),
      orgaoEmissor: textoOuNulo(bruto.orgaoEmissor, 100),
      ementa: textoOuNulo(bruto.ementa, 10_000),
      dataPublicacao: dataValida(bruto.dataPublicacao),
      situacao: enumValido(Object.values(SituacaoLegislacao), bruto.situacao) ?? indicioSituacao,
    };
  }

  /**
   * Campo nulo/inválido na leitura mantém o valor anterior da legislação (releitura não apaga dados);
   * `tipo` só vira `outro` se não havia tipo útil antes.
   */
  private mesclarDados(
    anterior: Legislacao,
    lidos: DadosLidos,
  ): Omit<DadosLidos, 'tipo'> & { tipo: TipoLegislacao } {
    const tipoAnterior =
      anterior.tipo && anterior.tipo !== TipoLegislacao.OUTRO ? anterior.tipo : null;
    return {
      tipo: (lidos.tipo && lidos.tipo !== TipoLegislacao.OUTRO ? lidos.tipo : null) ??
        tipoAnterior ??
        lidos.tipo ??
        TipoLegislacao.OUTRO,
      numero: lidos.numero ?? anterior.numero ?? null,
      ano: lidos.ano ?? anterior.ano ?? null,
      orgaoEmissor: lidos.orgaoEmissor ?? anterior.orgaoEmissor ?? null,
      ementa: lidos.ementa ?? anterior.ementa ?? null,
      dataPublicacao: lidos.dataPublicacao ?? anterior.dataPublicacao ?? null,
      situacao: lidos.situacao ?? anterior.situacao ?? null,
    };
  }

  /**
   * Gera embeddings em lotes de até 100 textos e registra o uso somado.
   */
  private async gerarEmbeddingsLote(
    textos: string[],
    usuario: UsuarioAutenticado,
    gestorId: string | undefined,
  ): Promise<number[][]> {
    const embeddings: number[][] = [];
    let tokens = 0;
    for (let i = 0; i < textos.length; i += LOTE_EMBEDDINGS) {
      const lote = textos.slice(i, i + LOTE_EMBEDDINGS);
      let resposta: OpenAI.Embeddings.CreateEmbeddingResponse;
      try {
        resposta = await this.openai.embeddings.create({ model: MODELO_EMBEDDING, input: lote });
      } catch (erro) {
        this.logger.error(`Falha ao gerar embeddings da legislação: ${(erro as Error)?.message}`);
        throw new FalhaLeitura(MSG.iaIndisponivel);
      }
      const ordenados = [...resposta.data].sort((a, b) => a.index - b.index);
      if (ordenados.length !== lote.length) {
        throw new Error('Quantidade de embeddings diferente da de trechos');
      }
      embeddings.push(...ordenados.map((d) => d.embedding));
      tokens += resposta.usage?.prompt_tokens ?? 0;
    }
    if (gestorId) {
      await this.creditoService.registrarUso({
        gestorId,
        usuarioId: usuario.id,
        provedor: ProvedorIa.OPENAI,
        modelo: MODELO_EMBEDDING,
        tokensInput: tokens,
        tokensOutput: 0,
        metodoChamado: 'gerarEmbeddingsLegislacao',
        contexto: `Trechos de legislação: ${textos.length}`,
      });
    }
    return embeddings;
  }

  private async marcarFalha(id: string, mensagem: string): Promise<void> {
    try {
      await this.legislacaoRepository.update(id, {
        statusLeitura: StatusLeitura.FALHOU,
        erroLeitura: mensagem,
      });
    } catch (erro) {
      this.logger.error(`Falha ao gravar erro de leitura da legislação ${id}: ${(erro as Error).message}`);
    }
  }
}

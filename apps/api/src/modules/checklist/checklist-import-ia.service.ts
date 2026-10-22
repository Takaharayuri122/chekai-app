import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { CreditoService } from '../credito/credito.service';
import { ProvedorIa } from '../credito/entities/uso-credito.entity';
import { LegislacaoService } from '../legislacao/legislacao.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import {
  interpretarRespostaIa,
  montarPromptRevisao,
  RevisaoGrupoResultado,
} from './checklist-import-revisao';
import { RevisarImportacaoDto } from './dto/importar-checklist.dto';

type UsuarioIa = { id: string; perfil: PerfilUsuario; gestorId?: string | null };

/**
 * Revisão por IA das perguntas importadas de planilha (um grupo por chamada).
 */
@Injectable()
export class ChecklistImportIaService {
  private readonly logger = new Logger(ChecklistImportIaService.name);
  private deepseek: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly legislacaoService: LegislacaoService,
    private readonly creditoService: CreditoService,
  ) {
    this.deepseek = new OpenAI({
      apiKey: this.configService.get<string>('DEEPSEEK_API_KEY'),
      baseURL: this.configService.get<string>('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
    });
  }

  async revisarGrupo(dto: RevisarImportacaoDto, usuario: UsuarioIa): Promise<RevisaoGrupoResultado> {
    let gestorId: string | undefined;
    if (usuario.perfil !== PerfilUsuario.MASTER) {
      try {
        gestorId = this.creditoService.identificarGestorId(usuario);
        await this.creditoService.validarSaldoDisponivel(gestorId);
      } catch {
        return { status: 'sem_creditos', sugestoes: [] };
      }
    }

    try {
      const contextoLegal = await this.buscarContextoLegal(dto);
      const prompt = montarPromptRevisao(dto.grupo, dto.perguntas, contextoLegal);
      const resposta = await this.deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      });

      if (gestorId && resposta.usage) {
        await this.creditoService.registrarUso({
          gestorId,
          usuarioId: usuario.id,
          provedor: ProvedorIa.DEEPSEEK,
          modelo: 'deepseek-chat',
          tokensInput: resposta.usage.prompt_tokens || 0,
          tokensOutput: resposta.usage.completion_tokens || 0,
          metodoChamado: 'checklistImport.revisao',
          contexto: `Revisão de importação: ${dto.grupo}`,
        });
      }

      const conteudo = resposta.choices[0]?.message?.content ?? '';
      const { grupoNomeSugerido, sugestoes } = interpretarRespostaIa(conteudo, dto.perguntas);
      return { status: 'revisado', grupoNomeSugerido, sugestoes };
    } catch (erro) {
      this.logger.error(
        `Falha na revisão por IA do grupo "${dto.grupo}": ${erro instanceof Error ? erro.message : 'erro desconhecido'}`,
      );
      return { status: 'falha', sugestoes: [] };
    }
  }

  private async buscarContextoLegal(dto: RevisarImportacaoDto): Promise<string[]> {
    try {
      const query = `${dto.grupo} ${dto.perguntas
        .slice(0, 5)
        .map((p) => p.pergunta)
        .join(' ')}`;
      const chunks = await this.legislacaoService.buscarChunksSimilares(query, 5);
      return chunks.map((c) => c.chunk.conteudo).filter(Boolean);
    } catch (erro) {
      this.logger.warn(
        `Busca de legislação falhou; seguindo sem contexto: ${erro instanceof Error ? erro.message : 'erro desconhecido'}`,
      );
      return [];
    }
  }
}

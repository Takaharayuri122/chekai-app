import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { LegislacaoService } from '../legislacao/legislacao.service';
import { CreditoService } from '../credito/credito.service';
import { RateLimitAnaliseImagemService } from './rate-limit-analise-imagem.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { ProvedorIa } from '../credito/entities/uso-credito.entity';

interface AnaliseImagemResult {
  tipoNaoConformidade: string;
  descricao: string;
  gravidade: 'baixa' | 'media' | 'alta' | 'critica';
  sugestoes: string[];
}

interface GeracaoTextoResult {
  descricaoTecnica: string;
  referenciaLegal: string;
  riscoEnvolvido: string;
  planoAcao: {
    acoesCorretivas: string[];
    acoesPreventivas: string[];
    prazoSugerido: string;
    responsavelSugerido: string;
  };
}

/**
 * Serviço responsável pela integração com modelos de IA.
 * - DeepSeek: para geração de textos (mais barato)
 * - OpenAI GPT-4o-mini: para análise de imagens (suporta visão)
 */
@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);
  private deepseekText: OpenAI;
  private openaiVision: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly legislacaoService: LegislacaoService,
    private readonly creditoService: CreditoService,
    private readonly rateLimitAnaliseImagemService: RateLimitAnaliseImagemService,
  ) {
    // Cliente DeepSeek para textos
    const deepseekApiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    const deepseekBaseUrl = this.configService.get<string>(
      'DEEPSEEK_BASE_URL',
      'https://api.deepseek.com',
    );
    this.deepseekText = new OpenAI({
      apiKey: deepseekApiKey,
      baseURL: deepseekBaseUrl,
    });

    // Cliente OpenAI para visão (GPT-4o-mini suporta imagens)
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    this.openaiVision = new OpenAI({
      apiKey: openaiApiKey,
    });
  }

  /**
   * Analisa uma imagem para detectar não conformidades.
   * Usa OpenAI GPT-4o-mini que suporta análise de imagens.
   */
  async analisarImagem(
    imagemBase64: string,
    contexto: string,
    usuario?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<AnaliseImagemResult> {
    const prompt = `Você é um especialista em segurança de alimentos e higiene.
Analise esta imagem de uma área de ${contexto} e identifique possíveis não conformidades relacionadas à segurança alimentar.

Retorne APENAS um JSON válido (sem markdown, sem backticks) com:
- tipoNaoConformidade: tipo identificado (ex: "armazenamento inadequado", "falta de EPI", "sujidade", "contaminação cruzada")
- descricao: descrição detalhada do problema observado na imagem
- gravidade: "baixa", "media", "alta" ou "critica"
- sugestoes: array com 2-4 sugestões de correção

Se não identificar não conformidades, retorne:
{"tipoNaoConformidade": "Nenhuma identificada", "descricao": "A imagem não apresenta não conformidades visíveis", "gravidade": "baixa", "sugestoes": []}`;

    if (usuario && usuario.perfil !== PerfilUsuario.MASTER) {
      const gestorId = this.creditoService.identificarGestorId(usuario);
      this.rateLimitAnaliseImagemService.verificarEPregistrar(gestorId);
    }

    const response = await this.openaiVision.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { 
                url: `data:image/png;base64,${imagemBase64}`,
                detail: 'low',
              },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content || '{}';
    try {
      // Remove possíveis backticks de markdown
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanContent);
    } catch {
      return {
        tipoNaoConformidade: 'Erro na análise',
        descricao: content,
        gravidade: 'media',
        sugestoes: ['Tente novamente com outra imagem'],
      };
    }
  }

  /**
   * Gera texto técnico e plano de ação para uma não conformidade usando RAG.
   * Usa DeepSeek para economia de custos.
   */
  async gerarTextoNaoConformidade(
    descricaoSimples: string,
    tipoEstabelecimento: string,
    usuario?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<GeracaoTextoResult> {
    const contextoLegislacao = await this.legislacaoService.gerarContextoRag(
      `${descricaoSimples} ${tipoEstabelecimento} segurança alimentos`,
    );

    const prompt = `Você é um consultor especialista em segurança de alimentos.
Com base na descrição da não conformidade e na legislação fornecida, gere um relatório técnico.

DESCRIÇÃO DA NÃO CONFORMIDADE:
${descricaoSimples}

TIPO DE ESTABELECIMENTO: ${tipoEstabelecimento}

LEGISLAÇÃO RELEVANTE:
${contextoLegislacao}

Retorne APENAS um JSON válido (sem markdown, sem backticks) com:
- descricaoTecnica: descrição técnica detalhada da não conformidade
- referenciaLegal: citação da legislação aplicável (ex: "RDC 216/2004, Art. 4.1.3")
- riscoEnvolvido: tipo de risco (biológico, químico, físico, legal)
- planoAcao: objeto com:
  - acoesCorretivas: array de ações para corrigir o problema
  - acoesPreventivas: array de ações para prevenir recorrência
  - prazoSugerido: prazo recomendado (ex: "imediato", "7 dias", "30 dias")
  - responsavelSugerido: cargo sugerido (ex: "Responsável Técnico", "Gerente")`;

    let gestorId: string | undefined;
    if (usuario && usuario.perfil !== PerfilUsuario.MASTER) {
      gestorId = this.creditoService.identificarGestorId(usuario);
      await this.creditoService.validarSaldoDisponivel(gestorId);
    }

    const response = await this.deepseekText.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const usage = response.usage;
    if (gestorId && usuario && usage) {
      await this.creditoService.registrarUso({
        gestorId,
        usuarioId: usuario.id,
        provedor: ProvedorIa.DEEPSEEK,
        modelo: 'deepseek-chat',
        tokensInput: usage.prompt_tokens || 0,
        tokensOutput: usage.completion_tokens || 0,
        metodoChamado: 'gerarTextoNaoConformidade',
        contexto: `Geração de texto: ${descricaoSimples.substring(0, 100)}`,
      });
    }
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanContent);
    } catch {
      return {
        descricaoTecnica: content,
        referenciaLegal: 'Verificar legislação aplicável',
        riscoEnvolvido: 'A determinar',
        planoAcao: {
          acoesCorretivas: ['Corrigir a não conformidade identificada'],
          acoesPreventivas: ['Implementar controles preventivos'],
          prazoSugerido: 'A definir',
          responsavelSugerido: 'Responsável Técnico',
        },
      };
    }
  }

  /**
   * Analisa imagem no contexto de um item de checklist.
   * Gera descrição específica para o item sendo avaliado.
   */
  async analisarImagemChecklist(
    imagemBase64: string,
    perguntaChecklist: string,
    categoria: string,
    tipoEstabelecimento: string,
    usuario?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<{
    descricaoIa: string;
    tipoNaoConformidade: string;
    gravidade: 'baixa' | 'media' | 'alta' | 'critica';
    sugestoes: string[];
    referenciaLegal: string;
    imagemRelevante: boolean;
  }> {
    const contextoLegislacao = await this.legislacaoService.gerarContextoRag(
      `${perguntaChecklist} ${categoria}`,
    );
    const prompt = `Auditoria segurança alimentos.

Item: "${perguntaChecklist}"
Categoria: ${categoria}
Estabelecimento: ${tipoEstabelecimento}

Legislação: ${contextoLegislacao}

Analise a imagem e retorne JSON (sem markdown):
- imagemRelevante: true se a imagem mostra algo relacionado ao item, false se irrelevante
- descricaoIa: SEMPRE forneça uma descrição. Se relevante, descreva o observado. Se não relevante, explique brevemente o motivo (ex: "Imagem mostra X, mas o item pergunta sobre Y")
- tipoNaoConformidade: tipo identificado ou "Nenhuma identificada" (apenas se relevante)
- gravidade: "baixa", "media", "alta" ou "critica" (apenas se relevante)
- sugestoes: array com 2-3 sugestões de correção (apenas se relevante)
- referenciaLegal: citação legal (ex: "RDC 216/2004, Art. 4.1.3") (apenas se relevante)`;

    let gestorId: string | undefined;
    if (usuario && usuario.perfil !== PerfilUsuario.MASTER) {
      gestorId = this.creditoService.identificarGestorId(usuario);
      await this.creditoService.validarSaldoDisponivel(gestorId);
    }

    const response = await this.openaiVision.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${imagemBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      max_tokens: 800,
    });
    const content = response.choices[0]?.message?.content || '{}';
    const usage = response.usage;
    if (gestorId && usuario && usage) {
      await this.creditoService.registrarUso({
        gestorId,
        usuarioId: usuario.id,
        provedor: ProvedorIa.OPENAI,
        modelo: 'gpt-4o-mini',
        tokensInput: usage.prompt_tokens || 0,
        tokensOutput: usage.completion_tokens || 0,
        metodoChamado: 'analisarImagemChecklist',
        contexto: `Checklist: ${perguntaChecklist.substring(0, 100)}`,
      });
    }
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanContent);
      return {
        descricaoIa: parsed.descricaoIa || '',
        tipoNaoConformidade: parsed.tipoNaoConformidade || 'Nenhuma identificada',
        gravidade: parsed.gravidade || 'media',
        sugestoes: parsed.sugestoes || [],
        referenciaLegal: parsed.referenciaLegal || '',
        imagemRelevante: parsed.imagemRelevante !== undefined ? parsed.imagemRelevante : true,
      };
    } catch {
      return {
        descricaoIa: content,
        tipoNaoConformidade: 'Erro na análise',
        gravidade: 'media',
        sugestoes: ['Tente novamente com outra imagem'],
        referenciaLegal: 'Verificar legislação aplicável',
        imagemRelevante: true,
      };
    }
  }

  /**
   * Gera apenas o plano de ação para uma não conformidade.
   * Usa DeepSeek para economia de custos.
   */
  async gerarPlanoAcao(
    descricaoNaoConformidade: string,
    referenciaLegal: string,
    usuario?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<{
    acoesCorretivas: string[];
    acoesPreventivas: string[];
    prazoSugerido: string;
  }> {
    const prompt = `Com base na não conformidade descrita, gere um plano de ação objetivo.

NÃO CONFORMIDADE: ${descricaoNaoConformidade}
REFERÊNCIA LEGAL: ${referenciaLegal}

Retorne APENAS um JSON válido (sem markdown, sem backticks) com:
- acoesCorretivas: array com 2-4 ações corretivas específicas
- acoesPreventivas: array com 2-3 ações preventivas
- prazoSugerido: prazo recomendado`;

    let gestorId: string | undefined;
    if (usuario && usuario.perfil !== PerfilUsuario.MASTER) {
      gestorId = this.creditoService.identificarGestorId(usuario);
      await this.creditoService.validarSaldoDisponivel(gestorId);
    }

    const response = await this.deepseekText.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
    const usage = response.usage;
    if (gestorId && usuario && usage) {
      await this.creditoService.registrarUso({
        gestorId,
        usuarioId: usuario.id,
        provedor: ProvedorIa.DEEPSEEK,
        modelo: 'deepseek-chat',
        tokensInput: usage.prompt_tokens || 0,
        tokensOutput: usage.completion_tokens || 0,
        metodoChamado: 'gerarPlanoAcao',
        contexto: `Plano de ação: ${descricaoNaoConformidade.substring(0, 100)}`,
      });
    }
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanContent);
    } catch {
      return {
        acoesCorretivas: ['Corrigir a não conformidade'],
        acoesPreventivas: ['Treinar equipe'],
        prazoSugerido: '7 dias',
      };
    }
  }

  /**
   * Gera resumo executivo de uma auditoria.
   * Analisa todos os dados da auditoria e gera insights estratégicos.
   */
  async gerarResumoExecutivo(
    dadosAuditoria: {
      unidade: string;
      cliente: string;
      tipoAtividade: string;
      pontuacaoTotal: number;
      grupos: Array<{
        nome: string;
        pontuacaoPossivel: number;
        pontuacaoObtida: number;
        naoConformidades: number;
        itens: Array<{
          pergunta: string;
          resposta: string;
          observacao?: string;
          descricaoNaoConformidade?: string;
          descricaoIa?: string;
          criticidade?: string;
        }>;
      }>;
      itensNaoConformes: Array<{
        pergunta: string;
        observacao?: string;
        descricaoNaoConformidade?: string;
        descricaoIa?: string;
        criticidade?: string;
      }>;
      observacoesGerais?: string;
    },
    usuario?: { id: string; perfil: PerfilUsuario; gestorId?: string | null },
  ): Promise<{
    resumo: string;
    pontosFortes: string[];
    pontosFracos: string[];
    recomendacoesPrioritarias: string[];
    riscoGeral: 'baixo' | 'medio' | 'alto' | 'critico';
    tendencias: string[];
  }> {
    this.logger.log(`[gerarResumoExecutivo] Iniciando geração de resumo executivo`);
    this.logger.log(`[gerarResumoExecutivo] Dados: unidade=${dadosAuditoria.unidade}, cliente=${dadosAuditoria.cliente}, pontuacao=${dadosAuditoria.pontuacaoTotal}, grupos=${dadosAuditoria.grupos.length}, naoConformes=${dadosAuditoria.itensNaoConformes.length}`);
    
    try {
      this.logger.log(`[gerarResumoExecutivo] Gerando contexto RAG de legislação...`);
      const contextoLegislacao = await this.legislacaoService.gerarContextoRag(
        `${dadosAuditoria.tipoAtividade} segurança alimentos boas práticas`,
      );
      this.logger.log(`[gerarResumoExecutivo] Contexto RAG gerado. Tamanho: ${contextoLegislacao.length} caracteres`);

      this.logger.log(`[gerarResumoExecutivo] Processando grupos e não conformidades...`);
      
      const gruposTexto = dadosAuditoria.grupos.map((grupo) => {
        const aproveitamento = grupo.pontuacaoPossivel > 0
          ? ((grupo.pontuacaoObtida / grupo.pontuacaoPossivel) * 100).toFixed(2)
          : '0.00';
        return `Grupo: ${grupo.nome}
- Aproveitamento: ${aproveitamento}%
- Não conformidades: ${grupo.naoConformidades}
- Principais problemas: ${grupo.itens
          .filter((i) => i.resposta === 'nao_conforme')
          .slice(0, 3)
          .map((i) => i.pergunta)
          .join('; ')}`;
      }).join('\n\n');

      const naoConformesTexto = dadosAuditoria.itensNaoConformes
        .slice(0, 10)
        .map((item, idx) => {
          return `${idx + 1}. ${item.pergunta}
${item.descricaoNaoConformidade || item.observacao || item.descricaoIa || 'Sem descrição adicional'}
Criticidade: ${item.criticidade || 'média'}`;
        })
        .join('\n\n');
      
      this.logger.log(`[gerarResumoExecutivo] Textos processados. Tamanho grupos: ${gruposTexto.length}, não conformes: ${naoConformesTexto.length}`);

      this.logger.log(`[gerarResumoExecutivo] Construindo prompt para IA...`);
      const promptTexto = `Você é um consultor especialista em segurança de alimentos e auditorias.
Analise os dados desta auditoria e gere um resumo executivo estratégico e acionável.

DADOS DA AUDITORIA:
Unidade: ${dadosAuditoria.unidade}
Cliente: ${dadosAuditoria.cliente}
Tipo: ${dadosAuditoria.tipoAtividade}
Pontuação Total: ${typeof dadosAuditoria.pontuacaoTotal === 'number' ? dadosAuditoria.pontuacaoTotal.toFixed(2) : dadosAuditoria.pontuacaoTotal}%

MÉTRICAS POR GRUPO:
${gruposTexto}

PRINCIPAIS NÃO CONFORMIDADES (top 10):
${naoConformesTexto}

${dadosAuditoria.observacoesGerais ? `OBSERVAÇÕES GERAIS:\n${dadosAuditoria.observacoesGerais}` : ''}

LEGISLAÇÃO RELEVANTE:
${contextoLegislacao}

Gere um resumo executivo que seja:
1. ESTRATÉGICO: Foque em insights que façam diferença na tomada de decisão
2. ACIONÁVEL: Priorize recomendações práticas e mensuráveis
3. CONTEXTUAL: Relacione problemas com riscos reais e impacto no negócio
4. COMPARATIVO: Identifique padrões e tendências entre grupos
5. PRIORIZADO: Destaque o que é mais crítico e urgente

Retorne APENAS um JSON válido (sem markdown, sem backticks) com:
- resumo: texto executivo de 3-4 parágrafos destacando os principais achados, riscos e oportunidades
- pontosFortes: array com 3-5 pontos fortes identificados (ex: "Excelente controle de temperatura", "Equipe bem treinada")
- pontosFracos: array com 3-5 pontos fracos críticos (ex: "Falta de higienização adequada", "Armazenamento inadequado")
- recomendacoesPrioritarias: array com 4-6 recomendações priorizadas por impacto e urgência (ex: "Implementar cronograma de limpeza imediato", "Treinar equipe em contaminação cruzada")
- riscoGeral: "baixo", "medio", "alto" ou "critico" baseado na análise geral
- tendencias: array com 2-3 tendências ou padrões identificados (ex: "Problemas recorrentes em higienização", "Melhoria consistente em documentação")`;

      this.logger.log(`[gerarResumoExecutivo] Prompt construído. Tamanho: ${promptTexto.length} caracteres`);
      
      let gestorId: string | undefined;
      if (usuario && usuario.perfil !== PerfilUsuario.MASTER) {
        this.logger.log(`[gerarResumoExecutivo] Validando créditos para usuário ${usuario.id}, perfil: ${usuario.perfil}`);
        gestorId = this.creditoService.identificarGestorId(usuario);
        this.logger.log(`[gerarResumoExecutivo] Gestor ID identificado: ${gestorId}`);
        await this.creditoService.validarSaldoDisponivel(gestorId);
        this.logger.log(`[gerarResumoExecutivo] Créditos validados com sucesso`);
      } else {
        this.logger.log(`[gerarResumoExecutivo] Usuário MASTER, pulando validação de créditos`);
      }

      this.logger.log(`[gerarResumoExecutivo] Chamando DeepSeek API...`);
      const response = await this.deepseekText.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: promptTexto }],
        max_tokens: 3000,
        temperature: 0.4,
      });
      this.logger.log(`[gerarResumoExecutivo] Resposta recebida da DeepSeek. Tokens: ${response.usage?.total_tokens || 'N/A'}`);

      const content = response.choices[0]?.message?.content || '{}';
      this.logger.log(`[gerarResumoExecutivo] Conteúdo recebido. Tamanho: ${content.length} caracteres`);
      this.logger.debug(`[gerarResumoExecutivo] Primeiros 200 caracteres do conteúdo: ${content.substring(0, 200)}`);
      
      const usage = response.usage;
      if (gestorId && usuario && usage) {
        this.logger.log(`[gerarResumoExecutivo] Registrando uso de créditos. Input: ${usage.prompt_tokens}, Output: ${usage.completion_tokens}`);
        await this.creditoService.registrarUso({
          gestorId,
          usuarioId: usuario.id,
          provedor: ProvedorIa.DEEPSEEK,
          modelo: 'deepseek-chat',
          tokensInput: usage.prompt_tokens || 0,
          tokensOutput: usage.completion_tokens || 0,
          metodoChamado: 'gerarResumoExecutivo',
          contexto: `Resumo executivo: ${dadosAuditoria.unidade}`,
        });
        this.logger.log(`[gerarResumoExecutivo] Uso de créditos registrado`);
      }
      
      this.logger.log(`[gerarResumoExecutivo] Parseando JSON da resposta...`);
      try {
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const parsed = JSON.parse(cleanContent);
        this.logger.log(`[gerarResumoExecutivo] JSON parseado com sucesso`);
        this.logger.debug(`[gerarResumoExecutivo] Resumo gerado: ${JSON.stringify(parsed).substring(0, 200)}...`);
        return parsed;
      } catch (parseError) {
        this.logger.error(`[gerarResumoExecutivo] Erro ao fazer parse do JSON:`, parseError);
        this.logger.error(`[gerarResumoExecutivo] Conteúdo que falhou no parse: ${content.substring(0, 500)}`);
        const fallback = {
          resumo: `A auditoria da unidade ${dadosAuditoria.unidade} apresentou pontuação de ${typeof dadosAuditoria.pontuacaoTotal === 'number' ? dadosAuditoria.pontuacaoTotal.toFixed(2) : dadosAuditoria.pontuacaoTotal}%. Foram identificadas ${dadosAuditoria.itensNaoConformes.length} não conformidades que requerem atenção.`,
          pontosFortes: ['Análise em andamento'],
          pontosFracos: ['Análise em andamento'],
          recomendacoesPrioritarias: ['Revisar não conformidades identificadas'],
          riscoGeral: (() => {
            const pontuacao = typeof dadosAuditoria.pontuacaoTotal === 'number' 
              ? dadosAuditoria.pontuacaoTotal 
              : parseFloat(String(dadosAuditoria.pontuacaoTotal)) || 0;
            if (pontuacao >= 90) return 'baixo' as const;
            if (pontuacao >= 70) return 'medio' as const;
            if (pontuacao >= 50) return 'alto' as const;
            return 'critico' as const;
          })(),
          tendencias: ['Análise em andamento'],
        };
        this.logger.warn(`[gerarResumoExecutivo] Retornando resumo fallback devido a erro no parse`);
        return fallback;
      }
    } catch (error) {
      this.logger.error(`[gerarResumoExecutivo] Erro ao gerar resumo executivo:`, error);
      this.logger.error(`[gerarResumoExecutivo] Stack trace:`, error?.stack);
      this.logger.error(`[gerarResumoExecutivo] Dados da auditoria:`, JSON.stringify({
        unidade: dadosAuditoria.unidade,
        cliente: dadosAuditoria.cliente,
        pontuacaoTotal: dadosAuditoria.pontuacaoTotal,
        gruposCount: dadosAuditoria.grupos.length,
        naoConformesCount: dadosAuditoria.itensNaoConformes.length,
      }));
      throw error;
    }
  }
}

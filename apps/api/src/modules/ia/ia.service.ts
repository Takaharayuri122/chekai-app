import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { LegislacaoService } from '../legislacao/legislacao.service';

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
  private deepseekText: OpenAI;
  private openaiVision: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly legislacaoService: LegislacaoService,
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

    const response = await this.deepseekText.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
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
  ): Promise<{
    descricaoIa: string;
    tipoNaoConformidade: string;
    gravidade: 'baixa' | 'media' | 'alta' | 'critica';
    sugestoes: string[];
    referenciaLegal: string;
  }> {
    const contextoLegislacao = await this.legislacaoService.gerarContextoRag(
      `${perguntaChecklist} ${categoria} segurança alimentos`,
    );
    const prompt = `Você é um especialista em segurança de alimentos realizando uma auditoria.

ITEM DO CHECKLIST SENDO AVALIADO:
"${perguntaChecklist}"

CATEGORIA: ${categoria}
TIPO DE ESTABELECIMENTO: ${tipoEstabelecimento}

LEGISLAÇÃO RELEVANTE:
${contextoLegislacao}

Analise a imagem e, considerando o item do checklist acima, forneça:
1. Uma descrição detalhada do que foi observado na imagem em relação ao item
2. Se há não conformidade, identifique qual o tipo
3. A gravidade da situação
4. Sugestões de correção
5. Referência legal aplicável

Retorne APENAS um JSON válido (sem markdown, sem backticks) com:
- descricaoIa: descrição técnica detalhada do que foi observado na imagem, relacionando ao item do checklist
- tipoNaoConformidade: tipo identificado (ex: "armazenamento inadequado", "falta de identificação", "temperatura incorreta") ou "Nenhuma identificada"
- gravidade: "baixa", "media", "alta" ou "critica"
- sugestoes: array com 2-4 sugestões de correção específicas
- referenciaLegal: citação da legislação aplicável (ex: "RDC 216/2004, Art. 4.1.3")`;
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
      max_tokens: 1500,
    });
    const content = response.choices[0]?.message?.content || '{}';
    try {
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleanContent);
    } catch {
      return {
        descricaoIa: content,
        tipoNaoConformidade: 'Erro na análise',
        gravidade: 'media',
        sugestoes: ['Tente novamente com outra imagem'],
        referenciaLegal: 'Verificar legislação aplicável',
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

    const response = await this.deepseekText.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';
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
}

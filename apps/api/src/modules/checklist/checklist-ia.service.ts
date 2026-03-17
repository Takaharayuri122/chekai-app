import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { LegislacaoService } from '../legislacao/legislacao.service';
import { CreditoService } from '../credito/credito.service';
import { ChecklistService } from './checklist.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { ProvedorIa } from '../credito/entities/uso-credito.entity';
import { MensagemChatDto, RespostaConversaIa } from './dto/conversar-ia.dto';
import { CategoriaItem, CriticidadeItem } from './entities/template-item.entity';
import { TipoAtividade } from '../cliente/entities/cliente.entity';

interface ChecklistGeradoIa {
  nome: string;
  descricao: string;
  tipoAtividade: string;
  grupos: GrupoGeradoIa[];
}

interface GrupoGeradoIa {
  nome: string;
  descricao?: string;
  itens: ItemGeradoIa[];
}

interface ItemGeradoIa {
  pergunta: string;
  categoria: string;
  criticidade: string;
  peso: number;
  obrigatorio: boolean;
  legislacaoReferencia?: string;
  artigo?: string;
  textoLegal?: string;
  secao?: string;
}

type UsuarioIa = { id: string; perfil: PerfilUsuario; gestorId?: string | null };

/**
 * Serviço responsável pela geração de checklists via IA conversacional.
 * Fluxo em 2 fases: coleta conversacional e geração dedicada.
 */
@Injectable()
export class ChecklistIaService {
  private readonly logger = new Logger(ChecklistIaService.name);
  private deepseek: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly legislacaoService: LegislacaoService,
    private readonly creditoService: CreditoService,
    private readonly checklistService: ChecklistService,
  ) {
    const deepseekApiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    const deepseekBaseUrl = this.configService.get<string>(
      'DEEPSEEK_BASE_URL',
      'https://api.deepseek.com',
    );
    this.deepseek = new OpenAI({
      apiKey: deepseekApiKey,
      baseURL: deepseekBaseUrl,
    });
  }

  /**
   * Processa uma mensagem na conversa de geração de checklist via IA.
   */
  async processarMensagem(
    mensagens: MensagemChatDto[],
    usuario: UsuarioIa,
  ): Promise<RespostaConversaIa> {
    let gestorId: string | undefined;
    if (usuario.perfil !== PerfilUsuario.MASTER) {
      gestorId = this.creditoService.identificarGestorId(usuario);
      await this.creditoService.validarSaldoDisponivel(gestorId);
    }
    const ultimaMensagem = mensagens[mensagens.length - 1]?.conteudo?.toLowerCase() || '';
    const isConfirmacaoGeracao = this.detectarConfirmacaoGeracao(ultimaMensagem, mensagens);
    if (isConfirmacaoGeracao) {
      return this.executarGeracao(mensagens, usuario, gestorId);
    }
    return this.executarConversa(mensagens, usuario, gestorId);
  }

  private async executarConversa(
    mensagens: MensagemChatDto[],
    usuario: UsuarioIa,
    gestorId?: string,
  ): Promise<RespostaConversaIa> {
    const mensagensRecentes = this.limitarHistorico(mensagens, 12);
    const systemPrompt = this.construirPromptConversa();
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...mensagensRecentes.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.conteudo,
      })),
    ];
    this.logger.log(`[executarConversa] Enviando ${openaiMessages.length} msgs para DeepSeek`);
    const response = await this.deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: openaiMessages,
      max_tokens: 1000,
      temperature: 0.5,
    });
    const content = response.choices[0]?.message?.content || '';
    await this.registrarTokens(response.usage, usuario, gestorId, 'checklistIa.conversa');
    const respostaLimpa = content
      .replace(/<CHECKLIST_JSON>[\s\S]*?<\/CHECKLIST_JSON>/g, '')
      .replace(/<CHECKLIST_JSON>[\s\S]*/g, '')
      .trim();
    return {
      resposta: respostaLimpa || content.trim(),
      etapa: 'coletando_informacoes',
    };
  }

  private async executarGeracao(
    mensagens: MensagemChatDto[],
    usuario: UsuarioIa,
    gestorId?: string,
  ): Promise<RespostaConversaIa> {
    const resumoConversa = this.extrairResumoConversa(mensagens);
    const contextoLegislacao = await this.obterContextoRag(mensagens);
    const promptGeracao = this.construirPromptGeracao(resumoConversa, contextoLegislacao);
    this.logger.log(`[executarGeracao] Gerando checklist. Resumo: ${resumoConversa.substring(0, 200)}...`);
    const response = await this.deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: promptGeracao }],
      max_tokens: 8000,
      temperature: 0.3,
    });
    const content = response.choices[0]?.message?.content || '';
    await this.registrarTokens(response.usage, usuario, gestorId, 'checklistIa.geracao');
    try {
      const jsonStr = this.extrairJson(content);
      const checklistData: ChecklistGeradoIa = JSON.parse(jsonStr);
      const totalItens = checklistData.grupos.reduce((acc, g) => acc + g.itens.length, 0);
      const templateId = await this.criarChecklistAPartirDaIa(checklistData, usuario);
      return {
        resposta: `Checklist **"${checklistData.nome}"** criado com sucesso!\n\n` +
          `- **${checklistData.grupos.length}** grupos\n` +
          `- **${totalItens}** perguntas\n\n` +
          `Redirecionando para edição...`,
        etapa: 'finalizado',
        checklistGerado: { templateId },
      };
    } catch (err) {
      this.logger.error('[executarGeracao] Erro ao parsear/criar checklist', err);
      return {
        resposta: 'Ocorreu um erro ao gerar o checklist. Pode confirmar novamente que deseja gerar? Vou tentar mais uma vez.',
        etapa: 'coletando_informacoes',
      };
    }
  }

  private detectarConfirmacaoGeracao(ultimaMensagem: string, mensagens: MensagemChatDto[]): boolean {
    if (mensagens.length < 4) return false;
    const palavrasConfirmacao = [
      'sim', 'gerar', 'pode gerar', 'gera', 'vamos', 'pode ser',
      'confirmo', 'ok', 'beleza', 'vai lá', 'manda', 'prossiga',
      'prosseguir', 'avançar', 'continuar', 'bora', 'isso', 'certo',
      'exato', 'perfeito', 'gere', 'criar', 'cria', 'faz', 'faça',
    ];
    const temConfirmacao = palavrasConfirmacao.some((p) => ultimaMensagem.includes(p));
    const assistenteAnterior = [...mensagens]
      .reverse()
      .find((m) => m.role === 'assistant');
    const iaProposGeracao = assistenteAnterior?.conteudo?.toLowerCase().includes('gerar') ||
      assistenteAnterior?.conteudo?.toLowerCase().includes('pronto para') ||
      assistenteAnterior?.conteudo?.toLowerCase().includes('posso criar') ||
      assistenteAnterior?.conteudo?.toLowerCase().includes('deseja que eu') ||
      assistenteAnterior?.conteudo?.toLowerCase().includes('podemos prosseguir');
    return temConfirmacao && !!iaProposGeracao;
  }

  private extrairResumoConversa(mensagens: MensagemChatDto[]): string {
    return mensagens
      .map((m) => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.conteudo}`)
      .join('\n');
  }

  private limitarHistorico(mensagens: MensagemChatDto[], maxMensagens: number): MensagemChatDto[] {
    if (mensagens.length <= maxMensagens) return mensagens;
    return mensagens.slice(-maxMensagens);
  }

  private extrairJson(content: string): string {
    const tagMatch = content.match(/<CHECKLIST_JSON>([\s\S]*?)<\/CHECKLIST_JSON>/);
    if (tagMatch) {
      return tagMatch[1].replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }
    const jsonBlockMatch = content.match(/```json\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      return jsonBlockMatch[1].trim();
    }
    const braceMatch = content.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      return braceMatch[0].trim();
    }
    throw new Error('Nenhum JSON encontrado na resposta da IA');
  }

  private async obterContextoRag(mensagens: MensagemChatDto[]): Promise<string> {
    const textoUsuario = mensagens
      .filter((m) => m.role === 'user')
      .map((m) => m.conteudo)
      .slice(-3)
      .join(' ');
    if (!textoUsuario.trim()) return '';
    try {
      return await this.legislacaoService.gerarContextoRag(
        `${textoUsuario} segurança alimentos checklist auditoria`,
      );
    } catch {
      this.logger.warn('[obterContextoRag] Falha ao buscar contexto RAG');
      return '';
    }
  }

  private construirPromptConversa(): string {
    const categoriasDisponiveis = Object.values(CategoriaItem).join(', ');
    const tiposAtividade = Object.values(TipoAtividade).join(', ');

    return `Você é um assistente especialista em segurança de alimentos e auditorias sanitárias.
Ajude o usuário a definir um checklist de auditoria. Responda sempre em português brasileiro.

REGRAS:
1. Faça perguntas uma de cada vez, curtas e objetivas.
2. Siga estas etapas:
   - Tipo de estabelecimento (opções: ${tiposAtividade})
   - Objetivo/foco do checklist
   - Categorias de itens (opções: ${categoriasDisponiveis})
   - Nível de detalhe (quantidade de itens, técnico vs simplificado)
   - Requisitos específicos (legislação, itens obrigatórios)
3. Quando tiver informações suficientes, pergunte se o usuário quer gerar o checklist.
4. NÃO gere JSON. Apenas converse.
5. Respostas curtas (máx 150 palavras).
6. Use markdown para formatar (negrito, listas).

Comece se apresentando brevemente e fazendo a primeira pergunta.`;
  }

  private construirPromptGeracao(resumoConversa: string, contextoLegislacao: string): string {
    const categoriasDisponiveis = Object.values(CategoriaItem).join(', ');
    const criticidadesDisponiveis = Object.values(CriticidadeItem).join(', ');
    const tiposAtividade = Object.values(TipoAtividade).join(', ');

    return `Com base na conversa abaixo, gere um checklist de auditoria em JSON.

CONVERSA:
${resumoConversa}

${contextoLegislacao ? `LEGISLAÇÃO DE REFERÊNCIA:\n${contextoLegislacao}\n` : ''}
RETORNE APENAS JSON válido (sem markdown, sem texto antes/depois) neste formato:
{
  "nome": "Nome do Checklist",
  "descricao": "Descrição",
  "tipoAtividade": "valor do enum",
  "grupos": [
    {
      "nome": "Nome do Grupo",
      "descricao": "Descrição",
      "itens": [
        {
          "pergunta": "Pergunta?",
          "categoria": "valor do enum",
          "criticidade": "valor do enum",
          "peso": 1,
          "obrigatorio": true,
          "legislacaoReferencia": "RDC 216/2004",
          "artigo": "Art. X",
          "textoLegal": "Texto curto da lei"
        }
      ]
    }
  ]
}

REGRAS:
- Categorias: ${categoriasDisponiveis}
- Criticidades: ${criticidadesDisponiveis}
- Tipos: ${tiposAtividade}
- Peso: 1 a 5
- textoLegal: máximo 1 frase (economize tokens)
- Perguntas claras e objetivas
- Agrupe logicamente
- Use legislação quando possível
- APENAS o JSON, nada mais`;
  }

  private async registrarTokens(
    usage: OpenAI.CompletionUsage | undefined,
    usuario: UsuarioIa,
    gestorId: string | undefined,
    metodo: string,
  ): Promise<void> {
    if (!gestorId || !usage) return;
    await this.creditoService.registrarUso({
      gestorId,
      usuarioId: usuario.id,
      provedor: ProvedorIa.DEEPSEEK,
      modelo: 'deepseek-chat',
      tokensInput: usage.prompt_tokens || 0,
      tokensOutput: usage.completion_tokens || 0,
      metodoChamado: metodo,
      contexto: 'Geração de checklist via IA',
    });
  }

  private async criarChecklistAPartirDaIa(
    data: ChecklistGeradoIa,
    usuario: UsuarioIa,
  ): Promise<string> {
    const tipoAtividade = this.resolverTipoAtividade(data.tipoAtividade);
    const template = await this.checklistService.criarTemplate(
      {
        nome: data.nome,
        descricao: data.descricao,
        tipoAtividade,
        versao: '1.0',
      },
      { id: usuario.id, perfil: usuario.perfil },
    );
    for (let gIdx = 0; gIdx < data.grupos.length; gIdx++) {
      const grupoData = data.grupos[gIdx];
      const grupo = await this.checklistService.adicionarGrupo(
        template.id,
        { nome: grupoData.nome, descricao: grupoData.descricao, ordem: gIdx },
        usuario,
      );
      for (let iIdx = 0; iIdx < grupoData.itens.length; iIdx++) {
        const itemData = grupoData.itens[iIdx];
        await this.checklistService.adicionarItem(
          template.id,
          {
            pergunta: itemData.pergunta,
            categoria: this.resolverCategoria(itemData.categoria),
            criticidade: this.resolverCriticidade(itemData.criticidade),
            peso: itemData.peso ?? 1,
            obrigatorio: itemData.obrigatorio ?? true,
            legislacaoReferencia: itemData.legislacaoReferencia,
            artigo: itemData.artigo,
            textoLegal: itemData.textoLegal,
            grupoId: grupo.id,
            secao: itemData.secao,
            ordem: iIdx,
          },
          usuario,
        );
      }
    }
    this.logger.log(`[criarChecklistAPartirDaIa] Template ${template.id} criado com ${data.grupos.length} grupos`);
    return template.id;
  }

  private resolverTipoAtividade(valor: string): TipoAtividade {
    const normalizado = valor?.toLowerCase().trim();
    return Object.values(TipoAtividade).find((v) => v === normalizado) ?? TipoAtividade.OUTRO;
  }

  private resolverCategoria(valor: string): CategoriaItem {
    const normalizado = valor?.toLowerCase().trim();
    return Object.values(CategoriaItem).find((v) => v === normalizado) ?? CategoriaItem.OUTRO;
  }

  private resolverCriticidade(valor: string): CriticidadeItem {
    const normalizado = valor?.toLowerCase().trim();
    return Object.values(CriticidadeItem).find((v) => v === normalizado) ?? CriticidadeItem.MEDIA;
  }
}

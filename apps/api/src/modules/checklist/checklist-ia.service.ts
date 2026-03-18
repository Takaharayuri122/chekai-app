import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { LegislacaoService } from '../legislacao/legislacao.service';
import { CreditoService } from '../credito/credito.service';
import { ChecklistService } from './checklist.service';
import { PerfilUsuario } from '../usuario/entities/usuario.entity';
import { ProvedorIa } from '../credito/entities/uso-credito.entity';
import { MensagemChatDto, RespostaConversaIa } from './dto/conversar-ia.dto';
import { CategoriaItem, CriticidadeItem, TipoRespostaCustomizada } from './entities/template-item.entity';
import { TipoAtividade } from '../cliente/entities/cliente.entity';

interface OpcaoRespostaIa {
  valor: string;
  fotoObrigatoria: boolean;
  observacaoObrigatoria: boolean;
  pontuacao?: number | null;
}

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
  usarRespostasPersonalizadas?: boolean;
  tipoRespostaCustomizada?: string;
  opcoesResposta?: string[];
  opcoesRespostaConfig?: OpcaoRespostaIa[];
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
      'manda ver', 'tá ótimo', 'ta otimo', 'por mim tá', 'por mim ta',
      'pode mandar', 'fechou', 'show', 'top', 'tudo certo', 'concordo',
    ];
    const temConfirmacao = palavrasConfirmacao.some((p) => ultimaMensagem.includes(p));
    const assistenteAnterior = [...mensagens]
      .reverse()
      .find((m) => m.role === 'assistant');
    const textoAssistente = assistenteAnterior?.conteudo?.toLowerCase() || '';
    const indicadoresPropostaGeracao = [
      'gerar', 'pronto para', 'posso criar', 'deseja que eu',
      'podemos prosseguir', 'posso montar', 'monto pra você',
      'monto para você', 'resumo', 'entendi que', 'partimos para',
      'posso seguir', 'mãos à obra', 'começar a montar',
    ];
    const iaProposGeracao = indicadoresPropostaGeracao.some((ind) => textoAssistente.includes(ind));
    return temConfirmacao && iaProposGeracao;
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

    return `Você é a **Ana**, consultora de segurança alimentar com mais de 15 anos de experiência em auditorias sanitárias. Você trabalha dentro do sistema Metacheck e ajuda profissionais a criar checklists de auditoria sob medida.

PERSONALIDADE:
- Fale como uma colega de trabalho experiente que realmente entende do assunto — não como um robô.
- Seja direta, prática e acolhedora. Use um tom profissional mas leve, como quem conversa no dia a dia do trabalho.
- Demonstre que você entende o contexto: se alguém menciona "restaurante", já considere as legislações típicas (RDC 216, CVS-5, etc.) sem que precisem pedir.
- Evite respostas genéricas tipo "Claro! Como posso ajudar?". Em vez disso, já antecipe o que faz sentido perguntar com base no que já sabe.
- Quando o usuário responder algo vago, não repita a pergunta — interprete e sugira algo concreto para validar.

COMO CONDUZIR A CONVERSA:
1. Na primeira mensagem, se apresente brevemente (1 frase) e já faça a primeira pergunta relevante.
2. Colete as informações necessárias de forma natural, sem parecer um formulário:
   - Tipo de estabelecimento (${tiposAtividade})
   - O que precisa ser auditado e por quê (motivação real: fiscalização, controle interno, certificação, etc.)
   - Áreas/categorias de foco (${categoriasDisponiveis})
   - Nível de profundidade desejado
3. Em algum momento da conversa (quando fizer sentido, não como uma lista), explore estas configurações:
   - Se alguma pergunta precisa de **respostas personalizadas** (ex: "Bom/Regular/Ruim" ou "1 a 5") em vez das padrão (Conforme/Não Conforme/N.A./Não Avaliado). Se sim, quais opções.
   - Se determinadas perguntas devem **exigir foto** (ex: registrar evidência visual de uma não conformidade).
   - Se determinadas perguntas devem **exigir observação escrita** (ex: detalhar o que foi encontrado).
   - Sugira quando fizer sentido: "Em itens de higiene crítica, costuma ser útil exigir foto quando a resposta for Não Conforme. Quer que eu configure assim?"
4. Adapte suas perguntas com base nas respostas anteriores. Se o contexto já está claro, pule etapas e avance.
5. Use seu conhecimento para **sugerir ativamente**: "Para restaurante, costumo recomendar incluir controle de pragas e higiene de manipuladores. Faz sentido pra você?"
6. Quando sentir que tem informação suficiente, faça um **breve resumo** do que entendeu e pergunte se pode gerar.

FORMATO:
- Respostas curtas e conversacionais (máx 120 palavras).
- Use markdown (negrito, listas curtas) quando ajudar a clareza.
- NÃO gere JSON, código ou estruturas técnicas. Apenas converse.
- Sempre em português brasileiro.`;
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
          "textoLegal": "Texto curto da lei",
          "usarRespostasPersonalizadas": false,
          "tipoRespostaCustomizada": null,
          "opcoesResposta": null,
          "opcoesRespostaConfig": [
            { "valor": "conforme", "fotoObrigatoria": false, "observacaoObrigatoria": false },
            { "valor": "nao_conforme", "fotoObrigatoria": true, "observacaoObrigatoria": true },
            { "valor": "nao_aplicavel", "fotoObrigatoria": false, "observacaoObrigatoria": false },
            { "valor": "nao_avaliado", "fotoObrigatoria": false, "observacaoObrigatoria": false }
          ]
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

RESPOSTAS PADRÃO: conforme, nao_conforme, nao_aplicavel, nao_avaliado
- Se o item usar respostas padrão: "usarRespostasPersonalizadas": false, "opcoesResposta": null, "tipoRespostaCustomizada": null
- Se o item usar respostas personalizadas: "usarRespostasPersonalizadas": true, "tipoRespostaCustomizada": "select", "opcoesResposta": ["Opção A", "Opção B"]
- Tipos de resposta customizada: texto, numero, data, select

REGRAS DE FOTO E OBSERVAÇÃO (opcoesRespostaConfig):
- Para itens com criticidade "critica" ou "alta": configure fotoObrigatoria=true e observacaoObrigatoria=true na opção "nao_conforme"
- Para itens com criticidade "media": configure observacaoObrigatoria=true na opção "nao_conforme"
- Para itens com criticidade "baixa": ambos false
- Se o usuário pediu configuração específica de foto/observação na conversa, siga exatamente o que ele pediu
- Se usar respostas personalizadas, crie opcoesRespostaConfig para cada opção personalizada

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
            usarRespostasPersonalizadas: itemData.usarRespostasPersonalizadas ?? false,
            tipoRespostaCustomizada: this.resolverTipoResposta(itemData.tipoRespostaCustomizada),
            opcoesResposta: itemData.opcoesResposta ?? undefined,
            opcoesRespostaConfig: itemData.opcoesRespostaConfig ?? undefined,
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

  private resolverTipoResposta(valor?: string): TipoRespostaCustomizada | undefined {
    if (!valor) return undefined;
    const normalizado = valor.toLowerCase().trim();
    return Object.values(TipoRespostaCustomizada).find((v) => v === normalizado) ?? undefined;
  }
}

import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AgendaService } from '../../agenda/agenda.service';
import { StatusAgenda } from '../../agenda/entities/agenda-auditoria.entity';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ChecklistService } from '../../checklist/checklist.service';
import { StatusTemplate } from '../../checklist/entities/checklist-template.entity';
import { ClienteService } from '../../cliente/cliente.service';
import { StatusTarefaPlanoAcao } from '../../plano-acao/entities/plano-acao-tarefa.entity';
import { PlanoAcaoService } from '../../plano-acao/plano-acao.service';
import { StatusRelatorioTecnico } from '../../relatorio-tecnico/entities/relatorio-tecnico.entity';
import { RelatorioTecnicoService } from '../../relatorio-tecnico/relatorio-tecnico.service';
import { PerfilUsuario } from '../../usuario/entities/usuario.entity';
import { UsuarioService } from '../../usuario/usuario.service';
import { McpConfirmationService } from '../core/mcp-confirmation.service';
import { McpPrincipal, McpToolDefinition } from '../core/mcp.types';
import {
  mapearAgenda,
  mapearAuditoria,
  mapearChecklist,
  mapearCliente,
  mapearItemRespondido,
  mapearPagina,
  mapearRelatorio,
  mapearTarefa,
  mapearUnidade,
  mapearUsuario,
  paginar,
  resumirFinalizacaoAuditoria,
  resumirFinalizacaoRelatorio,
} from './mcp-tools.mappers';

const PERFIS = [PerfilUsuario.MASTER, PerfilUsuario.GESTOR, PerfilUsuario.AUDITOR];
const paginaSchema = {
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
};
const id = z.uuid();

const schemas = {
  vazio: z.object({}),
  listarClientes: z.object(paginaSchema),
  obterCliente: z.object({ clienteId: id }),
  listarUnidades: z.object({ ...paginaSchema, clienteId: id.optional() }),
  listarChecklists: z.object(paginaSchema),
  obterChecklist: z.object({ checklistId: id }),
  listarAuditorias: z.object({ ...paginaSchema, clienteId: id.optional() }),
  obterAuditoria: z.object({ auditoriaId: id }),
  iniciarAuditoria: z.object({
    unidadeId: id,
    templateId: id,
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  }),
  responderItem: z.object({
    auditoriaId: id,
    itemId: id,
    resposta: z.string().min(1),
    observacao: z.string().optional(),
    descricaoNaoConformidade: z.string().optional(),
    complementoDescricao: z.string().optional(),
    referenciaLegal: z.string().optional(),
  }),
  prepararAuditoria: z.object({ auditoriaId: id }),
  finalizarAuditoria: z.object({
    auditoriaId: id,
    confirmationToken: z.string().min(1),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    observacoesGerais: z.string().optional(),
  }),
  listarAgenda: z.object({
    ...paginaSchema,
    status: z.enum(StatusAgenda).optional(),
    responsavelId: id.optional(),
    de: z.iso.date().optional(),
    ate: z.iso.date().optional(),
  }),
  concluirAgenda: z.object({ agendamentoId: id }),
  listarTarefas: z.object({
    ...paginaSchema,
    status: z.enum(StatusTarefaPlanoAcao).optional(),
    responsavelId: id.optional(),
  }),
  criarTarefa: z.object({
    titulo: z.string().trim().min(1).max(200),
    descricao: z.string().optional(),
    responsavelId: id.optional(),
    auditoriaId: id.optional(),
    prazo: z.iso.date(),
  }),
  atualizarTarefa: z.object({
    tarefaId: id,
    titulo: z.string().trim().min(1).max(200).optional(),
    descricao: z.string().optional(),
    responsavelId: id.optional(),
    prazo: z.iso.date().optional(),
  }),
  tarefaId: z.object({ tarefaId: id }),
  listarRelatorios: z.object({
    ...paginaSchema,
    clienteId: id.optional(),
    status: z.enum(StatusRelatorioTecnico).optional(),
    dataInicio: z.iso.date().optional(),
    dataFim: z.iso.date().optional(),
  }),
  obterRelatorio: z.object({ relatorioId: id }),
  iniciarRelatorio: z.object({ clienteId: id, unidadeId: id }),
  atualizarRelatorio: z.object({
    relatorioId: id,
    clienteId: id.optional(),
    unidadeId: id.optional(),
    identificacao: z.string().optional(),
    descricaoOcorrenciaHtml: z.string().optional(),
    avaliacaoTecnicaHtml: z.string().optional(),
    acoesExecutadas: z.array(z.string()).max(100).optional(),
    recomendacoesConsultoraHtml: z.string().optional(),
    planoAcaoSugeridoHtml: z.string().optional(),
    assinaturaNomeConsultora: z.string().optional(),
    responsavel: z.string().optional(),
  }),
  prepararRelatorio: z.object({ relatorioId: id }),
  finalizarRelatorio: z.object({
    relatorioId: id,
    confirmationToken: z.string().min(1),
  }),
};

function somenteDefinidos<T extends Record<string, unknown>>(valor: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(valor).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}

@Injectable()
export class McpToolsService {
  constructor(
    private readonly usuarios: UsuarioService,
    private readonly clientes: ClienteService,
    private readonly checklists: ChecklistService,
    private readonly auditorias: AuditoriaService,
    private readonly agenda: AgendaService,
    private readonly planos: PlanoAcaoService,
    private readonly relatorios: RelatorioTecnicoService,
    private readonly confirmacao: McpConfirmationService,
  ) {}

  definicoes(): McpToolDefinition[] {
    const tool = (
      nome: string,
      descricao: string,
      scope: string,
      inputSchema: z.ZodType,
      handler: McpToolDefinition['handler'],
    ): McpToolDefinition => ({
      nome,
      descricao,
      scope,
      perfis: PERFIS,
      inputSchema,
      handler,
    });

    return [
      tool('chekai_me', 'Identificação da conta autenticada: id, nome, e-mail e perfil.', 'chekai:contexto', schemas.vazio, (input, quem) => this.me(input, quem)),
      tool('chekai_listar_clientes', 'Lista os clientes visíveis para a conta autenticada.', 'chekai:clientes:ler', schemas.listarClientes, (input, quem) => this.listarClientes(input, quem)),
      tool('chekai_obter_cliente', 'Obtém o resumo de um cliente visível para a conta autenticada.', 'chekai:clientes:ler', schemas.obterCliente, (input, quem) => this.obterCliente(input, quem)),
      tool('chekai_listar_unidades', 'Lista as unidades visíveis para a conta autenticada.', 'chekai:clientes:ler', schemas.listarUnidades, (input, quem) => this.listarUnidades(input, quem)),
      tool('chekai_listar_checklists', 'Lista os checklists visíveis para a conta autenticada.', 'chekai:checklists:ler', schemas.listarChecklists, (input, quem) => this.listarChecklists(input, quem)),
      tool('chekai_obter_checklist', 'Obtém um checklist visível para a conta autenticada.', 'chekai:checklists:ler', schemas.obterChecklist, (input, quem) => this.obterChecklist(input, quem)),
      tool('chekai_listar_auditorias', 'Lista as auditorias visíveis para a conta autenticada.', 'chekai:auditorias:ler', schemas.listarAuditorias, (input, quem) => this.listarAuditorias(input, quem)),
      tool('chekai_obter_auditoria', 'Obtém o resumo de uma auditoria visível para a conta autenticada.', 'chekai:auditorias:ler', schemas.obterAuditoria, (input, quem) => this.obterAuditoria(input, quem)),
      tool('chekai_iniciar_auditoria', 'Inicia uma auditoria na unidade e no checklist informados.', 'chekai:auditorias:escrever', schemas.iniciarAuditoria, (input, quem) => this.iniciarAuditoria(input, quem)),
      tool('chekai_responder_item', 'Grava a resposta de um item da auditoria.', 'chekai:auditorias:escrever', schemas.responderItem, (input, quem) => this.responderItem(input, quem)),
      tool('chekai_preparar_finalizacao', 'Resume a auditoria e emite um token para confirmar a finalização.', 'chekai:auditorias:finalizar', schemas.prepararAuditoria, (input, quem) => this.prepararAuditoria(input, quem)),
      tool('chekai_finalizar_auditoria', 'Finaliza a auditoria com o token de confirmação emitido na preparação.', 'chekai:auditorias:finalizar', schemas.finalizarAuditoria, (input, quem) => this.finalizarAuditoria(input, quem)),
      tool('chekai_listar_agenda', 'Lista os agendamentos visíveis para a conta autenticada.', 'chekai:agenda:ler', schemas.listarAgenda, (input, quem) => this.listarAgenda(input, quem)),
      tool('chekai_concluir_agendamento', 'Marca um agendamento visível como realizado.', 'chekai:agenda:concluir', schemas.concluirAgenda, (input, quem) => this.concluirAgenda(input, quem)),
      tool('chekai_listar_tarefas', 'Lista as tarefas do plano de ação visíveis para a conta autenticada.', 'chekai:tarefas:ler', schemas.listarTarefas, (input, quem) => this.listarTarefas(input, quem)),
      tool('chekai_criar_tarefa', 'Cria uma tarefa no plano de ação da conta autenticada.', 'chekai:tarefas:escrever', schemas.criarTarefa, (input, quem) => this.criarTarefa(input, quem)),
      tool('chekai_atualizar_tarefa', 'Atualiza título, descrição, responsável ou prazo de uma tarefa.', 'chekai:tarefas:escrever', schemas.atualizarTarefa, (input, quem) => this.atualizarTarefa(input, quem)),
      tool('chekai_concluir_tarefa', 'Marca uma tarefa visível como concluída.', 'chekai:tarefas:escrever', schemas.tarefaId, (input, quem) => this.concluirTarefa(input, quem)),
      tool('chekai_reabrir_tarefa', 'Reabre uma tarefa visível, voltando o status para pendente.', 'chekai:tarefas:escrever', schemas.tarefaId, (input, quem) => this.reabrirTarefa(input, quem)),
      tool('chekai_listar_relatorios', 'Lista os relatórios técnicos visíveis para a conta autenticada.', 'chekai:relatorios:ler', schemas.listarRelatorios, (input, quem) => this.listarRelatorios(input, quem)),
      tool('chekai_obter_relatorio', 'Obtém o conteúdo de um relatório técnico visível para a conta.', 'chekai:relatorios:ler', schemas.obterRelatorio, (input, quem) => this.obterRelatorio(input, quem)),
      tool('chekai_iniciar_relatorio', 'Abre um relatório técnico para o cliente e a unidade informados.', 'chekai:relatorios:escrever', schemas.iniciarRelatorio, (input, quem) => this.iniciarRelatorio(input, quem)),
      tool('chekai_atualizar_relatorio', 'Atualiza o conteúdo de um relatório técnico ainda não finalizado.', 'chekai:relatorios:escrever', schemas.atualizarRelatorio, (input, quem) => this.atualizarRelatorio(input, quem)),
      tool('chekai_preparar_finalizacao_relatorio', 'Resume o relatório e emite um token para confirmar a finalização.', 'chekai:relatorios:finalizar', schemas.prepararRelatorio, (input, quem) => this.prepararRelatorio(input, quem)),
      tool('chekai_finalizar_relatorio', 'Finaliza o relatório técnico com o token de confirmação emitido na preparação.', 'chekai:relatorios:finalizar', schemas.finalizarRelatorio, (input, quem) => this.finalizarRelatorio(input, quem)),
    ];
  }

  private usuario(principal: McpPrincipal) {
    return {
      id: principal.id,
      nome: principal.nome,
      email: principal.email,
      perfil: principal.perfil,
      gestorId: principal.gestorId,
    };
  }

  private ler<T>(schema: z.ZodType<T>, input: Record<string, unknown>): T {
    const resultado = schema.safeParse(input);
    if (!resultado.success) {
      throw new BadRequestException('Input inválido');
    }
    return resultado.data;
  }

  private paginacao(entrada: { page?: number; limit?: number }) {
    return { page: entrada.page ?? 1, limit: entrada.limit ?? 20 };
  }

  private async me(_input: Record<string, unknown>, principal: McpPrincipal) {
    const usuario = await this.usuarios.buscarPorId(principal.id);
    return mapearUsuario(usuario);
  }

  private async listarClientes(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.listarClientes, input);
    const pagina = await this.clientes.listarClientes(this.paginacao(entrada), this.usuario(principal));
    return mapearPagina(pagina, mapearCliente);
  }

  private async obterCliente(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.obterCliente, input);
    const cliente = await this.clientes.buscarClientePorId(entrada.clienteId, this.usuario(principal));
    return mapearCliente(cliente);
  }

  private async listarUnidades(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.listarUnidades, input);
    const { page, limit } = this.paginacao(entrada);
    const usuario = this.usuario(principal);
    const unidades = entrada.clienteId
      ? await this.unidadesDoCliente(entrada.clienteId, usuario)
      : await this.clientes.listarTodasUnidades(usuario);
    return paginar(unidades.map(mapearUnidade), page, limit);
  }

  private async unidadesDoCliente(
    clienteId: string,
    usuario: ReturnType<McpToolsService['usuario']>,
  ) {
    await this.clientes.buscarClientePorId(clienteId, usuario);
    return this.clientes.listarUnidadesPorCliente(clienteId);
  }

  private async listarChecklists(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.listarChecklists, input);
    const pagina = await this.checklists.listarTemplates(this.paginacao(entrada), this.usuario(principal));
    const itens = principal.perfil === PerfilUsuario.AUDITOR
      ? pagina.items.filter((template) => template.status === StatusTemplate.ATIVO)
      : pagina.items;
    return mapearPagina({ ...pagina, items: itens }, (template) => mapearChecklist(template, false));
  }

  private async obterChecklist(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.obterChecklist, input);
    const template = await this.checklists.buscarTemplatePorId(entrada.checklistId, this.usuario(principal));
    if (principal.perfil === PerfilUsuario.AUDITOR && template.status !== StatusTemplate.ATIVO) {
      throw new ForbiddenException('Checklist não disponível');
    }
    return mapearChecklist(template, true);
  }

  private async listarAuditorias(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.listarAuditorias, input);
    const pagina = await this.auditorias.listarAuditorias(
      this.paginacao(entrada),
      this.usuario(principal),
      entrada.clienteId,
    );
    return mapearPagina(pagina, (auditoria) => mapearAuditoria(auditoria, false));
  }

  private async obterAuditoria(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.obterAuditoria, input);
    const auditoria = await this.auditorias.buscarAuditoriaPorId(entrada.auditoriaId, this.usuario(principal));
    return mapearAuditoria(auditoria, true);
  }

  private async iniciarAuditoria(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.iniciarAuditoria, input);
    const auditoria = await this.auditorias.iniciarAuditoria(
      principal.id,
      {
        unidadeId: entrada.unidadeId,
        templateId: entrada.templateId,
        ...somenteDefinidos({
          latitude: entrada.latitude,
          longitude: entrada.longitude,
        }),
      },
      this.usuario(principal),
    );
    return mapearAuditoria(auditoria, true);
  }

  private async responderItem(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.responderItem, input);
    const item = await this.auditorias.responderItem(
      entrada.auditoriaId,
      entrada.itemId,
      {
        resposta: entrada.resposta,
        ...somenteDefinidos({
          observacao: entrada.observacao,
          descricaoNaoConformidade: entrada.descricaoNaoConformidade,
          complementoDescricao: entrada.complementoDescricao,
          referenciaLegal: entrada.referenciaLegal,
        }),
      },
      this.usuario(principal),
    );
    return mapearItemRespondido(item);
  }

  private async prepararAuditoria(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.prepararAuditoria, input);
    const auditoria = await this.auditorias.buscarAuditoriaPorId(entrada.auditoriaId, this.usuario(principal));
    return this.confirmacao.preparar({
      usuarioId: principal.id,
      acao: 'finalizar_auditoria',
      recursoId: auditoria.id,
      resumo: resumirFinalizacaoAuditoria(auditoria),
    });
  }

  private async finalizarAuditoria(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.finalizarAuditoria, input);
    this.confirmacao.consumir(entrada.confirmationToken, {
      usuarioId: principal.id,
      acao: 'finalizar_auditoria',
      recursoId: entrada.auditoriaId,
    });
    const auditoria = await this.auditorias.finalizarAuditoria(
      entrada.auditoriaId,
      somenteDefinidos({
        latitude: entrada.latitude,
        longitude: entrada.longitude,
        observacoesGerais: entrada.observacoesGerais,
      }),
      this.usuario(principal),
    );
    return mapearAuditoria(auditoria, true);
  }

  private async listarAgenda(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.listarAgenda, input);
    const pagina = await this.agenda.listar(
      {
        ...this.paginacao(entrada),
        ...somenteDefinidos({
          status: entrada.status,
          responsavelId: entrada.responsavelId,
          de: entrada.de,
          ate: entrada.ate,
        }),
      },
      this.usuario(principal),
    );
    return mapearPagina(pagina, mapearAgenda);
  }

  private async concluirAgenda(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.concluirAgenda, input);
    const agenda = await this.agenda.concluir(entrada.agendamentoId, this.usuario(principal));
    return mapearAgenda(agenda);
  }

  private async listarTarefas(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.listarTarefas, input);
    const pagina = await this.planos.listar(
      {
        ...this.paginacao(entrada),
        ...somenteDefinidos({
          status: entrada.status,
          responsavelId: entrada.responsavelId,
        }),
      },
      this.usuario(principal),
    );
    return mapearPagina(pagina, mapearTarefa);
  }

  private async criarTarefa(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.criarTarefa, input);
    const tarefa = await this.planos.criar(
      somenteDefinidos({
        titulo: entrada.titulo,
        descricao: entrada.descricao,
        responsavelId: entrada.responsavelId,
        auditoriaId: entrada.auditoriaId,
        prazo: entrada.prazo,
      }) as { titulo: string; prazo: string },
      this.usuario(principal),
    );
    return mapearTarefa(tarefa);
  }

  private async atualizarTarefa(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.atualizarTarefa, input);
    const tarefa = await this.planos.atualizar(
      entrada.tarefaId,
      somenteDefinidos({
        titulo: entrada.titulo,
        descricao: entrada.descricao,
        responsavelId: entrada.responsavelId,
        prazo: entrada.prazo,
      }),
      this.usuario(principal),
    );
    return mapearTarefa(tarefa);
  }

  private async concluirTarefa(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.tarefaId, input);
    const tarefa = await this.planos.atualizar(
      entrada.tarefaId,
      { status: StatusTarefaPlanoAcao.CONCLUIDA },
      this.usuario(principal),
    );
    return mapearTarefa(tarefa);
  }

  private async reabrirTarefa(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.tarefaId, input);
    const tarefa = await this.planos.atualizar(
      entrada.tarefaId,
      { status: StatusTarefaPlanoAcao.PENDENTE },
      this.usuario(principal),
    );
    return mapearTarefa(tarefa);
  }

  private async listarRelatorios(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.listarRelatorios, input);
    const pagina = await this.relatorios.listar(
      {
        ...this.paginacao(entrada),
        ...somenteDefinidos({
          clienteId: entrada.clienteId,
          status: entrada.status,
          dataInicio: entrada.dataInicio,
          dataFim: entrada.dataFim,
        }),
      },
      this.usuario(principal),
    );
    return mapearPagina(pagina, (relatorio) => mapearRelatorio(relatorio, false));
  }

  private async obterRelatorio(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.obterRelatorio, input);
    const relatorio = await this.relatorios.buscarPorId(entrada.relatorioId, this.usuario(principal));
    return mapearRelatorio(relatorio, true);
  }

  private async iniciarRelatorio(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.iniciarRelatorio, input);
    const relatorio = await this.relatorios.iniciar(
      { clienteId: entrada.clienteId, unidadeId: entrada.unidadeId },
      this.usuario(principal),
    );
    return mapearRelatorio(relatorio, true);
  }

  private async atualizarRelatorio(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.atualizarRelatorio, input);
    const relatorio = await this.relatorios.atualizar(
      entrada.relatorioId,
      somenteDefinidos({
        clienteId: entrada.clienteId,
        unidadeId: entrada.unidadeId,
        identificacao: entrada.identificacao,
        descricaoOcorrenciaHtml: entrada.descricaoOcorrenciaHtml,
        avaliacaoTecnicaHtml: entrada.avaliacaoTecnicaHtml,
        acoesExecutadas: entrada.acoesExecutadas,
        recomendacoesConsultoraHtml: entrada.recomendacoesConsultoraHtml,
        planoAcaoSugeridoHtml: entrada.planoAcaoSugeridoHtml,
        assinaturaNomeConsultora: entrada.assinaturaNomeConsultora,
        responsavel: entrada.responsavel,
      }),
      this.usuario(principal),
    );
    return mapearRelatorio(relatorio, true);
  }

  private async prepararRelatorio(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.prepararRelatorio, input);
    const relatorio = await this.relatorios.buscarPorId(entrada.relatorioId, this.usuario(principal));
    return this.confirmacao.preparar({
      usuarioId: principal.id,
      acao: 'finalizar_relatorio',
      recursoId: relatorio.id,
      resumo: resumirFinalizacaoRelatorio(relatorio),
    });
  }

  private async finalizarRelatorio(input: Record<string, unknown>, principal: McpPrincipal) {
    const entrada = this.ler(schemas.finalizarRelatorio, input);
    this.confirmacao.consumir(entrada.confirmationToken, {
      usuarioId: principal.id,
      acao: 'finalizar_relatorio',
      recursoId: entrada.relatorioId,
    });
    const relatorio = await this.relatorios.atualizar(
      entrada.relatorioId,
      { status: StatusRelatorioTecnico.FINALIZADO },
      this.usuario(principal),
    );
    return mapearRelatorio(relatorio, true);
  }
}

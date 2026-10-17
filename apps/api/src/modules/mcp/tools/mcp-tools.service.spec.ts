import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { PerfilUsuario } from '../../usuario/entities/usuario.entity';
import { StatusTarefaPlanoAcao } from '../../plano-acao/entities/plano-acao-tarefa.entity';
import { StatusRelatorioTecnico } from '../../relatorio-tecnico/entities/relatorio-tecnico.entity';
import { McpConfirmationService } from '../core/mcp-confirmation.service';
import { McpRegistryService, MCP_TOOL_DEFINITIONS } from '../core/mcp-registry.service';
import { MCP_TOOLS_PRIMEIRA_ONDA, McpPrincipal } from '../core/mcp.types';
import { AgendaModule } from '../../agenda/agenda.module';
import { AgendaService } from '../../agenda/agenda.service';
import { AuditoriaModule } from '../../auditoria/auditoria.module';
import { ChecklistModule } from '../../checklist/checklist.module';
import { ClienteModule } from '../../cliente/cliente.module';
import { PlanoAcaoModule } from '../../plano-acao/plano-acao.module';
import { PlanoAcaoService } from '../../plano-acao/plano-acao.service';
import { RelatorioTecnicoModule } from '../../relatorio-tecnico/relatorio-tecnico.module';
import { McpModule } from '../mcp.module';
import { McpToolsService } from './mcp-tools.service';

const SCOPES = [
  'chekai:contexto',
  'chekai:clientes:ler',
  'chekai:checklists:ler',
  'chekai:auditorias:ler',
  'chekai:auditorias:escrever',
  'chekai:auditorias:finalizar',
  'chekai:agenda:ler',
  'chekai:agenda:concluir',
  'chekai:tarefas:ler',
  'chekai:tarefas:escrever',
  'chekai:relatorios:ler',
  'chekai:relatorios:escrever',
  'chekai:relatorios:finalizar',
];

const ESCOPO_POR_TOOL: Record<string, string> = {
  chekai_me: 'chekai:contexto',
  chekai_listar_clientes: 'chekai:clientes:ler',
  chekai_obter_cliente: 'chekai:clientes:ler',
  chekai_listar_unidades: 'chekai:clientes:ler',
  chekai_listar_checklists: 'chekai:checklists:ler',
  chekai_obter_checklist: 'chekai:checklists:ler',
  chekai_listar_auditorias: 'chekai:auditorias:ler',
  chekai_obter_auditoria: 'chekai:auditorias:ler',
  chekai_iniciar_auditoria: 'chekai:auditorias:escrever',
  chekai_responder_item: 'chekai:auditorias:escrever',
  chekai_preparar_finalizacao: 'chekai:auditorias:finalizar',
  chekai_finalizar_auditoria: 'chekai:auditorias:finalizar',
  chekai_listar_agenda: 'chekai:agenda:ler',
  chekai_concluir_agendamento: 'chekai:agenda:concluir',
  chekai_listar_tarefas: 'chekai:tarefas:ler',
  chekai_criar_tarefa: 'chekai:tarefas:escrever',
  chekai_atualizar_tarefa: 'chekai:tarefas:escrever',
  chekai_concluir_tarefa: 'chekai:tarefas:escrever',
  chekai_reabrir_tarefa: 'chekai:tarefas:escrever',
  chekai_listar_relatorios: 'chekai:relatorios:ler',
  chekai_obter_relatorio: 'chekai:relatorios:ler',
  chekai_iniciar_relatorio: 'chekai:relatorios:escrever',
  chekai_atualizar_relatorio: 'chekai:relatorios:escrever',
  chekai_preparar_finalizacao_relatorio: 'chekai:relatorios:finalizar',
  chekai_finalizar_relatorio: 'chekai:relatorios:finalizar',
};

const principal: McpPrincipal = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  nome: 'Ana Gestora',
  email: 'ana@chekai.com',
  perfil: PerfilUsuario.GESTOR,
  gestorId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  tenantId: 'tenant-do-token',
  scopes: SCOPES,
};

const auditor: McpPrincipal = {
  ...principal,
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  nome: 'Bruno Auditor',
  email: 'bruno@chekai.com',
  perfil: PerfilUsuario.AUDITOR,
  gestorId: principal.id,
};

const usuarioDo = (quem: McpPrincipal) => ({
  id: quem.id,
  nome: quem.nome,
  email: quem.email,
  perfil: quem.perfil,
  gestorId: quem.gestorId,
});

const clienteId = '11111111-1111-4111-8111-111111111111';
const unidadeId = '22222222-2222-4222-8222-222222222222';
const templateId = '33333333-3333-4333-8333-333333333333';
const auditoriaId = '44444444-4444-4444-8444-444444444444';
const itemId = '55555555-5555-4555-8555-555555555555';
const agendaId = '66666666-6666-4666-8666-666666666666';
const tarefaId = '77777777-7777-4777-8777-777777777777';
const relatorioId = '88888888-8888-4888-8888-888888888888';
const templateItemId = '99999999-9999-4999-8999-999999999999';

function pagina<T>(items: T[], extra: Partial<{
  total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrevious: boolean;
}> = {}) {
  return {
    items,
    total: extra.total ?? items.length,
    page: extra.page ?? 1,
    limit: extra.limit ?? 20,
    totalPages: extra.totalPages ?? 1,
    hasNext: extra.hasNext ?? false,
    hasPrevious: extra.hasPrevious ?? false,
  };
}

function criar() {
  const usuarios = { buscarPorId: jest.fn() };
  const clientes = {
    listarClientes: jest.fn(),
    buscarClientePorId: jest.fn(),
    listarTodasUnidades: jest.fn(),
    listarUnidadesPorCliente: jest.fn(),
  };
  const checklists = { listarTemplates: jest.fn(), buscarTemplatePorId: jest.fn() };
  const auditorias = {
    listarAuditorias: jest.fn(),
    buscarAuditoriaPorId: jest.fn(),
    iniciarAuditoria: jest.fn(),
    responderItem: jest.fn(),
    finalizarAuditoria: jest.fn(),
  };
  const agenda = { listar: jest.fn(), concluir: jest.fn() };
  const planos = { listar: jest.fn(), criar: jest.fn(), atualizar: jest.fn() };
  const relatorios = {
    listar: jest.fn(),
    buscarPorId: jest.fn(),
    iniciar: jest.fn(),
    atualizar: jest.fn(),
  };
  let sequencia = 0;
  const confirmacao = new McpConfirmationService(
    { agora: () => new Date('2026-01-01T00:00:00.000Z') },
    { opaco: () => `token-${++sequencia}` },
  );
  const service = new McpToolsService(
    usuarios as never,
    clientes as never,
    checklists as never,
    auditorias as never,
    agenda as never,
    planos as never,
    relatorios as never,
    confirmacao,
  );
  const registry = new McpRegistryService(service.definicoes());
  return {
    service, registry, usuarios, clientes, checklists, auditorias, agenda, planos, relatorios, confirmacao,
  };
}

async function chamar(
  registry: McpRegistryService,
  nome: string,
  input: Record<string, unknown> = {},
  quem: McpPrincipal = principal,
) {
  return registry.executar(nome, input, quem);
}

describe('UC-03: tools da primeira onda', () => {
  it('registra exatamente as 25 tools, com scope e os três perfis', () => {
    const { service, registry } = criar();
    const definicoes = service.definicoes();

    expect(definicoes.map((tool) => tool.nome)).toEqual([...MCP_TOOLS_PRIMEIRA_ONDA]);
    expect(definicoes).toHaveLength(25);
    for (const tool of definicoes) {
      expect(tool.scope).toBe(ESCOPO_POR_TOOL[tool.nome]);
      expect(tool.descricao.trim().length).toBeGreaterThan(10);
      expect(tool.perfis).toEqual([
        PerfilUsuario.MASTER,
        PerfilUsuario.GESTOR,
        PerfilUsuario.AUDITOR,
      ]);
      expect(tool.inputSchema).toBeDefined();
      expect(typeof (tool.inputSchema as { safeParse?: unknown }).safeParse).toBe('function');
    }
    expect(registry.listar(principal).map((tool) => tool.nome)).toEqual([...MCP_TOOLS_PRIMEIRA_ONDA]);
  });

  it('não oferece agenda administrativa, reabertura, remoção nem capacidade fora da onda', async () => {
    const { registry, clientes } = criar();
    const nomes = registry.listar(principal).map((tool) => tool.nome);
    for (const nome of [
      'chekai_criar_agendamento',
      'chekai_editar_agendamento',
      'chekai_cancelar_agendamento',
      'chekai_remover_agendamento',
      'chekai_reabrir_auditoria',
      'chekai_remover_tarefa',
      'chekai_convites',
      'chekai_planos',
    ]) {
      expect(nomes).not.toContain(nome);
      await expect(chamar(registry, nome, {})).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(clientes.listarClientes).not.toHaveBeenCalled();
  });

  it('rejeita gestorId, tenantId e consultorId antes do service', async () => {
    const { registry, clientes } = criar();
    for (const campo of ['gestorId', 'tenantId', 'consultorId']) {
      await expect(chamar(registry, 'chekai_listar_clientes', { filtro: { [campo]: 'outro' } }))
        .rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(clientes.listarClientes).not.toHaveBeenCalled();
  });

  it('não chama o service quando o scope não alcança a tool', async () => {
    const { registry, clientes } = criar();
    await expect(chamar(registry, 'chekai_listar_clientes', {}, { ...principal, scopes: ['chekai:contexto'] }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(clientes.listarClientes).not.toHaveBeenCalled();
  });
});

describe('UC-04: contexto, clientes e checklists', () => {
  it('chekai_me devolve só id, nome, e-mail e perfil do usuário lido pelo service', async () => {
    const { registry, usuarios } = criar();
    usuarios.buscarPorId.mockResolvedValue({
      id: principal.id,
      nome: principal.nome,
      email: principal.email,
      perfil: principal.perfil,
      senhaHash: 'segredo-hash',
      otpCode: '252622',
      tokenConvite: 'convite-secreto',
      gestorId: 'gestor-alheio',
      tenantId: 'tenant-alheio',
      logoUrl: 'https://arquivos/logo-secreto.png',
    });

    await expect(chamar(registry, 'chekai_me')).resolves.toEqual({
      id: principal.id,
      nome: principal.nome,
      email: principal.email,
      perfil: principal.perfil,
    });
    expect(usuarios.buscarPorId).toHaveBeenCalledWith(principal.id);
  });

  it('lista e obtém cliente como resumo, com o principal e sem entidade crua', async () => {
    const { registry, clientes } = criar();
    const bruto = {
      id: clienteId,
      razaoSocial: 'Padaria Sul',
      nomeFantasia: 'Sul',
      cnpj: '00000000000100',
      email: 'contato@sul.com',
      telefone: '11999999999',
      tipoAtividade: 'padaria',
      ativo: true,
      gestorId: 'gestor-secreto',
      tenantId: 'tenant-secreto',
      logoUrl: 'https://arquivos/logo-secreto.png',
      gestor: { senhaHash: 'hash-gestor', otpCode: '999999' },
      auditores: [{ senhaHash: 'hash-auditor', tokenConvite: 'convite' }],
      unidades: [{ id: unidadeId, nome: 'Matriz' }],
    };
    const resumo = {
      id: clienteId,
      razaoSocial: 'Padaria Sul',
      nomeFantasia: 'Sul',
      cnpj: '00000000000100',
      email: 'contato@sul.com',
      telefone: '11999999999',
      tipoAtividade: 'padaria',
      ativo: true,
    };
    clientes.listarClientes.mockResolvedValue(pagina([bruto], {
      total: 30, page: 2, limit: 10, totalPages: 3, hasNext: true, hasPrevious: true,
    }));
    clientes.buscarClientePorId.mockResolvedValue(bruto);

    await expect(chamar(registry, 'chekai_listar_clientes', { page: 2, limit: 10 })).resolves.toEqual({
      items: [resumo],
      total: 30,
      page: 2,
      limit: 10,
      totalPages: 3,
      hasNext: true,
      hasPrevious: true,
    });
    expect(clientes.listarClientes).toHaveBeenCalledWith({ page: 2, limit: 10 }, usuarioDo(principal));
    await expect(chamar(registry, 'chekai_obter_cliente', { clienteId })).resolves.toEqual(resumo);
    expect(clientes.buscarClientePorId).toHaveBeenCalledWith(clienteId, usuarioDo(principal));
  });

  it('lista unidades pelo isolamento do service e pagina o resumo', async () => {
    const { registry, clientes } = criar();
    const bruta = {
      id: unidadeId,
      nome: 'Matriz',
      endereco: 'Rua 1',
      cidade: 'Campinas',
      estado: 'SP',
      clienteId,
      ativo: true,
      email: 'unidade@secreto.com',
      latitude: -22.9,
      auditores: [{ senhaHash: 'hash', otpCode: '111111' }],
      cliente: { gestorId: 'outro', logoUrl: 'https://arquivos/logo-secreto.png' },
    };
    const resumo = {
      id: unidadeId,
      nome: 'Matriz',
      endereco: 'Rua 1',
      cidade: 'Campinas',
      estado: 'SP',
      clienteId,
      ativo: true,
    };
    clientes.listarTodasUnidades.mockResolvedValue([bruta, { ...bruta, id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }, bruta]);

    const pagina2 = await chamar(registry, 'chekai_listar_unidades', { page: 2, limit: 1 });
    expect(pagina2).toMatchObject({ total: 3, page: 2, limit: 1, totalPages: 3 });
    expect((pagina2 as { items: unknown[] }).items).toEqual([{
      ...resumo,
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    }]);
    expect(JSON.stringify(pagina2)).not.toContain('logo-secreto');
    expect(JSON.stringify(pagina2)).not.toContain('senhaHash');
    expect(clientes.listarTodasUnidades).toHaveBeenCalledWith(usuarioDo(principal));

    clientes.buscarClientePorId.mockResolvedValue({ id: clienteId });
    clientes.listarUnidadesPorCliente.mockResolvedValue([bruta]);
    await expect(chamar(registry, 'chekai_listar_unidades', { clienteId })).resolves.toMatchObject({
      items: [resumo],
      total: 1,
    });
    expect(clientes.buscarClientePorId).toHaveBeenCalledWith(clienteId, usuarioDo(principal));
    expect(clientes.listarUnidadesPorCliente).toHaveBeenCalledWith(clienteId);
  });

  it('entrega ao auditor só checklist ativo e esconde template inativo', async () => {
    const { registry, checklists } = criar();
    const ativo = {
      id: templateId,
      nome: 'Boas práticas',
      descricao: 'Higiene',
      tipoAtividade: 'restaurante',
      versao: '1.0',
      status: 'ativo',
      gestorId: principal.id,
      gestor: { senhaHash: 'hash-gestor' },
    };
    const inativo = {
      ...ativo,
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      nome: 'Rascunho oculto',
      status: 'inativo',
      senhaHash: 'segredo-checklist',
    };
    checklists.listarTemplates.mockResolvedValue(pagina([inativo, ativo]));
    checklists.buscarTemplatePorId.mockResolvedValue({
      ...inativo,
      itens: [{ id: templateItemId, pergunta: 'Pia', ordem: 1, obrigatorio: true, grupoId: null, opcoesResposta: ['conforme'] }],
      grupos: [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', nome: 'Estrutura', ordem: 0 }],
    });

    const lista = await chamar(registry, 'chekai_listar_checklists', {}, auditor);
    expect(lista).toMatchObject({
      items: [{
        id: templateId,
        nome: 'Boas práticas',
        descricao: 'Higiene',
        tipoAtividade: 'restaurante',
        versao: '1.0',
        status: 'ativo',
      }],
    });
    expect(JSON.stringify(lista)).not.toContain('segredo-checklist');
    expect(JSON.stringify(lista)).not.toContain('Rascunho oculto');
    expect(checklists.listarTemplates).toHaveBeenCalledWith({ page: 1, limit: 20 }, usuarioDo(auditor));

    await expect(chamar(registry, 'chekai_obter_checklist', { checklistId: inativo.id }, auditor))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(chamar(registry, 'chekai_obter_checklist', { checklistId: inativo.id }, auditor))
      .rejects.toThrow('Checklist não disponível');
  });

  it('permite ao gestor ler checklist inativo, só com o resumo', async () => {
    const { registry, checklists } = criar();
    checklists.buscarTemplatePorId.mockResolvedValue({
      id: templateId,
      nome: 'Rascunho',
      descricao: null,
      tipoAtividade: 'outro',
      versao: '1.0',
      status: 'inativo',
      gestorId: 'nao-expor',
      gestor: { otpCode: '252622' },
      grupos: [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', nome: 'Estrutura', ordem: 0, template: { senhaHash: 'x' } }],
      itens: [{
        id: templateItemId,
        pergunta: 'Pia',
        ordem: 1,
        obrigatorio: true,
        grupoId: null,
        opcoesResposta: ['conforme', 'nao_conforme'],
        textoLegal: 'artigo secreto',
        fotos: [{ url: 'https://arquivos/foto-secreta.jpg' }],
      }],
    });

    await expect(chamar(registry, 'chekai_obter_checklist', { checklistId: templateId })).resolves.toEqual({
      id: templateId,
      nome: 'Rascunho',
      descricao: null,
      tipoAtividade: 'outro',
      versao: '1.0',
      status: 'inativo',
      grupos: [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', nome: 'Estrutura', ordem: 0 }],
      itens: [{
        id: templateItemId,
        pergunta: 'Pia',
        ordem: 1,
        obrigatorio: true,
        grupoId: null,
        opcoesResposta: ['conforme', 'nao_conforme'],
      }],
    });
    expect(checklists.buscarTemplatePorId).toHaveBeenCalledWith(templateId, usuarioDo(principal));
  });
});

describe('UC-05: auditorias e confirmação', () => {
  const detalheBruto = () => ({
    id: auditoriaId,
    status: 'em_andamento',
    unidadeId,
    templateId,
    consultorId: principal.id,
    dataInicio: new Date('2026-03-01T12:00:00.000Z'),
    dataFim: null,
    pontuacaoTotal: null,
    observacoesGerais: null,
    pdfUrl: 'https://arquivos/auditoria-secreta.pdf',
    resumoExecutivo: { resumo: 'texto-ia-secreto' },
    itens: [{
      id: itemId,
      templateItemId,
      resposta: 'conforme',
      observacao: null,
      pontuacao: 10,
      descricaoIa: 'ia-secreta',
      fotos: [{ url: 'https://arquivos/foto-secreta.jpg' }],
    }],
  });

  const detalheResumo = {
    id: auditoriaId,
    status: 'em_andamento',
    unidadeId,
    templateId,
    consultorId: principal.id,
    dataInicio: '2026-03-01T12:00:00.000Z',
    dataFim: null,
    pontuacaoTotal: null,
    observacoesGerais: null,
    itens: [{
      id: itemId,
      templateItemId,
      resposta: 'conforme',
      observacao: null,
      pontuacao: 10,
    }],
  };

  it('lista e obtém auditoria sem pdf, foto ou resumo de IA', async () => {
    const { registry, auditorias } = criar();
    auditorias.listarAuditorias.mockResolvedValue(pagina([detalheBruto()]));
    auditorias.buscarAuditoriaPorId.mockResolvedValue(detalheBruto());

    const lista = await chamar(registry, 'chekai_listar_auditorias', { clienteId, page: 1, limit: 20 });
    expect(lista).toEqual(pagina([{
      id: auditoriaId,
      status: 'em_andamento',
      unidadeId,
      templateId,
      consultorId: principal.id,
      dataInicio: '2026-03-01T12:00:00.000Z',
      dataFim: null,
      pontuacaoTotal: null,
    }]));
    expect(JSON.stringify(lista)).not.toContain('auditoria-secreta');
    expect(auditorias.listarAuditorias).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      usuarioDo(principal),
      clienteId,
    );
    await expect(chamar(registry, 'chekai_obter_auditoria', { auditoriaId })).resolves.toEqual(detalheResumo);
    expect(auditorias.buscarAuditoriaPorId).toHaveBeenCalledWith(auditoriaId, usuarioDo(principal));
  });

  it('inicia e responde com o usuário autenticado, sem campos de IA', async () => {
    const { registry, auditorias } = criar();
    auditorias.iniciarAuditoria.mockResolvedValue(detalheBruto());
    auditorias.responderItem.mockResolvedValue(detalheBruto().itens[0]);

    await expect(chamar(registry, 'chekai_iniciar_auditoria', {
      unidadeId,
      templateId,
      latitude: -22.9,
    })).resolves.toEqual(detalheResumo);
    expect(auditorias.iniciarAuditoria).toHaveBeenCalledWith(
      principal.id,
      { unidadeId, templateId, latitude: -22.9 },
      usuarioDo(principal),
    );

    await expect(chamar(registry, 'chekai_responder_item', {
      auditoriaId,
      itemId,
      resposta: 'conforme',
      observacao: 'ok',
      descricaoIa: 'nao-enviar',
      planoAcaoSugerido: 'nao-enviar',
    })).resolves.toEqual(detalheResumo.itens[0]);
    expect(auditorias.responderItem).toHaveBeenCalledWith(
      auditoriaId,
      itemId,
      { resposta: 'conforme', observacao: 'ok' },
      usuarioDo(principal),
    );
  });

  it('prepara a finalização lendo a auditoria isolada e sem finalizar', async () => {
    const { registry, auditorias } = criar();
    auditorias.buscarAuditoriaPorId.mockResolvedValue({
      ...detalheBruto(),
      itens: [
        { id: itemId, resposta: 'nao_avaliado', templateItem: { obrigatorio: true }, fotos: [{ url: 'https://arquivos/foto-secreta.jpg' }] },
        { id: 'abababab-abab-4aba-8aba-abababababab', resposta: 'conforme', templateItem: { obrigatorio: true } },
        { id: 'cdcdcdcd-cdcd-4cdc-8cdc-cdcdcdcdcdcd', resposta: 'nao_avaliado', templateItem: { obrigatorio: false } },
        { id: 'efefefef-efef-4efe-8efe-efefefefefef', resposta: '', templateItem: { obrigatorio: true } },
      ],
    });

    const preparada = await chamar(registry, 'chekai_preparar_finalizacao', { auditoriaId });
    expect(preparada).toEqual({
      token: 'token-1',
      expiraEm: '2026-01-01T00:10:00.000Z',
      resumo: {
        auditoriaId,
        status: 'em_andamento',
        obrigatoriosPendentes: 2,
        itensPendentes: [itemId, 'efefefef-efef-4efe-8efe-efefefefefef'],
        prontaParaFinalizar: false,
      },
    });
    expect(JSON.stringify(preparada)).not.toContain('foto-secreta');
    expect(JSON.stringify(preparada)).not.toContain('auditoria-secreta');
    expect(auditorias.buscarAuditoriaPorId).toHaveBeenCalledWith(auditoriaId, usuarioDo(principal));
    expect(auditorias.finalizarAuditoria).not.toHaveBeenCalled();
  });

  it('consome o token antes de finalizar e não reaproveita se o service recusar', async () => {
    const { registry, auditorias } = criar();
    auditorias.buscarAuditoriaPorId.mockResolvedValue({
      ...detalheBruto(),
      itens: [{ id: itemId, resposta: 'conforme', templateItem: { obrigatorio: true } }],
    });
    auditorias.finalizarAuditoria
      .mockRejectedValueOnce(new BadRequestException('Existem 1 itens obrigatórios não avaliados'))
      .mockResolvedValue({ ...detalheBruto(), status: 'finalizada' });

    const preparada = await chamar(registry, 'chekai_preparar_finalizacao', { auditoriaId }) as { token: string };
    await expect(chamar(registry, 'chekai_finalizar_auditoria', {
      auditoriaId,
      confirmationToken: preparada.token,
      observacoesGerais: 'Encerrada',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(auditorias.finalizarAuditoria).toHaveBeenCalledTimes(1);
    expect(auditorias.finalizarAuditoria).toHaveBeenCalledWith(
      auditoriaId,
      { observacoesGerais: 'Encerrada' },
      usuarioDo(principal),
    );

    await expect(chamar(registry, 'chekai_finalizar_auditoria', {
      auditoriaId,
      confirmationToken: preparada.token,
    })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auditorias.finalizarAuditoria).toHaveBeenCalledTimes(1);
  });

  it('finaliza só com token da mesma auditoria e devolve o resumo', async () => {
    const { registry, auditorias } = criar();
    auditorias.buscarAuditoriaPorId.mockResolvedValue(detalheBruto());
    auditorias.finalizarAuditoria.mockResolvedValue({
      ...detalheBruto(),
      status: 'finalizada',
      dataFim: new Date('2026-03-01T15:00:00.000Z'),
      pontuacaoTotal: 80,
    });
    const preparada = await chamar(registry, 'chekai_preparar_finalizacao', { auditoriaId }) as { token: string };

    await expect(chamar(registry, 'chekai_finalizar_auditoria', {
      auditoriaId: unidadeId,
      confirmationToken: preparada.token,
    })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(auditorias.finalizarAuditoria).not.toHaveBeenCalled();

    await expect(chamar(registry, 'chekai_finalizar_auditoria', {
      auditoriaId,
      confirmationToken: preparada.token,
    })).resolves.toMatchObject({
      id: auditoriaId,
      status: 'finalizada',
      pontuacaoTotal: 80,
      dataFim: '2026-03-01T15:00:00.000Z',
    });
  });
});

describe('UC-06: agenda', () => {
  it('lista e conclui agendamento com o principal, sem gestorId na resposta', async () => {
    const { registry, agenda } = criar();
    const bruta = {
      id: agendaId,
      gestorId: 'gestor-secreto',
      unidadeId,
      templateId,
      responsavelId: auditor.id,
      dataPrevista: '2026-04-01',
      recorrencia: 'mensal',
      status: 'agendada',
      observacao: 'Visita',
      realizadaEm: null,
      criadoPorId: principal.id,
      responsavel: { senhaHash: 'hash', otpCode: '252622' },
    };
    const resumo = {
      id: agendaId,
      unidadeId,
      templateId,
      responsavelId: auditor.id,
      dataPrevista: '2026-04-01',
      recorrencia: 'mensal',
      status: 'agendada',
      observacao: 'Visita',
      realizadaEm: null,
    };
    agenda.listar.mockResolvedValue(pagina([bruta]));
    agenda.concluir.mockResolvedValue({
      ...bruta,
      status: 'realizada',
      realizadaEm: new Date('2026-04-01T18:00:00.000Z'),
    });

    await expect(chamar(registry, 'chekai_listar_agenda', {
      status: 'agendada',
      de: '2026-04-01',
      ate: '2026-04-30',
    })).resolves.toEqual(pagina([resumo]));
    expect(agenda.listar).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      status: 'agendada',
      de: '2026-04-01',
      ate: '2026-04-30',
    }, usuarioDo(principal));

    await expect(chamar(registry, 'chekai_concluir_agendamento', { agendamentoId: agendaId })).resolves.toEqual({
      ...resumo,
      status: 'realizada',
      realizadaEm: '2026-04-01T18:00:00.000Z',
    });
    expect(agenda.concluir).toHaveBeenCalledWith(agendaId, usuarioDo(principal));
    expect(JSON.stringify(resumo)).not.toContain('gestor-secreto');
  });
});

describe('UC-07: tarefas com status controlado', () => {
  const tarefaBruta = {
    id: tarefaId,
    gestorId: 'gestor-secreto',
    titulo: 'Trocar filtro',
    descricao: 'Cozinha',
    responsavelId: auditor.id,
    auditoriaId,
    criadoPorId: principal.id,
    prazo: '2026-12-01',
    status: 'pendente',
    concluidaEm: null,
    responsavel: { senhaHash: 'hash', tokenConvite: 'convite' },
  };
  const tarefaResumo = {
    id: tarefaId,
    titulo: 'Trocar filtro',
    descricao: 'Cozinha',
    responsavelId: auditor.id,
    auditoriaId,
    prazo: '2026-12-01',
    status: 'pendente',
    concluidaEm: null,
  };

  it('lista, cria e atualiza sem deixar o modelo gravar status ou gestorId', async () => {
    const { registry, planos } = criar();
    planos.listar.mockResolvedValue(pagina([tarefaBruta]));
    planos.criar.mockResolvedValue(tarefaBruta);
    planos.atualizar.mockResolvedValue({ ...tarefaBruta, titulo: 'Trocar filtro fino' });

    await expect(chamar(registry, 'chekai_listar_tarefas', { status: 'pendente' })).resolves.toEqual(
      pagina([tarefaResumo]),
    );
    expect(planos.listar).toHaveBeenCalledWith(
      { page: 1, limit: 20, status: 'pendente' },
      usuarioDo(principal),
    );

    await chamar(registry, 'chekai_criar_tarefa', {
      titulo: 'Trocar filtro',
      descricao: 'Cozinha',
      responsavelId: auditor.id,
      auditoriaId,
      prazo: '2026-12-01',
      status: 'concluida',
    });
    expect(planos.criar).toHaveBeenCalledWith({
      titulo: 'Trocar filtro',
      descricao: 'Cozinha',
      responsavelId: auditor.id,
      auditoriaId,
      prazo: '2026-12-01',
    }, usuarioDo(principal));
    expect(planos.criar.mock.calls[0][0]).not.toHaveProperty('status');
    expect(planos.criar.mock.calls[0][0]).not.toHaveProperty('gestorId');

    await chamar(registry, 'chekai_atualizar_tarefa', {
      tarefaId,
      titulo: 'Trocar filtro fino',
      status: 'concluida',
    });
    expect(planos.atualizar).toHaveBeenCalledWith(
      tarefaId,
      { titulo: 'Trocar filtro fino' },
      usuarioDo(principal),
    );
    expect(planos.atualizar.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('concluir e reabrir fixam o status, ignorando o valor enviado pelo modelo', async () => {
    const { registry, planos } = criar();
    planos.atualizar.mockResolvedValue({
      ...tarefaBruta,
      status: StatusTarefaPlanoAcao.CONCLUIDA,
      concluidaEm: new Date('2026-12-02T12:00:00.000Z'),
    });

    await chamar(registry, 'chekai_concluir_tarefa', { tarefaId, status: 'cancelada' });
    expect(planos.atualizar).toHaveBeenCalledWith(
      tarefaId,
      { status: StatusTarefaPlanoAcao.CONCLUIDA },
      usuarioDo(principal),
    );

    planos.atualizar.mockResolvedValue({ ...tarefaBruta, status: StatusTarefaPlanoAcao.PENDENTE, concluidaEm: null });
    await chamar(registry, 'chekai_reabrir_tarefa', { tarefaId, status: 'cancelada' });
    expect(planos.atualizar).toHaveBeenLastCalledWith(
      tarefaId,
      { status: StatusTarefaPlanoAcao.PENDENTE },
      usuarioDo(principal),
    );
  });

  it('recusa criar tarefa sem prazo antes do service', async () => {
    const { registry, planos } = criar();
    await expect(chamar(registry, 'chekai_criar_tarefa', { titulo: 'Sem prazo' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(planos.criar).not.toHaveBeenCalled();
  });
});

describe('UC-08: relatórios técnicos e confirmação', () => {
  const relatorioBruto = () => ({
    id: relatorioId,
    clienteId,
    unidadeId,
    consultoraId: principal.id,
    status: 'rascunho',
    identificacao: 'Setor frios',
    descricaoOcorrenciaHtml: '<p>ocorrência</p>',
    avaliacaoTecnicaHtml: '<p>avaliação</p>',
    acoesExecutadas: ['Higienização'],
    recomendacoesConsultoraHtml: '<p>recomendação</p>',
    planoAcaoSugeridoHtml: '<p>plano</p>',
    assinaturaNomeConsultora: 'Ana Gestora',
    responsavel: 'João',
    apoioAnaliticoChekAi: 'prompt-secreto',
    pdfUrl: 'https://arquivos/relatorio-secreto.pdf',
    fotos: [{ url: 'https://arquivos/foto-relatorio-secreta.jpg' }],
    consultora: { senhaHash: 'hash', otpCode: '252622' },
  });

  it('lista, obtém, inicia e atualiza sem status, pdf ou apoio analítico', async () => {
    const { registry, relatorios } = criar();
    relatorios.listar.mockResolvedValue(pagina([relatorioBruto()]));
    relatorios.buscarPorId.mockResolvedValue(relatorioBruto());
    relatorios.iniciar.mockResolvedValue(relatorioBruto());
    relatorios.atualizar.mockResolvedValue({ ...relatorioBruto(), identificacao: 'Setor secos' });

    await expect(chamar(registry, 'chekai_listar_relatorios', { clienteId })).resolves.toEqual(pagina([{
      id: relatorioId,
      clienteId,
      unidadeId,
      consultoraId: principal.id,
      status: 'rascunho',
      identificacao: 'Setor frios',
    }]));
    expect(relatorios.listar).toHaveBeenCalledWith(
      { page: 1, limit: 20, clienteId },
      usuarioDo(principal),
    );

    const obtido = await chamar(registry, 'chekai_obter_relatorio', { relatorioId });
    expect(obtido).toEqual({
      id: relatorioId,
      clienteId,
      unidadeId,
      consultoraId: principal.id,
      status: 'rascunho',
      identificacao: 'Setor frios',
      descricaoOcorrenciaHtml: '<p>ocorrência</p>',
      avaliacaoTecnicaHtml: '<p>avaliação</p>',
      acoesExecutadas: ['Higienização'],
      recomendacoesConsultoraHtml: '<p>recomendação</p>',
      planoAcaoSugeridoHtml: '<p>plano</p>',
      assinaturaNomeConsultora: 'Ana Gestora',
      responsavel: 'João',
    });
    expect(JSON.stringify(obtido)).not.toContain('prompt-secreto');
    expect(JSON.stringify(obtido)).not.toContain('relatorio-secreto');
    expect(relatorios.buscarPorId).toHaveBeenCalledWith(relatorioId, usuarioDo(principal));

    await chamar(registry, 'chekai_iniciar_relatorio', { clienteId, unidadeId });
    expect(relatorios.iniciar).toHaveBeenCalledWith({ clienteId, unidadeId }, usuarioDo(principal));

    await chamar(registry, 'chekai_atualizar_relatorio', {
      relatorioId,
      identificacao: 'Setor secos',
      status: StatusRelatorioTecnico.FINALIZADO,
      consultoraId: auditor.id,
      pdfUrl: 'https://evil.example/arquivo.pdf',
      apoioAnaliticoChekAi: 'injetado',
    });
    expect(relatorios.atualizar).toHaveBeenCalledWith(
      relatorioId,
      { identificacao: 'Setor secos' },
      usuarioDo(principal),
    );
  });

  it('prepara o resumo do relatório isolado e consome o token antes de finalizar', async () => {
    const { registry, relatorios } = criar();
    relatorios.buscarPorId.mockResolvedValue({
      ...relatorioBruto(),
      identificacao: '   ',
      avaliacaoTecnicaHtml: '',
      acoesExecutadas: [],
    });
    relatorios.atualizar.mockRejectedValueOnce(new BadRequestException('HTML obrigatório'))
      .mockResolvedValue({ ...relatorioBruto(), status: 'finalizado' });

    const preparada = await chamar(registry, 'chekai_preparar_finalizacao_relatorio', { relatorioId }) as {
      token: string;
    };
    expect(preparada).toEqual({
      token: 'token-1',
      expiraEm: '2026-01-01T00:10:00.000Z',
      resumo: {
        relatorioId,
        status: 'rascunho',
        camposHtmlVazios: ['identificacao', 'avaliacaoTecnicaHtml'],
        possuiAcaoExecutada: false,
        prontaParaFinalizar: false,
      },
    });
    expect(JSON.stringify(preparada)).not.toContain('prompt-secreto');
    expect(JSON.stringify(preparada)).not.toContain('relatorio-secreto');
    expect(relatorios.buscarPorId).toHaveBeenCalledWith(relatorioId, usuarioDo(principal));
    expect(relatorios.atualizar).not.toHaveBeenCalled();

    await expect(chamar(registry, 'chekai_finalizar_relatorio', {
      relatorioId,
      confirmationToken: preparada.token,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(relatorios.atualizar).toHaveBeenCalledTimes(1);
    expect(relatorios.atualizar).toHaveBeenCalledWith(
      relatorioId,
      { status: StatusRelatorioTecnico.FINALIZADO },
      usuarioDo(principal),
    );
    await expect(chamar(registry, 'chekai_finalizar_relatorio', {
      relatorioId,
      confirmationToken: preparada.token,
    })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(relatorios.atualizar).toHaveBeenCalledTimes(1);
  });
});

describe('McpModule', () => {
  it('publica as definições da primeira onda e exporta agenda e plano de ação', () => {
    const providers = Reflect.getMetadata('providers', McpModule) as Array<{
      provide?: unknown;
      useValue?: unknown;
      useFactory?: unknown;
    }>;
    const definicoes = providers.find((provider) => provider?.provide === MCP_TOOL_DEFINITIONS);
    expect(definicoes?.useValue).toBeUndefined();
    expect(definicoes?.useFactory).toEqual(expect.any(Function));

    const imports = Reflect.getMetadata('imports', McpModule) as unknown[];
    expect(imports).toEqual(expect.arrayContaining([
      ClienteModule,
      ChecklistModule,
      AuditoriaModule,
      AgendaModule,
      PlanoAcaoModule,
      RelatorioTecnicoModule,
    ]));
    expect(Reflect.getMetadata('exports', AgendaModule)).toEqual(expect.arrayContaining([AgendaService]));
    expect(Reflect.getMetadata('exports', PlanoAcaoModule)).toEqual(
      expect.arrayContaining([PlanoAcaoService]),
    );
  });
});

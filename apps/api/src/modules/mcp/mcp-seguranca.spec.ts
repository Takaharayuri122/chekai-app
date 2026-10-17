/**
 * Segurança do canal MCP (UC-03, UC-05 FA-01, UC-09, RN-MCP-001, 004, 005, 006, 007, 008).
 * Services de domínio são fixtures em memória: a suíte não abre banco nem Railway.
 */
import { createServer, request as httpRequest, type IncomingMessage } from 'http';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PerfilUsuario, StatusUsuario } from '../usuario/entities/usuario.entity';
import { StatusTemplate } from '../checklist/entities/checklist-template.entity';
import { McpConfirmationService } from './core/mcp-confirmation.service';
import { McpPrincipalService } from './core/mcp-principal.service';
import { McpRegistryService } from './core/mcp-registry.service';
import { McpServerService } from './core/mcp-server.service';
import { MCP_TOOLS_PRIMEIRA_ONDA, McpPrincipal } from './core/mcp.types';
import { OauthConfigService } from './oauth/oauth-config.service';
import { OauthMetadataService } from './oauth/oauth-metadata.service';
import { McpRecursoController } from './oauth/mcp-recurso.controller';
import { ContextoAcessoMcp } from './oauth/oauth.types';
import { McpToolsService } from './tools/mcp-tools.service';

const GESTOR_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const GESTOR_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const AUDITOR_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const AUDITOR_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CLIENTE_A = '11111111-1111-4111-8111-111111111111';
const CLIENTE_A_SEM_VINCULO = '12121212-1212-4121-8121-121212121212';
const CLIENTE_B = '13131313-1313-4131-8131-131313131313';
const UNIDADE_A = '14141414-1414-4141-8141-141414141414';
const UNIDADE_B = '15151515-1515-4151-8151-151515151515';
const CHECKLIST_A = '16161616-1616-4161-8161-161616161616';
const CHECKLIST_A_INATIVO = '17171717-1717-4171-8171-171717171717';
const CHECKLIST_B = '18181818-1818-4181-8181-181818181818';
const AUDITORIA_A = '19191919-1919-4191-8191-191919191919';
const AUDITORIA_B = '1a1a1a1a-1a1a-41a1-81a1-1a1a1a1a1a1a';
const AGENDA_A = '1b1b1b1b-1b1b-41b1-81b1-1b1b1b1b1b1b';
const AGENDA_B = '1c1c1c1c-1c1c-41c1-81c1-1c1c1c1c1c1c';
const TAREFA_A = '1d1d1d1d-1d1d-41d1-81d1-1d1d1d1d1d1d';
const TAREFA_B = '1e1e1e1e-1e1e-41e1-81e1-1e1e1e1e1e1e';
const RELATORIO_A = '1f1f1f1f-1f1f-41f1-81f1-1f1f1f1f1f1f';
const RELATORIO_B = '20202020-2020-4202-8202-202020202020';
const METADATA_RECURSO = 'http://localhost:3001/.well-known/oauth-protected-resource';
const MARCADOR_B = 'recurso-do-tenant-b';
const SEGREDOS = [
  'hash-secreto',
  'otp-secreto',
  'convite-secreto',
  'pdf-secreto',
  'logo-secreto',
  'prompt-secreto',
  'ia-secreta',
  'artigo-secreto',
  'foto-secreta',
];

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

const FERRAMENTAS_ADMINISTRATIVAS = [
  'chekai_convidar_equipe',
  'chekai_listar_equipe',
  'chekai_convites',
  'chekai_planos',
  'chekai_assinaturas',
  'chekai_lista_espera',
  'chekai_configurar_creditos',
  'chekai_auditoria_tokens',
  'chekai_legislacao',
  'chekai_chunks',
  'chekai_rag',
  'chekai_cadastro_publico',
  'chekai_login',
  'chekai_ia',
  'chekai_prompt',
  'chekai_criar_agendamento',
  'chekai_editar_agendamento',
  'chekai_cancelar_agendamento',
  'chekai_remover_agendamento',
  'chekai_reabrir_auditoria',
  'chekai_remover_tarefa',
  'chekai_remover_cliente',
];

const TOOLS_CLIENTES = [
  'chekai_listar_clientes',
  'chekai_obter_cliente',
  'chekai_listar_unidades',
];

interface UsuarioChamada {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  gestorId: string | null;
}

function principalDe(
  id: string,
  perfil: PerfilUsuario,
  gestorId: string,
  scopes: string[] = SCOPES,
): McpPrincipal {
  return {
    id,
    nome: perfil === PerfilUsuario.AUDITOR ? 'Auditor A' : 'Gestor A',
    email: `${id.slice(0, 8)}@chekai.com`,
    perfil,
    gestorId,
    tenantId: gestorId,
    scopes,
  };
}

const gestorA = principalDe(GESTOR_A, PerfilUsuario.GESTOR, GESTOR_A);
const gestorB = principalDe(GESTOR_B, PerfilUsuario.GESTOR, GESTOR_B);
gestorB.nome = 'Gestor B';
const auditorA = principalDe(AUDITOR_A, PerfilUsuario.AUDITOR, GESTOR_A);
const masterA = principalDe(GESTOR_A, PerfilUsuario.MASTER, GESTOR_A);
masterA.nome = 'Master A';

function semVazamento(valor: unknown, extra: string[] = []): void {
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
  for (const segredo of [...SEGREDOS, MARCADOR_B, ...extra]) {
    expect(texto).not.toContain(segredo);
  }
}

function idsDe(pagina: unknown): string[] {
  const items = (pagina as { items?: Array<{ id?: string }> }).items ?? [];
  return items.map((item) => item.id ?? '');
}

function metadata(): OauthMetadataService {
  const config = new OauthConfigService({
    get: (chave: string) => ({
      NODE_ENV: 'development',
      FRONTEND_URL: 'http://localhost:3031',
      MCP_PUBLIC_URL: 'http://localhost:3001',
      OAUTH_ISSUER: 'http://issuer.local',
      OAUTH_ACCESS_TOKEN_TTL: '3600',
      OAUTH_REFRESH_TOKEN_TTL: '1209600',
      OAUTH_JWT_SECRET: 'chave-oauth-distinta',
      JWT_SECRET: 'chave-web',
    }[chave]),
  } as never);
  return new OauthMetadataService(config);
}

function envenenar<T extends Record<string, unknown>>(item: T): T {
  return {
    ...item,
    senhaHash: 'hash-secreto',
    otpCode: 'otp-secreto',
    tokenConvite: 'convite-secreto',
    pdfUrl: 'https://arquivos/pdf-secreto.pdf',
    logoUrl: 'https://arquivos/logo-secreto.png',
    apoioAnaliticoChekAi: 'prompt-secreto',
    descricaoIa: 'ia-secreta',
    textoLegal: 'artigo-secreto',
    fotos: [{ url: 'https://arquivos/foto-secreta.jpg' }],
    gestor: { senhaHash: 'hash-secreto', otpCode: 'otp-secreto' },
    resumoExecutivo: { resumo: 'ia-secreta' },
  };
}

function pagina<T>(items: T[]) {
  return {
    items,
    total: items.length,
    page: 1,
    limit: 20,
    totalPages: items.length ? 1 : 0,
    hasNext: false,
    hasPrevious: false,
  };
}

function dominio(usuario: UsuarioChamada): string {
  return usuario.perfil === PerfilUsuario.AUDITOR ? usuario.gestorId ?? '' : usuario.id;
}

function criarMundo() {
  let agora = new Date('2026-01-01T00:00:00.000Z');
  const relogio = {
    agora: () => new Date(agora.getTime()),
    avancar(ms: number) {
      agora = new Date(agora.getTime() + ms);
    },
  };
  const vinculos = new Set([`${AUDITOR_A}:${CLIENTE_A}`, `${AUDITOR_B}:${CLIENTE_B}`]);
  const auditoresDo = (gestorId: string) => (
    gestorId === GESTOR_A ? [AUDITOR_A] : gestorId === GESTOR_B ? [AUDITOR_B] : []
  );
  const clientes = [
    envenenar({
      id: CLIENTE_A, razaoSocial: 'Padaria A', nomeFantasia: 'A', cnpj: '00000000000100',
      email: 'a@cliente.com', telefone: '11999999999', tipoAtividade: 'padaria', ativo: true,
      gestorId: GESTOR_A,
    }),
    envenenar({
      id: CLIENTE_A_SEM_VINCULO, razaoSocial: 'Cliente sem vínculo', nomeFantasia: 'Sem',
      cnpj: '00000000000101', email: null, telefone: null, tipoAtividade: 'outro', ativo: true,
      gestorId: GESTOR_A,
    }),
    envenenar({
      id: CLIENTE_B, razaoSocial: MARCADOR_B, nomeFantasia: MARCADOR_B, cnpj: '00000000000200',
      email: 'b@cliente.com', telefone: null, tipoAtividade: 'outro', ativo: true,
      gestorId: GESTOR_B,
    }),
  ];
  const unidades = [
    envenenar({
      id: UNIDADE_A, nome: 'Matriz A', endereco: 'Rua A', cidade: 'Campinas', estado: 'SP',
      clienteId: CLIENTE_A, ativo: true, gestorId: GESTOR_A,
    }),
    envenenar({
      id: UNIDADE_B, nome: MARCADOR_B, endereco: 'Rua B', cidade: 'Santos', estado: 'SP',
      clienteId: CLIENTE_B, ativo: true, gestorId: GESTOR_B,
    }),
  ];
  const checklists = [
    envenenar({
      id: CHECKLIST_A, nome: 'Boas práticas A', descricao: 'Higiene', tipoAtividade: 'padaria',
      versao: '1.0', status: StatusTemplate.ATIVO, gestorId: GESTOR_A,
      grupos: [{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', nome: 'Estrutura', ordem: 0 }],
      itens: [{
        id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', pergunta: 'Pia', ordem: 1,
        obrigatorio: true, grupoId: null, opcoesResposta: ['conforme'],
      }],
    }),
    envenenar({
      id: CHECKLIST_A_INATIVO, nome: 'Rascunho oculto', descricao: null, tipoAtividade: 'padaria',
      versao: '0.1', status: StatusTemplate.INATIVO, gestorId: GESTOR_A, grupos: [], itens: [],
    }),
    envenenar({
      id: CHECKLIST_B, nome: MARCADOR_B, descricao: MARCADOR_B, tipoAtividade: 'outro',
      versao: '1.0', status: StatusTemplate.ATIVO, gestorId: GESTOR_B, grupos: [], itens: [],
    }),
  ];
  const auditorias = [
    envenenar({
      id: AUDITORIA_A, status: 'em_andamento', unidadeId: UNIDADE_A, templateId: CHECKLIST_A,
      consultorId: AUDITOR_A, dataInicio: '2026-03-01T12:00:00.000Z', dataFim: null,
      pontuacaoTotal: null, observacoesGerais: null, gestorId: GESTOR_A,
      itens: [{
        id: 'abababab-abab-4aba-8aba-abababababab', templateItemId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        resposta: 'conforme', observacao: null, pontuacao: 10,
        templateItem: { obrigatorio: true },
      }],
    }),
    envenenar({
      id: AUDITORIA_B, status: 'em_andamento', unidadeId: UNIDADE_B, templateId: CHECKLIST_B,
      consultorId: AUDITOR_B, dataInicio: '2026-03-02T12:00:00.000Z', dataFim: null,
      pontuacaoTotal: null, observacoesGerais: MARCADOR_B, gestorId: GESTOR_B, itens: [],
    }),
  ];
  const agendas = [
    envenenar({
      id: AGENDA_A, gestorId: GESTOR_A, unidadeId: UNIDADE_A, templateId: CHECKLIST_A,
      responsavelId: AUDITOR_A, dataPrevista: '2026-04-01', recorrencia: 'nenhuma',
      status: 'agendada', observacao: 'Visita A', realizadaEm: null,
    }),
    envenenar({
      id: AGENDA_B, gestorId: GESTOR_B, unidadeId: UNIDADE_B, templateId: CHECKLIST_B,
      responsavelId: AUDITOR_B, dataPrevista: '2026-04-02', recorrencia: 'nenhuma',
      status: 'agendada', observacao: MARCADOR_B, realizadaEm: null,
    }),
  ];
  const tarefas = [
    envenenar({
      id: TAREFA_A, gestorId: GESTOR_A, titulo: 'Trocar filtro A', descricao: 'Cozinha',
      responsavelId: AUDITOR_A, auditoriaId: AUDITORIA_A, criadoPorId: GESTOR_A,
      prazo: '2026-12-01', status: 'pendente', concluidaEm: null,
    }),
    envenenar({
      id: TAREFA_B, gestorId: GESTOR_B, titulo: MARCADOR_B, descricao: MARCADOR_B,
      responsavelId: AUDITOR_B, auditoriaId: AUDITORIA_B, criadoPorId: GESTOR_B,
      prazo: '2026-12-02', status: 'pendente', concluidaEm: null,
    }),
  ];
  const relatorios = [
    envenenar({
      id: RELATORIO_A, clienteId: CLIENTE_A, unidadeId: UNIDADE_A, consultoraId: AUDITOR_A,
      status: 'rascunho', identificacao: 'Setor frios', descricaoOcorrenciaHtml: '<p>a</p>',
      avaliacaoTecnicaHtml: '<p>b</p>', acoesExecutadas: ['Higienização'],
      recomendacoesConsultoraHtml: '<p>c</p>', planoAcaoSugeridoHtml: '<p>d</p>',
      assinaturaNomeConsultora: 'Auditor A', responsavel: 'João', gestorId: GESTOR_A,
    }),
    envenenar({
      id: RELATORIO_B, clienteId: CLIENTE_B, unidadeId: UNIDADE_B, consultoraId: AUDITOR_B,
      status: 'rascunho', identificacao: MARCADOR_B, descricaoOcorrenciaHtml: MARCADOR_B,
      avaliacaoTecnicaHtml: MARCADOR_B, acoesExecutadas: [MARCADOR_B],
      recomendacoesConsultoraHtml: MARCADOR_B, planoAcaoSugeridoHtml: MARCADOR_B,
      assinaturaNomeConsultora: MARCADOR_B, responsavel: MARCADOR_B, gestorId: GESTOR_B,
    }),
  ];

  const podeCliente = (usuario: UsuarioChamada, clienteId: string) => {
    const cliente = clientes.find((item) => item.id === clienteId);
    if (!cliente || cliente.gestorId !== dominio(usuario)) return false;
    if (usuario.perfil !== PerfilUsuario.AUDITOR) return true;
    return vinculos.has(`${usuario.id}:${cliente.id}`);
  };
  const podeAuditoria = (usuario: UsuarioChamada, consultorId: string) => {
    if (usuario.perfil === PerfilUsuario.AUDITOR) return consultorId === usuario.id;
    return consultorId === usuario.id || auditoresDo(usuario.id).includes(consultorId);
  };
  const podeAgenda = (usuario: UsuarioChamada, agenda: { gestorId: string; responsavelId: string }) => (
    usuario.perfil === PerfilUsuario.AUDITOR
      ? agenda.responsavelId === usuario.id
      : agenda.gestorId === usuario.id
  );
  const podeTarefa = (
    usuario: UsuarioChamada,
    tarefa: { gestorId: string; criadoPorId: string; responsavelId: string },
  ) => (
    usuario.perfil === PerfilUsuario.AUDITOR
      ? tarefa.criadoPorId === usuario.id || tarefa.responsavelId === usuario.id
      : tarefa.gestorId === usuario.id
  );
  const podeRelatorio = (usuario: UsuarioChamada, consultoraId: string) => podeAuditoria(usuario, consultoraId);
  const negar = () => {
    throw new NotFoundException('Recurso não encontrado');
  };

  const usuarios = {
    buscarPorId: jest.fn(async (id: string) => {
      const quem = [gestorA, gestorB, auditorA, masterA].find((item) => item.id === id) ?? gestorA;
      return envenenar({
        id: quem.id,
        nome: quem.nome,
        email: quem.email,
        perfil: quem.perfil,
        gestorId: quem.gestorId,
        tenantId: quem.tenantId,
        status: StatusUsuario.ATIVO,
      });
    }),
  };
  const clientesSvc = {
    listarClientes: jest.fn(async (_query: unknown, usuario: UsuarioChamada) => pagina(
      clientes.filter((cliente) => podeCliente(usuario, cliente.id)),
    )),
    buscarClientePorId: jest.fn(async (id: string, usuario: UsuarioChamada) => {
      if (!podeCliente(usuario, id)) negar();
      return clientes.find((cliente) => cliente.id === id);
    }),
    listarTodasUnidades: jest.fn(async (usuario: UsuarioChamada) => (
      unidades.filter((unidade) => podeCliente(usuario, unidade.clienteId))
    )),
    listarUnidadesPorCliente: jest.fn(async (clienteId: string) => (
      unidades.filter((unidade) => unidade.clienteId === clienteId)
    )),
  };
  const checklistsSvc = {
    listarTemplates: jest.fn(async (_query: unknown, usuario: UsuarioChamada) => pagina(
      checklists.filter((template) => template.gestorId === dominio(usuario)),
    )),
    buscarTemplatePorId: jest.fn(async (id: string, usuario: UsuarioChamada) => {
      const template = checklists.find((item) => item.id === id && item.gestorId === dominio(usuario));
      if (!template) negar();
      return template;
    }),
  };
  const auditoriasSvc = {
    listarAuditorias: jest.fn(async (_query: unknown, usuario: UsuarioChamada) => pagina(
      auditorias.filter((auditoria) => podeAuditoria(usuario, auditoria.consultorId)),
    )),
    buscarAuditoriaPorId: jest.fn(async (id: string, usuario: UsuarioChamada) => {
      const auditoria = auditorias.find((item) => item.id === id);
      if (!auditoria || !podeAuditoria(usuario, auditoria.consultorId)) negar();
      return auditoria;
    }),
    iniciarAuditoria: jest.fn(),
    responderItem: jest.fn(),
    finalizarAuditoria: jest.fn(async (id: string, _dto: unknown, usuario: UsuarioChamada) => {
      const auditoria = auditorias.find((item) => item.id === id);
      if (!auditoria || !podeAuditoria(usuario, auditoria.consultorId)) negar();
      return { ...auditoria, status: 'finalizada' };
    }),
  };
  const agendaSvc = {
    listar: jest.fn(async (_query: unknown, usuario: UsuarioChamada) => pagina(
      agendas.filter((agenda) => podeAgenda(usuario, agenda)),
    )),
    concluir: jest.fn(async (id: string, usuario: UsuarioChamada) => {
      const agenda = agendas.find((item) => item.id === id);
      if (!agenda || !podeAgenda(usuario, agenda)) negar();
      return { ...agenda, status: 'realizada', realizadaEm: '2026-04-01T18:00:00.000Z' };
    }),
  };
  const planosSvc = {
    listar: jest.fn(async (_query: unknown, usuario: UsuarioChamada) => pagina(
      tarefas.filter((tarefa) => podeTarefa(usuario, tarefa)),
    )),
    criar: jest.fn(),
    atualizar: jest.fn(async (id: string, _dto: unknown, usuario: UsuarioChamada) => {
      const tarefa = tarefas.find((item) => item.id === id);
      if (!tarefa || !podeTarefa(usuario, tarefa)) negar();
      return tarefa;
    }),
  };
  const relatoriosSvc = {
    listar: jest.fn(async (_query: unknown, usuario: UsuarioChamada) => pagina(
      relatorios.filter((relatorio) => podeRelatorio(usuario, relatorio.consultoraId)),
    )),
    buscarPorId: jest.fn(async (id: string, usuario: UsuarioChamada) => {
      const relatorio = relatorios.find((item) => item.id === id);
      if (!relatorio || !podeRelatorio(usuario, relatorio.consultoraId)) negar();
      return relatorio;
    }),
    iniciar: jest.fn(),
    atualizar: jest.fn(async (id: string, _dto: unknown, usuario: UsuarioChamada) => {
      const relatorio = relatorios.find((item) => item.id === id);
      if (!relatorio || !podeRelatorio(usuario, relatorio.consultoraId)) negar();
      return relatorio;
    }),
  };
  const confirmacao = new McpConfirmationService(relogio, { opaco: () => 'confirmacao-opaca' });
  const tools = new McpToolsService(
    usuarios as never,
    clientesSvc as never,
    checklistsSvc as never,
    auditoriasSvc as never,
    agendaSvc as never,
    planosSvc as never,
    relatoriosSvc as never,
    confirmacao,
  );
  const registry = new McpRegistryService(tools.definicoes());
  const servidor = new McpServerService(registry, metadata());
  return {
    registry,
    servidor,
    relogio,
    usuarios,
    clientes: clientesSvc,
    checklists: checklistsSvc,
    auditorias: auditoriasSvc,
    agenda: agendaSvc,
    planos: planosSvc,
    relatorios: relatoriosSvc,
  };
}

async function chamar(
  mundo: ReturnType<typeof criarMundo>,
  nome: string,
  input: Record<string, unknown>,
  quem: McpPrincipal,
) {
  return mundo.registry.executar(nome, input, quem);
}

async function mensagemDe(executar: () => Promise<unknown>): Promise<string> {
  try {
    const resultado = await executar();
    return JSON.stringify(resultado);
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro);
  }
}

function lerCorpo(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    req.on('data', (parte) => partes.push(parte));
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}

function rpcDe(texto: string): Record<string, unknown> {
  const linha = texto
    .split('\n')
    .map((item) => item.trim())
    .find((item) => item.startsWith('data:') && item.slice(5).trim().startsWith('{'));
  const bruto = linha ? linha.replace(/^data:\s*/, '') : texto;
  return JSON.parse(bruto) as Record<string, unknown>;
}

function postMcp(
  servidor: McpServerService,
  principal: McpPrincipal,
  mensagem: Record<string, unknown>,
): Promise<{ status: number; headers: IncomingMessage['headers']; texto: string }> {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const bruto = await lerCorpo(req);
        (req as Request).body = bruto ? JSON.parse(bruto) : undefined;
        await servidor.atender(req as Request, res as unknown as Response, principal);
      } catch (erro) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.end(erro instanceof Error ? erro.message : String(erro));
        }
      }
    });
    server.listen(0, '127.0.0.1', () => {
      const endereco = server.address();
      if (!endereco || typeof endereco === 'string') {
        server.close();
        reject(new Error('porta indisponível'));
        return;
      }
      const payload = JSON.stringify(mensagem);
      const pedido = httpRequest({
        hostname: '127.0.0.1',
        port: endereco.port,
        path: '/mcp',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          'content-length': Buffer.byteLength(payload),
          'mcp-protocol-version': '2025-11-25',
        },
      }, (resposta) => {
        const partes: Buffer[] = [];
        resposta.on('data', (parte) => partes.push(parte));
        resposta.on('end', () => {
          server.close();
          resolve({
            status: resposta.statusCode ?? 0,
            headers: resposta.headers,
            texto: Buffer.concat(partes).toString('utf8'),
          });
        });
      });
      pedido.setTimeout(8000, () => {
        pedido.destroy(new Error('timeout do protocolo MCP'));
      });
      pedido.on('error', (erro) => {
        server.close();
        reject(erro);
      });
      pedido.end(payload);
    });
  });
}

describe('UC-03: perfis e scopes', () => {
  it('entrega o mesmo catálogo da primeira onda a MASTER, GESTOR e AUDITOR com scopes completos', () => {
    const mundo = criarMundo();
    const esperado = [...MCP_TOOLS_PRIMEIRA_ONDA];
    for (const quem of [masterA, gestorA, auditorA]) {
      expect(mundo.registry.listar(quem).map((tool) => tool.nome)).toEqual(esperado);
    }
  });

  it('lista só as tools de clientes quando o token tem apenas chekai:clientes:ler', () => {
    const mundo = criarMundo();
    const restrito = { ...gestorA, scopes: ['chekai:clientes:ler'] };
    expect(mundo.registry.listar(restrito).map((tool) => tool.nome)).toEqual(TOOLS_CLIENTES);
  });

  it('não lista nem executa tool quando o perfil do principal não está na definição', async () => {
    const mundo = criarMundo();
    const invasor = { ...gestorA, perfil: 'invasor' as PerfilUsuario };
    expect(mundo.registry.listar(invasor)).toEqual([]);
    await expect(chamar(mundo, 'chekai_me', {}, invasor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(mundo.usuarios.buscarPorId).not.toHaveBeenCalled();
  });
});

describe('RN-MCP-008: ferramentas administrativas ausentes', () => {
  it.each([masterA, gestorA, auditorA])(
    'não lista nem executa capacidade administrativa para $perfil',
    async (quem) => {
      const mundo = criarMundo();
      const nomes = mundo.registry.listar(quem).map((tool) => tool.nome);
      for (const nome of FERRAMENTAS_ADMINISTRATIVAS) {
        expect(nomes).not.toContain(nome);
        await expect(chamar(mundo, nome, { gestorId: GESTOR_B }, quem))
          .rejects.toBeInstanceOf(ForbiddenException);
      }
      expect(mundo.clientes.listarClientes).not.toHaveBeenCalled();
      expect(mundo.auditorias.finalizarAuditoria).not.toHaveBeenCalled();
      expect(mundo.agenda.concluir).not.toHaveBeenCalled();
      expect(mundo.planos.atualizar).not.toHaveBeenCalled();
      expect(mundo.relatorios.atualizar).not.toHaveBeenCalled();
    },
  );
});

describe('RN-MCP-006: identificadores de isolamento no input', () => {
  const aninhados: Record<string, unknown>[] = [
    { gestorId: GESTOR_B },
    { filtro: { tenantId: GESTOR_B } },
    { lote: [{ meta: { consultorId: AUDITOR_B } }] },
    { pagina: { aninhado: { profundo: { gestorId: GESTOR_B } } } },
    { itens: [null, 'texto', { tenantId: GESTOR_B }] },
    { gestorId: null },
  ];

  it.each(aninhados)('rejeita %# antes do service', async (input) => {
    const mundo = criarMundo();
    await expect(chamar(mundo, 'chekai_listar_clientes', input, gestorA))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(mundo.clientes.listarClientes).not.toHaveBeenCalled();
  });

  it('aceita o texto gestorId como valor e chama o service só com o usuário autenticado', async () => {
    const mundo = criarMundo();
    await chamar(mundo, 'chekai_listar_clientes', {
      page: 1,
      observacao: 'o texto gestorId não é um campo',
      GestorId: GESTOR_B,
      gestor_id: GESTOR_B,
    }, gestorA);
    expect(mundo.clientes.listarClientes).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      expect.objectContaining({ id: GESTOR_A, gestorId: GESTOR_A, perfil: PerfilUsuario.GESTOR }),
    );
  });
});

describe('RN-MCP-006: sanitização e principal relido', () => {
  it('relê perfil, gestor e tenant do banco e ignora o claim forjado', async () => {
    const usuarios = {
      buscarPorId: jest.fn(async () => ({
        id: AUDITOR_A,
        nome: 'Nome do banco',
        email: 'auditor@chekai.com',
        perfil: PerfilUsuario.AUDITOR,
        gestorId: GESTOR_A,
        tenantId: GESTOR_A,
        status: StatusUsuario.ATIVO,
        senhaHash: 'hash-secreto',
        otpCode: 'otp-secreto',
      })),
    };
    const service = new McpPrincipalService(usuarios as never);
    const contexto: ContextoAcessoMcp = {
      id: AUDITOR_A,
      email: 'forjado@chekai.com',
      perfil: PerfilUsuario.MASTER,
      gestorId: GESTOR_B,
      tenantId: GESTOR_B,
      scope: SCOPES.join(' '),
      jti: 'jti-1',
    };

    const principal = await service.obter(contexto);

    expect(principal).toEqual({
      id: AUDITOR_A,
      nome: 'Nome do banco',
      email: 'auditor@chekai.com',
      perfil: PerfilUsuario.AUDITOR,
      gestorId: GESTOR_A,
      tenantId: GESTOR_A,
      scopes: SCOPES,
    });
    expect(principal).not.toHaveProperty('senhaHash');
  });

  it.each([StatusUsuario.INATIVO, StatusUsuario.NAO_CONFIRMADO])(
    'recusa principal com status %s e não devolve a conta',
    async (status) => {
      const usuarios = {
        buscarPorId: jest.fn(async () => ({
          id: GESTOR_A,
          nome: 'Conta',
          email: 'conta@chekai.com',
          perfil: PerfilUsuario.GESTOR,
          gestorId: GESTOR_A,
          tenantId: GESTOR_A,
          status,
          senhaHash: 'hash-secreto',
        })),
      };
      const service = new McpPrincipalService(usuarios as never);
      await expect(service.obter({
        id: GESTOR_A,
        email: 'conta@chekai.com',
        perfil: PerfilUsuario.GESTOR,
        gestorId: GESTOR_A,
        tenantId: GESTOR_A,
        scope: 'chekai:contexto',
        jti: 'jti-2',
      })).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );

  it('omite segredos ao ler contexto, clientes, checklists, auditorias, agenda, tarefas e relatórios', async () => {
    const mundo = criarMundo();
    const leituras = [
      await chamar(mundo, 'chekai_me', {}, gestorA),
      await chamar(mundo, 'chekai_listar_clientes', {}, gestorA),
      await chamar(mundo, 'chekai_obter_cliente', { clienteId: CLIENTE_A }, gestorA),
      await chamar(mundo, 'chekai_listar_unidades', {}, gestorA),
      await chamar(mundo, 'chekai_listar_checklists', {}, gestorA),
      await chamar(mundo, 'chekai_obter_checklist', { checklistId: CHECKLIST_A }, gestorA),
      await chamar(mundo, 'chekai_listar_auditorias', {}, gestorA),
      await chamar(mundo, 'chekai_obter_auditoria', { auditoriaId: AUDITORIA_A }, gestorA),
      await chamar(mundo, 'chekai_listar_agenda', {}, gestorA),
      await chamar(mundo, 'chekai_listar_tarefas', {}, gestorA),
      await chamar(mundo, 'chekai_listar_relatorios', {}, gestorA),
      await chamar(mundo, 'chekai_obter_relatorio', { relatorioId: RELATORIO_A }, gestorA),
    ];
    for (const leitura of leituras) semVazamento(leitura);
    expect(leituras[1]).toEqual(expect.objectContaining({
      items: expect.arrayContaining([
        expect.objectContaining({ id: CLIENTE_A, razaoSocial: 'Padaria A' }),
      ]),
    }));
  });
});

describe('UC-09: cross-tenant com services simulados', () => {
  it('mostra ao gestor A só os clientes e unidades do próprio domínio', async () => {
    const mundo = criarMundo();
    const clientes = await chamar(mundo, 'chekai_listar_clientes', {}, gestorA);
    const unidades = await chamar(mundo, 'chekai_listar_unidades', {}, gestorA);
    expect(idsDe(clientes).sort()).toEqual([CLIENTE_A, CLIENTE_A_SEM_VINCULO].sort());
    expect(idsDe(unidades)).toEqual([UNIDADE_A]);
    semVazamento(clientes);
    semVazamento(unidades);
    expect(mundo.clientes.listarClientes).toHaveBeenCalledWith(
      { page: 1, limit: 20 },
      expect.objectContaining({ id: GESTOR_A }),
    );

    const erro = await mensagemDe(() => chamar(mundo, 'chekai_obter_cliente', { clienteId: CLIENTE_B }, gestorA));
    semVazamento(erro);
    expect(erro).toContain('Recurso não encontrado');
  });

  it('limita o auditor aos clientes vinculados e esconde o checklist inativo e o do outro gestor', async () => {
    const mundo = criarMundo();
    const clientes = await chamar(mundo, 'chekai_listar_clientes', {}, auditorA);
    expect(idsDe(clientes)).toEqual([CLIENTE_A]);
    const erroCliente = await mensagemDe(() => chamar(
      mundo,
      'chekai_obter_cliente',
      { clienteId: CLIENTE_A_SEM_VINCULO },
      auditorA,
    ));
    semVazamento(erroCliente);
    expect(erroCliente).toContain('Recurso não encontrado');

    const checklists = await chamar(mundo, 'chekai_listar_checklists', {}, auditorA);
    expect(idsDe(checklists)).toEqual([CHECKLIST_A]);
    await expect(chamar(mundo, 'chekai_obter_checklist', { checklistId: CHECKLIST_A_INATIVO }, auditorA))
      .rejects.toThrow('Checklist não disponível');
    const erroB = await mensagemDe(() => chamar(
      mundo,
      'chekai_obter_checklist',
      { checklistId: CHECKLIST_B },
      auditorA,
    ));
    semVazamento(erroB);
    expect(erroB).toContain('Recurso não encontrado');
  });

  it('isola auditorias, agenda, tarefas e relatórios do gestor B', async () => {
    const mundo = criarMundo();
    expect(idsDe(await chamar(mundo, 'chekai_listar_auditorias', {}, gestorA))).toEqual([AUDITORIA_A]);
    expect(idsDe(await chamar(mundo, 'chekai_listar_auditorias', {}, auditorA))).toEqual([AUDITORIA_A]);
    expect(idsDe(await chamar(mundo, 'chekai_listar_agenda', {}, auditorA))).toEqual([AGENDA_A]);
    expect(idsDe(await chamar(mundo, 'chekai_listar_tarefas', {}, auditorA))).toEqual([TAREFA_A]);
    expect(idsDe(await chamar(mundo, 'chekai_listar_relatorios', {}, gestorA))).toEqual([RELATORIO_A]);

    for (const [nome, input] of [
      ['chekai_obter_auditoria', { auditoriaId: AUDITORIA_B }],
      ['chekai_concluir_agendamento', { agendamentoId: AGENDA_B }],
      ['chekai_atualizar_tarefa', { tarefaId: TAREFA_B, titulo: 'Invadir' }],
      ['chekai_obter_relatorio', { relatorioId: RELATORIO_B }],
    ] as const) {
      const erro = await mensagemDe(() => chamar(mundo, nome, input, gestorA));
      semVazamento(erro);
      expect(erro).toContain('Recurso não encontrado');
    }
    expect(mundo.agenda.concluir).toHaveBeenCalledWith(
      AGENDA_B,
      expect.objectContaining({ id: GESTOR_A }),
    );
    expect(mundo.planos.atualizar).toHaveBeenCalledWith(
      TAREFA_B,
      { titulo: 'Invadir' },
      expect.objectContaining({ id: GESTOR_A }),
    );
  });
});

describe('RN-MCP-007: confirmação expirada e reusada', () => {
  it('não finaliza auditoria com token expirado e não chama o service', async () => {
    const mundo = criarMundo();
    const preparada = await chamar(mundo, 'chekai_preparar_finalizacao', { auditoriaId: AUDITORIA_A }, gestorA) as {
      token: string;
    };
    mundo.relogio.avancar(10 * 60 * 1000 + 1);
    await expect(chamar(mundo, 'chekai_finalizar_auditoria', {
      auditoriaId: AUDITORIA_A,
      confirmationToken: preparada.token,
    }, gestorA)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mundo.auditorias.finalizarAuditoria).not.toHaveBeenCalled();
  });

  it('não reutiliza o token de finalização do relatório', async () => {
    const mundo = criarMundo();
    const preparada = await chamar(
      mundo,
      'chekai_preparar_finalizacao_relatorio',
      { relatorioId: RELATORIO_A },
      gestorA,
    ) as { token: string };
    await chamar(mundo, 'chekai_finalizar_relatorio', {
      relatorioId: RELATORIO_A,
      confirmationToken: preparada.token,
    }, gestorA);
    await expect(chamar(mundo, 'chekai_finalizar_relatorio', {
      relatorioId: RELATORIO_A,
      confirmationToken: preparada.token,
    }, gestorA)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mundo.relatorios.atualizar).toHaveBeenCalledTimes(1);
  });

  it('recusa token de outro usuário sem finalizar', async () => {
    const mundo = criarMundo();
    const preparada = await chamar(mundo, 'chekai_preparar_finalizacao', { auditoriaId: AUDITORIA_A }, gestorA) as {
      token: string;
    };
    await expect(chamar(mundo, 'chekai_finalizar_auditoria', {
      auditoriaId: AUDITORIA_A,
      confirmationToken: preparada.token,
    }, auditorA)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mundo.auditorias.finalizarAuditoria).not.toHaveBeenCalled();
  });
});

describe('protocolo Streamable HTTP', () => {
  const initialize = {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'teste-seguranca', version: '1.0.0' },
    },
  };

  it('faz initialize, tools/list e tools/call sem vazar segredo', async () => {
    const mundo = criarMundo();
    const aberto = await postMcp(mundo.servidor, gestorA, initialize);
    expect(aberto.status).toBe(200);
    const sessao = rpcDe(aberto.texto);
    expect(sessao).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        serverInfo: { name: 'ChekAI' },
      },
    });

    const lista = await postMcp(mundo.servidor, gestorA, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });
    expect(lista.status).toBe(200);
    const ferramentas = (rpcDe(lista.texto).result as { tools: Array<{ name: string }> }).tools
      .map((tool) => tool.name);
    expect(ferramentas).toEqual([...MCP_TOOLS_PRIMEIRA_ONDA]);
    for (const nome of FERRAMENTAS_ADMINISTRATIVAS) {
      expect(ferramentas).not.toContain(nome);
    }

    const chamada = await postMcp(mundo.servidor, gestorA, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'chekai_me', arguments: {} },
    });
    expect(chamada.status).toBe(200);
    const resultado = rpcDe(chamada.texto).result as {
      content: Array<{ text: string }>;
      isError?: boolean;
    };
    expect(resultado.isError).toBeUndefined();
    const contexto = JSON.parse(resultado.content[0].text);
    expect(contexto).toEqual({
      id: GESTOR_A,
      nome: 'Gestor A',
      email: gestorA.email,
      perfil: PerfilUsuario.GESTOR,
    });
    semVazamento(chamada.texto);
  });

  it('responde 403 insufficient_scope com resource_metadata e não executa a tool', async () => {
    const mundo = criarMundo();
    const restrito = { ...gestorA, scopes: ['chekai:contexto'] };
    const resposta = await postMcp(mundo.servidor, restrito, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'chekai_listar_clientes', arguments: {} },
    });

    expect(resposta.status).toBe(403);
    expect(resposta.headers['www-authenticate']).toContain('error="insufficient_scope"');
    expect(resposta.headers['www-authenticate']).toContain(`resource_metadata="${METADATA_RECURSO}"`);
    expect(resposta.headers['www-authenticate']).toContain('scope="chekai:clientes:ler"');
    expect(JSON.parse(resposta.texto)).toMatchObject({ error: 'insufficient_scope' });
    expect(mundo.clientes.listarClientes).not.toHaveBeenCalled();
  });

  it('não executa tool administrativa nem input com tenant aninhado pelo transporte HTTP', async () => {
    const mundo = criarMundo();
    const admin = await postMcp(mundo.servidor, gestorA, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'chekai_convites', arguments: {} },
    });
    expect(admin.status).not.toBe(403);
    expect(rpcDe(admin.texto).result ?? rpcDe(admin.texto).error).toBeDefined();
    expect(mundo.clientes.listarClientes).not.toHaveBeenCalled();

    const aninhado = await postMcp(mundo.servidor, gestorA, {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'chekai_listar_clientes',
        arguments: { lote: [{ meta: { tenantId: GESTOR_B } }] },
      },
    });
    const corpo = rpcDe(aninhado.texto);
    const resultado = corpo.result as { isError?: boolean; content?: Array<{ text: string }> } | undefined;
    expect(resultado?.isError).toBe(true);
    semVazamento(resultado?.content?.[0]?.text ?? aninhado.texto);
    expect(mundo.clientes.listarClientes).not.toHaveBeenCalled();
  });

  it('responde 401 com resource_metadata e não abre o servidor MCP', async () => {
    const documentos = metadata();
    const tokens = {
      exigirAcesso: jest.fn(async () => documentos.respostaNaoAutenticado()),
    };
    const principals = { obter: jest.fn() };
    const servidor = { atender: jest.fn() };
    const controller = new McpRecursoController(
      tokens as never,
      principals as never,
      servidor as never,
    );
    const headers: Record<string, string> = {};
    let status = 0;
    let body: unknown;
    const res = {
      status(codigo: number) {
        status = codigo;
        return this;
      },
      setHeader(chave: string, valor: string) {
        headers[chave] = valor;
        return this;
      },
      json(payload: unknown) {
        body = payload;
      },
    };

    await controller.atender(undefined, {} as Request, res as unknown as Response);

    expect(status).toBe(401);
    expect(headers['WWW-Authenticate']).toContain('resource_metadata="');
    expect(headers['WWW-Authenticate']).toContain(METADATA_RECURSO);
    expect(body).toEqual({ error: 'invalid_token' });
    expect(principals.obter).not.toHaveBeenCalled();
    expect(servidor.atender).not.toHaveBeenCalled();
  });
});

import { PerfilUsuario } from '../../usuario/entities/usuario.entity';

export interface McpPrincipal {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  gestorId: string | null;
  tenantId: string | null;
  scopes: string[];
}

export interface McpToolDefinition {
  nome: string;
  descricao: string;
  scope: string;
  perfis: PerfilUsuario[];
  inputSchema?: unknown;
  handler: (input: Record<string, unknown>, principal: McpPrincipal) => Promise<unknown>;
}

export const MCP_TOOLS_PRIMEIRA_ONDA = [
  'chekai_me',
  'chekai_listar_clientes',
  'chekai_obter_cliente',
  'chekai_listar_unidades',
  'chekai_listar_checklists',
  'chekai_obter_checklist',
  'chekai_listar_auditorias',
  'chekai_obter_auditoria',
  'chekai_iniciar_auditoria',
  'chekai_responder_item',
  'chekai_preparar_finalizacao',
  'chekai_finalizar_auditoria',
  'chekai_listar_agenda',
  'chekai_concluir_agendamento',
  'chekai_listar_tarefas',
  'chekai_criar_tarefa',
  'chekai_atualizar_tarefa',
  'chekai_concluir_tarefa',
  'chekai_reabrir_tarefa',
  'chekai_listar_relatorios',
  'chekai_obter_relatorio',
  'chekai_iniciar_relatorio',
  'chekai_atualizar_relatorio',
  'chekai_preparar_finalizacao_relatorio',
  'chekai_finalizar_relatorio',
] as const;

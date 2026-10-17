import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import { MCP_TOOLS_PRIMEIRA_ONDA, McpPrincipal, McpToolDefinition } from './mcp.types';

const CAMPOS_ISOLAMENTO = new Set(['gestorId', 'tenantId', 'consultorId']);
export const MCP_TOOL_DEFINITIONS = Symbol('MCP_TOOL_DEFINITIONS');

@Injectable()
export class McpRegistryService {
  private readonly tools: Map<string, McpToolDefinition>;

  constructor(
    @Optional()
    @Inject(MCP_TOOL_DEFINITIONS)
    definicoes: McpToolDefinition[] = [],
  ) {
    const permitidas = new Set<string>(MCP_TOOLS_PRIMEIRA_ONDA);
    this.tools = new Map(
      definicoes.filter((tool) => permitidas.has(tool.nome)).map((tool) => [tool.nome, tool]),
    );
  }

  listar(principal: McpPrincipal): McpToolDefinition[] {
    return [...this.tools.values()].filter((tool) => this.autorizada(tool, principal));
  }

  async executar(
    nome: string,
    input: Record<string, unknown>,
    principal: McpPrincipal,
  ): Promise<unknown> {
    const tool = this.tools.get(nome);
    if (!tool || !this.autorizada(tool, principal)) {
      throw new ForbiddenException('Tool não autorizada ou scope insuficiente');
    }
    if (this.contemCampoIsolamento(input)) {
      throw new ForbiddenException('Identificadores de isolamento não são aceitos');
    }
    return tool.handler(input, principal);
  }

  private autorizada(tool: McpToolDefinition, principal: McpPrincipal): boolean {
    return principal.scopes.includes(tool.scope) && tool.perfis.includes(principal.perfil);
  }

  private contemCampoIsolamento(valor: unknown): boolean {
    if (Array.isArray(valor)) return valor.some((item) => this.contemCampoIsolamento(item));
    if (!valor || typeof valor !== 'object') return false;
    return Object.entries(valor as Record<string, unknown>).some(
      ([chave, item]) => CAMPOS_ISOLAMENTO.has(chave) || this.contemCampoIsolamento(item),
    );
  }
}

import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { McpRegistryService } from './mcp-registry.service';
import { McpPrincipal } from './mcp.types';

@Injectable()
export class McpServerService {
  constructor(private readonly registry: McpRegistryService) {}

  async atender(req: Request, res: Response, principal: McpPrincipal): Promise<void> {
    const server = new McpServer({ name: 'ChekAI', version: '1.0.0' });
    for (const tool of this.registry.listar(principal)) {
      server.registerTool(
        tool.nome,
        {
          description: tool.descricao,
          inputSchema: (tool.inputSchema as any) ?? z.object({}).passthrough(),
        },
        async (input: Record<string, unknown>) => {
          try {
            const resultado = await this.registry.executar(tool.nome, input, principal);
            return {
              content: [{ type: 'text' as const, text: JSON.stringify(resultado) }],
            };
          } catch (erro) {
            const mensagem = erro instanceof Error ? erro.message : 'Não foi possível executar a operação';
            return {
              isError: true,
              content: [{ type: 'text' as const, text: mensagem }],
            };
          }
        },
      );
    }
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    try {
      await transport.handleRequest(req, res, req.body);
    } finally {
      await server.close();
    }
  }
}

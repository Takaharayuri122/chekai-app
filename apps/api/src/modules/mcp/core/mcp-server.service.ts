import { Injectable } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { OauthMetadataService } from '../oauth/oauth-metadata.service';
import { McpRegistryService } from './mcp-registry.service';
import { McpPrincipal } from './mcp.types';

interface ChamadaTool {
  id: unknown;
  nome: string;
  argumentos: unknown;
}

@Injectable()
export class McpServerService {
  constructor(
    private readonly registry: McpRegistryService,
    private readonly metadata: OauthMetadataService,
  ) {}

  async atender(req: Request, res: Response, principal: McpPrincipal): Promise<void> {
    const chamadas = chamadasTool(corpoDaRequisicao(req.body));
    const scopeAusente = chamadas
      .map((chamada) => this.scopeAusente(chamada.nome, principal))
      .find((scope) => scope !== null);
    if (scopeAusente) {
      this.responderScopeInsuficiente(res, scopeAusente);
      return;
    }
    const isolamento = chamadas.find((chamada) => (
      this.registry.definicao(chamada.nome) !== undefined
      && this.registry.entradaVazaIsolamento(chamada.argumentos)
    ));
    if (isolamento) {
      this.responderIsolamento(res, isolamento.id);
      return;
    }

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

  private scopeAusente(nome: string, principal: McpPrincipal): string | null {
    const tool = this.registry.definicao(nome);
    if (!tool || !tool.perfis.includes(principal.perfil)) return null;
    return principal.scopes.includes(tool.scope) ? null : tool.scope;
  }

  private responderScopeInsuficiente(res: Response, scope: string): void {
    const desafio = this.metadata.respostaNaoAutenticado().headers['WWW-Authenticate'];
    const recurso = /resource_metadata="([^"]+)"/.exec(desafio)?.[1];
    let cabecalho = `Bearer error="insufficient_scope", error_description="Insufficient scope", scope="${scope}"`;
    if (recurso) cabecalho += `, resource_metadata="${recurso}"`;
    res.statusCode = 403;
    res.setHeader('WWW-Authenticate', cabecalho);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      error: 'insufficient_scope',
      error_description: 'Insufficient scope',
    }));
  }

  private responderIsolamento(res: Response, id: unknown): void {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        isError: true,
        content: [{
          type: 'text',
          text: 'Identificadores de isolamento não são aceitos',
        }],
      },
    }));
  }
}

function corpoDaRequisicao(body: unknown): unknown {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return undefined;
  }
}

function chamadasTool(body: unknown): ChamadaTool[] {
  const mensagens = Array.isArray(body) ? body : [body];
  const chamadas: ChamadaTool[] = [];
  for (const mensagem of mensagens) {
    if (!mensagem || typeof mensagem !== 'object') continue;
    const pedido = mensagem as {
      id?: unknown;
      method?: unknown;
      params?: { name?: unknown; arguments?: unknown };
    };
    if (pedido.method !== 'tools/call' || typeof pedido.params?.name !== 'string') continue;
    chamadas.push({
      id: pedido.id ?? null,
      nome: pedido.params.name,
      argumentos: pedido.params.arguments,
    });
  }
  return chamadas;
}

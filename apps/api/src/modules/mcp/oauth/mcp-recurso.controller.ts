import { Controller, Get, Headers, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { OauthTokenService } from './oauth-token.service';

@ApiExcludeController()
@Controller('mcp')
export class McpRecursoController {
  constructor(private readonly tokens: OauthTokenService) {}

  @Get()
  async get(@Headers('authorization') authorization: string | undefined, @Res() res: Response): Promise<void> {
    if (!(await this.autorizado(authorization, res))) return;
    res.setHeader('Allow', 'POST');
    res.status(HttpStatus.METHOD_NOT_ALLOWED).end();
  }

  @Post()
  async post(@Headers('authorization') authorization: string | undefined, @Res() res: Response): Promise<void> {
    if (!(await this.autorizado(authorization, res))) return;
    res.status(HttpStatus.NOT_IMPLEMENTED).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32601, message: 'Servidor MCP ainda não disponível' },
    });
  }

  private async autorizado(authorization: string | undefined, res: Response): Promise<boolean> {
    const resultado = await this.tokens.exigirAcesso(authorization);
    if (resultado.ok) return true;
    res
      .status(resultado.status)
      .setHeader('WWW-Authenticate', resultado.headers['WWW-Authenticate'])
      .json({ error: 'invalid_token' });
    return false;
  }
}

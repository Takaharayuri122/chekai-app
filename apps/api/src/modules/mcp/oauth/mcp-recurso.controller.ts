import { All, Controller, Headers, Req, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { McpPrincipalService } from '../core/mcp-principal.service';
import { McpServerService } from '../core/mcp-server.service';
import { OauthTokenService } from './oauth-token.service';

@ApiExcludeController()
@Controller('mcp')
export class McpRecursoController {
  constructor(
    private readonly tokens: OauthTokenService,
    private readonly principals: McpPrincipalService,
    private readonly servidor: McpServerService,
  ) {}

  @All()
  async atender(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const resultado = await this.tokens.exigirAcesso(authorization);
    if (!resultado.ok) {
      res
        .status(resultado.status)
        .setHeader('WWW-Authenticate', resultado.headers['WWW-Authenticate'])
        .json({ error: 'invalid_token' });
      return;
    }
    const principal = await this.principals.obter(resultado.contexto);
    await this.servidor.atender(req, res, principal);
  }
}

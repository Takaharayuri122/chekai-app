import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { OauthAutorizacaoService } from './oauth-autorizacao.service';
import { OauthClienteService } from './oauth-cliente.service';
import { OauthTokenService } from './oauth-token.service';
import { Consentimento, PedidoToken, QueryAutorizacao, RespostaToken } from './oauth.types';

type Campos = Record<string, unknown>;

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor !== '' ? valor : undefined;
}

function erroOauth(status: number, error: string, descricao: string): HttpException {
  return new HttpException({ error, error_description: descricao }, status);
}

function queryAutorizacao(campos: Campos): QueryAutorizacao {
  return {
    responseType: texto(campos.response_type) ?? '',
    clientId: texto(campos.client_id) ?? '',
    redirectUri: texto(campos.redirect_uri) ?? '',
    codeChallenge: texto(campos.code_challenge),
    codeChallengeMethod: texto(campos.code_challenge_method),
    resource: texto(campos.resource),
    scope: texto(campos.scope),
    state: texto(campos.state),
  };
}

@ApiExcludeController()
@Controller('oauth')
export class OauthController {
  constructor(
    private readonly autorizacao: OauthAutorizacaoService,
    private readonly clientes: OauthClienteService,
    private readonly tokens: OauthTokenService,
  ) {}

  @Get('authorize')
  async iniciar(@Query() query: Campos, @Res() res: Response): Promise<void> {
    const { url } = await this.autorizacao.iniciarAutorizacao(queryAutorizacao(query));
    res.redirect(HttpStatus.FOUND, url);
  }

  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  consentir(@Body() body: Campos): Promise<{ redirectPara: string }> {
    const consentimento: Consentimento = {
      ...queryAutorizacao(body),
      sessaoConsentimento: texto(body.sessao_consentimento) ?? '',
      codeChallenge: texto(body.code_challenge) ?? '',
      codeChallengeMethod: texto(body.code_challenge_method) ?? '',
      resource: texto(body.resource) ?? '',
      scope: texto(body.scope) ?? '',
      state: texto(body.state) ?? '',
    };
    return this.autorizacao.consentir(consentimento);
  }

  @Post('otp/solicitar')
  @HttpCode(HttpStatus.OK)
  solicitarOtp(@Body() body: Campos): Promise<{ message: string }> {
    const email = texto(body.email);
    if (!email) throw new BadRequestException('E-mail é obrigatório');
    return this.autorizacao.solicitarOtp({ email });
  }

  @Post('otp/validar')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  validarOtp(@Body() body: Campos): Promise<{ sessaoConsentimento: string }> {
    const email = texto(body.email);
    const codigo = texto(body.codigo);
    if (!email || !codigo) throw new BadRequestException('E-mail e código são obrigatórios');
    return this.autorizacao.validarOtp({ email, codigo });
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  async token(@Body() body: Campos): Promise<RespostaToken> {
    const grantType = texto(body.grant_type);
    if (grantType !== 'authorization_code' && grantType !== 'refresh_token') {
      throw erroOauth(HttpStatus.BAD_REQUEST, 'unsupported_grant_type', 'grant_type não suportado');
    }
    const pedido: PedidoToken = {
      grantType,
      code: texto(body.code),
      redirectUri: texto(body.redirect_uri),
      codeVerifier: texto(body.code_verifier),
      resource: texto(body.resource),
      refreshToken: texto(body.refresh_token),
      clientId: texto(body.client_id),
    };
    try {
      return await this.tokens.emitirToken(pedido);
    } catch (erro) {
      if (erro instanceof UnauthorizedException) {
        throw erroOauth(HttpStatus.BAD_REQUEST, 'invalid_grant', erro.message);
      }
      if (erro instanceof BadRequestException) {
        throw erroOauth(HttpStatus.BAD_REQUEST, 'invalid_request', erro.message);
      }
      throw erro;
    }
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  async revogar(@Body() body: Campos): Promise<void> {
    const token = texto(body.token);
    if (!token) throw erroOauth(HttpStatus.BAD_REQUEST, 'invalid_request', 'token é obrigatório');
    await this.tokens.revogar({ token });
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Header('Cache-Control', 'no-store')
  async registrar(@Body() body: Campos) {
    const redirectUris = Array.isArray(body.redirect_uris) ? (body.redirect_uris as unknown[]) : [];
    const clientName = texto(body.client_name);
    try {
      const { client_id } = await this.clientes.registrar({
        clientName,
        redirectUris: redirectUris as string[],
      });
      return {
        client_id,
        client_name: clientName,
        redirect_uris: redirectUris,
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      };
    } catch (erro) {
      if (erro instanceof BadRequestException) {
        throw erroOauth(HttpStatus.BAD_REQUEST, 'invalid_client_metadata', erro.message);
      }
      throw erro;
    }
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OauthAmbiente {
  nodeEnv: string;
  frontendUrl: string;
  mcpPublicUrl: string;
  issuer: string;
  endpointMcp: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  chaveAssinatura: string;
  chaveJwtWeb: string;
  aceitaOtpMock: boolean;
}

const semBarraFinal = (valor: string): string => valor.replace(/\/+$/, '');

@Injectable()
export class OauthConfigService implements OnModuleInit {
  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.assertAmbiente();
  }

  assertAmbiente(): void {
    this.resolver();
  }

  resolver(): OauthAmbiente {
    const nodeEnv = this.ler('NODE_ENV') || 'development';
    const producao = nodeEnv === 'production';
    const frontendUrl = this.ler('FRONTEND_URL');
    const mcpPublicUrl = this.ler('MCP_PUBLIC_URL') || (producao ? '' : 'http://localhost:3001');
    const issuer = this.ler('OAUTH_ISSUER') || (producao ? '' : mcpPublicUrl);
    const accessRaw = this.ler('OAUTH_ACCESS_TOKEN_TTL') || (producao ? '' : '3600');
    const refreshRaw = this.ler('OAUTH_REFRESH_TOKEN_TTL') || (producao ? '' : '1209600');
    const chaveAssinatura = this.ler('OAUTH_JWT_SECRET') || (producao ? '' : 'dev-oauth-mcp-key');
    const chaveJwtWeb = this.ler('JWT_SECRET') || 'secret';
    const erros: string[] = [];

    if (!frontendUrl) erros.push('FRONTEND_URL');
    if (!mcpPublicUrl) erros.push('MCP_PUBLIC_URL');
    if (!issuer) erros.push('OAUTH_ISSUER');
    const accessTokenTtlSeconds = Number(accessRaw);
    const refreshTokenTtlSeconds = Number(refreshRaw);
    if (!Number.isInteger(accessTokenTtlSeconds) || accessTokenTtlSeconds <= 0) {
      erros.push('OAUTH_ACCESS_TOKEN_TTL');
    }
    if (!Number.isInteger(refreshTokenTtlSeconds) || refreshTokenTtlSeconds <= 0) {
      erros.push('OAUTH_REFRESH_TOKEN_TTL');
    }
    if (!chaveAssinatura) erros.push('OAUTH_JWT_SECRET');
    if (chaveAssinatura && chaveAssinatura === chaveJwtWeb) {
      erros.push('OAUTH_JWT_SECRET deve ser diferente de JWT_SECRET');
    }
    if (erros.length) {
      throw new Error(`Configuração OAuth inválida: ${erros.join(', ')}`);
    }

    const publicUrl = semBarraFinal(mcpPublicUrl);
    return {
      nodeEnv,
      frontendUrl: semBarraFinal(frontendUrl),
      mcpPublicUrl: publicUrl,
      issuer: semBarraFinal(issuer),
      endpointMcp: `${publicUrl}/mcp`,
      accessTokenTtlSeconds,
      refreshTokenTtlSeconds,
      chaveAssinatura,
      chaveJwtWeb,
      aceitaOtpMock: !producao,
    };
  }

  private ler(chave: string): string {
    const valor = this.config.get<string>(chave);
    return typeof valor === 'string' ? valor.trim() : '';
  }
}

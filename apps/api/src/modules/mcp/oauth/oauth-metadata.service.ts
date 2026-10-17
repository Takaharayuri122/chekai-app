import { Injectable } from '@nestjs/common';
import { SCOPES_OPERACIONAIS } from './oauth.constants';
import { OauthConfigService } from './oauth-config.service';

@Injectable()
export class OauthMetadataService {
  constructor(private readonly config: OauthConfigService) {}

  authorizationServer() {
    const ambiente = this.config.resolver();
    return {
      issuer: ambiente.issuer,
      authorization_endpoint: `${ambiente.mcpPublicUrl}/oauth/authorize`,
      token_endpoint: `${ambiente.mcpPublicUrl}/oauth/token`,
      revocation_endpoint: `${ambiente.mcpPublicUrl}/oauth/revoke`,
      registration_endpoint: `${ambiente.mcpPublicUrl}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: [...SCOPES_OPERACIONAIS],
    };
  }

  recursoProtegido() {
    const ambiente = this.config.resolver();
    return {
      resource: ambiente.endpointMcp,
      authorization_servers: [ambiente.issuer],
      bearer_methods_supported: ['header'],
      scopes_supported: [...SCOPES_OPERACIONAIS],
    };
  }

  respostaNaoAutenticado() {
    const { mcpPublicUrl } = this.config.resolver();
    return {
      ok: false as const,
      status: 401 as const,
      headers: {
        'WWW-Authenticate':
          `Bearer error="invalid_token", resource_metadata="${mcpPublicUrl}/.well-known/oauth-protected-resource"`,
      },
    };
  }
}

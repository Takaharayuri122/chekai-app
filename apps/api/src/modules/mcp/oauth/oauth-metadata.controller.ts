import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { OauthMetadataService } from './oauth-metadata.service';

@ApiExcludeController()
@Controller('.well-known')
export class OauthMetadataController {
  constructor(private readonly metadata: OauthMetadataService) {}

  @Get('oauth-authorization-server')
  @Header('Cache-Control', 'public, max-age=300')
  authorizationServer() {
    return this.metadata.authorizationServer();
  }

  @Get('oauth-protected-resource')
  @Header('Cache-Control', 'public, max-age=300')
  recursoProtegido() {
    return this.metadata.recursoProtegido();
  }
}

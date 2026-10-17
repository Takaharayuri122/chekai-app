import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgendaModule } from '../agenda/agenda.module';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { ChecklistModule } from '../checklist/checklist.module';
import { ClienteModule } from '../cliente/cliente.module';
import { EmailModule } from '../email/email.module';
import { EmailService } from '../email/email.service';
import { PlanoAcaoModule } from '../plano-acao/plano-acao.module';
import { RelatorioTecnicoModule } from '../relatorio-tecnico/relatorio-tecnico.module';
import { UsuarioModule } from '../usuario/usuario.module';
import { CimdHttp } from './oauth/cimd-http';
import { OauthAccessTokenEntity } from './oauth/entities/oauth-access-token.entity';
import { OauthAuthorizationCodeEntity } from './oauth/entities/oauth-authorization-code.entity';
import { OauthClienteEntity } from './oauth/entities/oauth-cliente.entity';
import { OauthConcessaoEntity } from './oauth/entities/oauth-concessao.entity';
import { OauthRefreshTokenEntity } from './oauth/entities/oauth-refresh-token.entity';
import { OauthSessaoConsentimentoEntity } from './oauth/entities/oauth-sessao-consentimento.entity';
import { McpRecursoController } from './oauth/mcp-recurso.controller';
import { OauthAutorizacaoService } from './oauth/oauth-autorizacao.service';
import { OauthClienteService } from './oauth/oauth-cliente.service';
import { OauthConfigService } from './oauth/oauth-config.service';
import { OauthMetadataController } from './oauth/oauth-metadata.controller';
import { OauthMetadataService } from './oauth/oauth-metadata.service';
import { OauthTokenService } from './oauth/oauth-token.service';
import { OauthController } from './oauth/oauth.controller';
import {
  EmailOtpPorta,
  OauthAccessRepositorio,
  OauthCimdPorta,
  OauthClienteRepositorio,
  OauthCodeRepositorio,
  OauthConcessaoRepositorio,
  OauthRefreshRepositorio,
  OauthSessaoRepositorio,
  RelogioPorta,
  SegredoPorta,
  UsuarioOtpPorta,
} from './oauth/oauth.types';
import { RelogioSistema } from './oauth/relogio.sistema';
import { OauthAccessTypeorm } from './oauth/repositorios/oauth-access.typeorm';
import { OauthClienteTypeorm } from './oauth/repositorios/oauth-cliente.typeorm';
import { OauthCodeTypeorm } from './oauth/repositorios/oauth-code.typeorm';
import { OauthConcessaoTypeorm } from './oauth/repositorios/oauth-concessao.typeorm';
import { OauthRefreshTypeorm } from './oauth/repositorios/oauth-refresh.typeorm';
import { OauthSessaoTypeorm } from './oauth/repositorios/oauth-sessao.typeorm';
import { SegredoCripto } from './oauth/segredo.cripto';
import { UsuarioOtpAdaptador } from './oauth/usuario-otp.adaptador';
import { McpConfirmationService } from './core/mcp-confirmation.service';
import { McpPrincipalService } from './core/mcp-principal.service';
import {
  MCP_TOOL_DEFINITIONS,
  McpRegistryService,
} from './core/mcp-registry.service';
import { McpServerService } from './core/mcp-server.service';
import { McpToolsService } from './tools/mcp-tools.service';

/**
 * Canal MCP: servidor de autorização OAuth 2.1 e recurso protegido `/mcp`.
 * O `JwtModule` é local e assina só com `OAUTH_JWT_SECRET`, isolado do JWT web.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      OauthClienteEntity,
      OauthSessaoConsentimentoEntity,
      OauthAuthorizationCodeEntity,
      OauthConcessaoEntity,
      OauthRefreshTokenEntity,
      OauthAccessTokenEntity,
    ]),
    UsuarioModule,
    EmailModule,
    ClienteModule,
    ChecklistModule,
    AuditoriaModule,
    AgendaModule,
    PlanoAcaoModule,
    RelatorioTecnicoModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [OauthConfigService],
      extraProviders: [OauthConfigService],
      useFactory: (config: OauthConfigService) => ({
        secret: config.resolver().chaveAssinatura,
        signOptions: { algorithm: 'HS256' },
        verifyOptions: { algorithms: ['HS256'] },
      }),
    }),
  ],
  controllers: [OauthMetadataController, OauthController, McpRecursoController],
  providers: [
    OauthConfigService,
    OauthMetadataService,
    OauthClienteService,
    OauthAutorizacaoService,
    OauthTokenService,
    McpConfirmationService,
    McpPrincipalService,
    McpRegistryService,
    McpServerService,
    McpToolsService,
    {
      provide: MCP_TOOL_DEFINITIONS,
      inject: [McpToolsService],
      useFactory: (tools: McpToolsService) => tools.definicoes(),
    },
    { provide: UsuarioOtpPorta, useClass: UsuarioOtpAdaptador },
    { provide: EmailOtpPorta, useExisting: EmailService },
    { provide: RelogioPorta, useClass: RelogioSistema },
    { provide: SegredoPorta, useClass: SegredoCripto },
    { provide: OauthCimdPorta, useClass: CimdHttp },
    { provide: OauthClienteRepositorio, useClass: OauthClienteTypeorm },
    { provide: OauthSessaoRepositorio, useClass: OauthSessaoTypeorm },
    { provide: OauthCodeRepositorio, useClass: OauthCodeTypeorm },
    { provide: OauthConcessaoRepositorio, useClass: OauthConcessaoTypeorm },
    { provide: OauthRefreshRepositorio, useClass: OauthRefreshTypeorm },
    { provide: OauthAccessRepositorio, useClass: OauthAccessTypeorm },
  ],
})
export class McpModule {}

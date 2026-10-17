# Brief — Fundação OAuth 2.1 do canal MCP

Fatia anterior às tools. Cobre UC-01 e UC-02 de `servidor-mcp.use-cases.md`. A especificação executável é `apps/api/src/modules/mcp/oauth/oauth-fundacao.spec.ts`. Este brief trava módulos NestJS 10, portas, colunas TypeORM e o DDL que a implementação deve gravar em `scripts/criar-tabelas-oauth-mcp.sql`.

Fora desta fatia: registry, `tools/list`, `tools/call`, handlers de domínio, tela Next e qualquer alteração de `AuthService.validarOtp` / `JwtStrategy`.

## Módulos

```
apps/api/src/modules/mcp/
  mcp.module.ts
  oauth/
    oauth.constants.ts
    oauth.types.ts
    oauth-hash.util.ts
    oauth-config.service.ts
    oauth-cliente.service.ts
    oauth-autorizacao.service.ts
    oauth-token.service.ts
    oauth-metadata.service.ts
    oauth-metadata.controller.ts
    oauth.controller.ts
    mcp-recurso.controller.ts
    relogio.sistema.ts
    segredo.cripto.ts
    cimd-http.ts
    entities/*.entity.ts
    repositorios/*.typeorm.ts
scripts/criar-tabelas-oauth-mcp.sql
```

`McpModule` importa `ConfigModule`, `TypeOrmModule.forFeature` das seis entidades, `UsuarioModule` e `EmailModule`. Registra um `JwtModule.registerAsync` local, com `OAUTH_JWT_SECRET`, sem `global: true` e sem reutilizar o `JwtModule` de `AuthModule`. Não importa módulos de cliente, checklist, auditoria, agenda, plano de ação ou relatório.

`AppModule` importa `McpModule`. `main.ts` passa a lista abaixo para o prefixo:

```typescript
app.setGlobalPrefix('api', {
  exclude: ROTAS_OAUTH_SEM_PREFIXO_API,
});
```

`OauthConfigService` implementa `OnModuleInit` e chama `assertAmbiente()` de forma síncrona. O construtor não lança.

## Relógio, segredo e hash

O relógio de expiração, `iat` e `exp` é `RelogioPorta.agora()`. `jsonwebtoken` recebe `clockTimestamp` desse relógio. Não usar `Date.now()` nem `expiresIn` junto com `exp` no payload.

```typescript
export function hashSegredo(valor: string): string {
  return createHash('sha256').update(valor, 'utf8').digest('hex');
}
```

PKCE S256: `createHash('sha256').update(verifier).digest('base64url')`, comparação com `timingSafeEqual` quando os buffers têm o mesmo tamanho.

`SegredoCripto`: OTP com o mesmo gerador de 6 dígitos já usado em `AuthService`; `opaco()` é `randomBytes(32).toString('base64url')`; `uuid()` é `randomUUID()`.

OTP continua em `usuarios.otp_code` / `otp_expires_at`. Não chamar `AuthService.validarOtp` nem `AuthService.login`: o primeiro emite JWT web. A sessão de consentimento é opaca, de uso único, validade de 10 minutos, e só o hash é gravado. O mock `252622` vale quando `NODE_ENV !== 'production'` e não apaga um OTP real já gravado. Fora isso, as mensagens copiam `AuthService`:

- `nao_confirmado` ao solicitar: `Convite pendente. Verifique seu e-mail para aceitar o convite.`
- `inativo` ao solicitar: `Usuário inativo`
- validar sem conta ativa: `Usuário inativo ou não confirmado`
- OTP ausente ou mock em produção: `Código OTP não solicitado ou expirado` (`BadRequestException`)
- OTP divergente: `UnauthorizedException`
- OTP expirado: `BadRequestException`
- sucesso de solicitar: `{ message: 'Código OTP enviado por e-mail' }`

Code e sessão de consentimento expiram em 10 minutos. Access e refresh usam os TTLs configurados.

## Ambiente

Ler o `ConfigService`. Fora de produção, default só depois que `get` volta vazio — o serviço aplica o default, não depende do segundo argumento.

| Variável | Produção | Fora de produção, se vazia |
|---|---|---|
| `FRONTEND_URL` | obrigatória em todo ambiente; erro contém `FRONTEND_URL` e não assume localhost | igual |
| `MCP_PUBLIC_URL` | obrigatória | `http://localhost:3001` |
| `OAUTH_ISSUER` | obrigatória | a URL pública já normalizada |
| `OAUTH_ACCESS_TOKEN_TTL` | inteiro positivo, em segundos | `3600` |
| `OAUTH_REFRESH_TOKEN_TTL` | inteiro positivo, em segundos | `1209600` |
| `OAUTH_JWT_SECRET` | obrigatória e diferente de `JWT_SECRET` | `dev-oauth-mcp-key` |
| `JWT_SECRET` | comparada com a chave OAuth | `secret`, o mesmo default de `JwtStrategy` |

`onModuleInit` / `assertAmbiente` em produção lista na mesma `Error` cada item ausente ou inválido (`MCP_PUBLIC_URL`, `OAUTH_ISSUER`, `OAUTH_ACCESS_TOKEN_TTL`, `OAUTH_REFRESH_TOKEN_TTL`, `OAUTH_JWT_SECRET`). Chaves iguais mencionam `OAUTH_JWT_SECRET` e `JWT_SECRET`. Remover barra final das URLs antes de montar paths.

```typescript
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

export class OauthConfigService {
  constructor(configService: ConfigService);
  onModuleInit(): void;
  assertAmbiente(): void;
  resolver(): OauthAmbiente;
}
```

`endpointMcp` é `${mcpPublicUrl}/mcp`. `iss` do JWT é `OAUTH_ISSUER`. `aud` e `resource` são `endpointMcp`. Os endpoints HTTP do metadata usam `MCP_PUBLIC_URL`, não o issuer.

## Portas

```typescript
export interface UsuarioOtp {
  id: string;
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  status: StatusUsuario;
  gestorId: string | null;
  tenantId: string | null;
  otpCode: string | null;
  otpExpiresAt: Date | null;
}

export abstract class UsuarioOtpPorta {
  abstract buscarPorEmail(email: string): Promise<UsuarioOtp | null>;
  abstract buscarPorId(id: string): Promise<UsuarioOtp | null>;
  abstract atualizarOtp(id: string, codigo: string, expiraEm: Date): Promise<void>;
  abstract limparOtp(id: string): Promise<void>;
}

export abstract class EmailOtpPorta {
  abstract enviarEmailOTP(email: string, nome: string, codigo: string): Promise<void>;
}

export abstract class RelogioPorta {
  abstract agora(): Date;
}

export abstract class SegredoPorta {
  abstract otp(): string;
  abstract opaco(): string;
  abstract uuid(): string;
}

export interface ClienteOauth {
  id: string;
  clientId: string;
  nome: string | null;
  redirectUris: string[];
  origem: 'cimd' | 'registro';
  documento: { redirect_uris: string[]; client_name?: string } | null;
}

export abstract class OauthClienteRepositorio {
  abstract buscarPorClientId(clientId: string): Promise<ClienteOauth | null>;
  abstract salvar(cliente: ClienteOauth): Promise<void>;
}

export interface DocumentoCimd {
  redirect_uris: string[];
  client_name?: string;
}

export abstract class OauthCimdPorta {
  abstract obter(clientId: string): Promise<DocumentoCimd | null>;
}

export interface SessaoConsentimento {
  id: string;
  sessaoHash: string;
  usuarioId: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

export abstract class OauthSessaoRepositorio {
  abstract salvar(sessao: SessaoConsentimento): Promise<void>;
  abstract buscarPorHash(sessaoHash: string): Promise<SessaoConsentimento | null>;
  abstract marcarUsada(id: string, quando: Date): Promise<void>;
}

export interface AuthorizationCodeOauth {
  id: string;
  codeHash: string;
  clienteId: string;
  usuarioId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  resource: string;
  scopes: string;
  expiraEm: Date;
  usadoEm: Date | null;
}

export abstract class OauthCodeRepositorio {
  abstract salvar(code: AuthorizationCodeOauth): Promise<void>;
  abstract buscarPorHash(codeHash: string): Promise<AuthorizationCodeOauth | null>;
  abstract marcarUsado(id: string, quando: Date): Promise<void>;
}

export interface ConcessaoOauth {
  id: string;
  clienteId: string;
  usuarioId: string;
  resource: string;
  scopes: string;
  revogadaEm: Date | null;
}

export abstract class OauthConcessaoRepositorio {
  abstract salvar(concessao: ConcessaoOauth): Promise<void>;
  abstract buscarPorId(id: string): Promise<ConcessaoOauth | null>;
  abstract revogar(id: string, quando: Date): Promise<void>;
}

export interface RefreshOauth {
  id: string;
  tokenHash: string;
  concessaoId: string;
  expiraEm: Date;
  usadoEm: Date | null;
  revogadoEm: Date | null;
}

export abstract class OauthRefreshRepositorio {
  abstract salvar(refresh: RefreshOauth): Promise<void>;
  abstract buscarPorHash(tokenHash: string): Promise<RefreshOauth | null>;
  abstract marcarUsado(id: string, quando: Date): Promise<void>;
  abstract revogarPorConcessao(concessaoId: string, quando: Date): Promise<void>;
}

export interface AccessOauth {
  id: string;
  jti: string;
  tokenHash: string;
  concessaoId: string;
  expiraEm: Date;
  revogadoEm: Date | null;
}

export abstract class OauthAccessRepositorio {
  abstract salvar(access: AccessOauth): Promise<void>;
  abstract buscarPorHash(tokenHash: string): Promise<AccessOauth | null>;
  abstract buscarPorJti(jti: string): Promise<AccessOauth | null>;
  abstract revogarPorConcessao(concessaoId: string, quando: Date): Promise<void>;
}
```

Os `buscar*` devolvem cópia. Mutar o objeto retornado não persiste: a implementação chama `marcarUsado`, `marcarUsada`, `revogar` ou `revogarPorConcessao`.

Nest injeta `UsuarioService` em `UsuarioOtpPorta` e `EmailService` em `EmailOtpPorta` com `useExisting`. As classes TypeORM estendem os repositórios abstratos.

## Cliente

```typescript
export class OauthClienteService {
  constructor(repositorio: OauthClienteRepositorio, cimd: OauthCimdPorta, segredos: SegredoPorta);
  resolver(clientId: string): Promise<ClienteOauth | null>;
  registrar(input: { clientName?: string; redirectUris: string[] }): Promise<{ client_id: string }>;
}
```

`resolver`: banco primeiro. Se não houver linha e `clientId` começar com `https://`, chama a porta CIMD, exige `redirect_uris` não vazio, grava `origem: 'cimd'`, `nome` = `client_name` ou `null`, `documento` = o JSON obtido, `id` = `segredos.uuid()`, `clientId` = a própria URL. `http://` e client id opaco desconhecido não chamam a porta. A segunda resolução do mesmo URL não busca de novo.

`registrar`: `redirectUris` vazio lança `BadRequestException`. Gera `client_id` opaco com `segredos.uuid()` (não é URL), `origem: 'registro'`, `documento: null`.

`CimdHttp.obter`: `GET` somente `https`, timeout de 5s, sem credencial, sem seguir troca de esquema. O spec cobre a porta, não o HTTP real.

Comparação de `redirect_uri` é igualdade exata, inclusive barra final. Redirect divergente não devolve URL para o cliente: `BadRequestException` já em `iniciarAutorizacao`.

## Autorização

```typescript
export interface QueryAutorizacao {
  responseType: string;
  clientId: string;
  redirectUri: string;
  codeChallenge?: string;
  codeChallengeMethod?: string;
  resource?: string;
  scope?: string;
  state?: string;
}

export interface Consentimento extends QueryAutorizacao {
  sessaoConsentimento: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  scope: string;
  state: string;
}

export class OauthAutorizacaoService {
  constructor(
    config: OauthConfigService,
    usuarios: UsuarioOtpPorta,
    clientes: OauthClienteService,
    sessoes: OauthSessaoRepositorio,
    codes: OauthCodeRepositorio,
    email: EmailOtpPorta,
    relogio: RelogioPorta,
    segredos: SegredoPorta,
  );
  solicitarOtp(input: { email: string }): Promise<{ message: string }>;
  validarOtp(input: { email: string; codigo: string }): Promise<{ sessaoConsentimento: string }>;
  iniciarAutorizacao(query: QueryAutorizacao): Promise<{ url: string }>;
  consentir(input: Consentimento): Promise<{ redirectPara: string }>;
}
```

`iniciarAutorizacao` valida e devolve `${frontendUrl}/oauth/autorizar` com query snake_case (`client_id`, `redirect_uri`, `code_challenge`, `code_challenge_method`, `resource`, `scope`, `state`, `response_type`). Não emite code.

Recusa com `BadRequestException`, sem gravar code: `response_type !== 'code'`, `state` ausente, PKCE ausente ou método diferente de `S256`, `resource` diferente do endpoint MCP, cliente desconhecido, `redirect_uri` diferente da lista, scope vazio, scope com item fora de `SCOPES_OPERACIONAIS`. Scope inválido recusa o pedido inteiro.

`consentir` repete essas checagens, exige sessão válida do usuário ativo, marca a sessão como usada e grava só `hashSegredo(code)`. `redirectPara` é `${redirectUri}?code=&state=`. Reapresentar a sessão lança `UnauthorizedException`.

O controller traduz snake_case HTTP para esses métodos. `GET /oauth/authorize` responde 302 para `url`. `POST /oauth/authorize` responde 200 `{ redirectPara }`.

## Token

```typescript
export interface PedidoToken {
  grantType: 'authorization_code' | 'refresh_token';
  code?: string;
  redirectUri?: string;
  codeVerifier?: string;
  resource?: string;
  refreshToken?: string;
  clientId?: string;
}

export interface RespostaToken {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export type ResultadoAcessoMcp =
  | {
      ok: true;
      contexto: {
        id: string;
        email: string;
        perfil: PerfilUsuario;
        gestorId: string | null;
        tenantId: string | null;
        scope: string;
        jti: string;
      };
    }
  | { ok: false; status: 401; headers: { 'WWW-Authenticate': string } };

export class OauthTokenService {
  constructor(
    config: OauthConfigService,
    usuarios: UsuarioOtpPorta,
    codes: OauthCodeRepositorio,
    concessoes: OauthConcessaoRepositorio,
    refreshes: OauthRefreshRepositorio,
    acessos: OauthAccessRepositorio,
    relogio: RelogioPorta,
    segredos: SegredoPorta,
  );
  emitirToken(pedido: PedidoToken): Promise<RespostaToken>;
  revogar(pedido: { token: string }): Promise<void>;
  exigirAcesso(authorization: string | undefined): Promise<ResultadoAcessoMcp>;
}
```

O controller mapeia `grant_type`, `redirect_uri`, `code_verifier`, `refresh_token`, `client_id`. A resposta já é o JSON OAuth.

Troca do code (`UnauthorizedException`, sem token): verifier ausente ou divergente, `redirect_uri` / `resource` / `client_id` diferentes do code, code expirado ou já usado. Se o code foi encontrado, a tentativa falha e marca `usadoEm`, para não servir de retry. A segunda apresentação do mesmo code, mesmo com verifier certo, recusa e não cria outra concessão.

Troca bem-sucedida cria uma concessão e grava hash do refresh e hash do access (`hashSegredo` do JWT cru) mais `jti`. `jti` e os `id` persistidos saem de `segredos.uuid()`, no formato aceito pela coluna UUID. Claims do access, e somente estes de negócio: `iss`, `sub`, `aud`, `resource`, `scope`, `perfil`, `jti`, mais `iat`/`exp`. Sem `gestorId` e sem `tenantId`. `perfil` sai do usuário relido. `aud` é string.

`exigirAcesso` verifica assinatura com a chave OAuth, `iss`, `aud` e o claim `resource`. JWT web não passa. JTI ausente, access revogado, concessão revogada, expirado ou usuário fora de `ativo` devolvem `{ ok: false, status: 401 }` com o mesmo `WWW-Authenticate` de `OauthMetadataService.respostaNaoAutenticado()`. O contexto usa perfil, `gestorId`, `tenantId` e e-mail do banco. Um JWT com a chave OAuth e o mesmo `jti`, mas `aud` ou `resource` diferentes, não autoriza e não revoga a família.

Refresh: relê o usuário. Conta inativa recusa sem marcar o refresh como usado e sem emitir outro. Uso válido marca o refresh apresentado, emite access novo e refresh novo. O access anterior permanece até expirar ou até a família cair. Reapresentar refresh já rotacionado (`usadoEm` preenchido) revoga a concessão, todos os refresh e todos os access da família, e não devolve token. Refresh de família já revogada recusa. Não ficam dois refresh vigentes.

`revogar` aceita o access ou o refresh em claro, localiza pelo hash e revoga a família. Token desconhecido ou já revogado resolve `void`.

Access expirado no MCP devolve 401 com `resource_metadata`. O refresh, se ainda vigente, continua renovando.

## Metadata e rotas

```typescript
export const SCOPES_OPERACIONAIS = [
  'chekai:contexto',
  'chekai:clientes:ler',
  'chekai:checklists:ler',
  'chekai:auditorias:ler',
  'chekai:auditorias:escrever',
  'chekai:auditorias:finalizar',
  'chekai:agenda:ler',
  'chekai:agenda:concluir',
  'chekai:tarefas:ler',
  'chekai:tarefas:escrever',
  'chekai:relatorios:ler',
  'chekai:relatorios:escrever',
  'chekai:relatorios:finalizar',
] as const;

export const ROTAS_OAUTH_SEM_PREFIXO_API: Array<{ path: string; method: RequestMethod }> = [
  { path: '.well-known/oauth-authorization-server', method: RequestMethod.GET },
  { path: '.well-known/oauth-protected-resource', method: RequestMethod.GET },
  { path: 'oauth/authorize', method: RequestMethod.GET },
  { path: 'oauth/authorize', method: RequestMethod.POST },
  { path: 'oauth/otp/solicitar', method: RequestMethod.POST },
  { path: 'oauth/otp/validar', method: RequestMethod.POST },
  { path: 'oauth/token', method: RequestMethod.POST },
  { path: 'oauth/revoke', method: RequestMethod.POST },
  { path: 'oauth/register', method: RequestMethod.POST },
  { path: 'mcp', method: RequestMethod.GET },
  { path: 'mcp', method: RequestMethod.POST },
];
```

`WWW-Authenticate` contém `error="invalid_token"` e `resource_metadata="<mcpPublicUrl>/.well-known/oauth-protected-resource"`. Nenhuma URL leva `/api/`.

`GET/POST /mcp` chama `exigirAcesso`. Sem acesso, responde 401 com esse header. Com acesso, não há registry nem chamada a service de domínio nesta fatia.

## Schema

Gravar o DDL em `scripts/criar-tabelas-oauth-mcp.sql`. Entidades TypeORM usam os mesmos nomes (`name: 'code_hash'`, `CreateDateColumn()` para `"criadoEm"`). Sem migration TypeORM. Sem coluna de code, sessão, refresh ou access em claro.

```sql
CREATE TABLE IF NOT EXISTS oauth_clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id TEXT NOT NULL UNIQUE,
  nome VARCHAR(255),
  redirect_uris JSONB NOT NULL,
  origem VARCHAR(16) NOT NULL CHECK (origem IN ('cimd', 'registro')),
  documento JSONB,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  "atualizadoEm" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_sessoes_consentimento (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sessao_hash VARCHAR(64) NOT NULL UNIQUE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira_em TIMESTAMP NOT NULL,
  usado_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code_hash VARCHAR(64) NOT NULL UNIQUE,
  cliente_id UUID NOT NULL REFERENCES oauth_clientes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  code_challenge_method VARCHAR(8) NOT NULL DEFAULT 'S256',
  resource TEXT NOT NULL,
  scopes TEXT NOT NULL,
  expira_em TIMESTAMP NOT NULL,
  usado_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_concessoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cliente_id UUID NOT NULL REFERENCES oauth_clientes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  resource TEXT NOT NULL,
  scopes TEXT NOT NULL,
  revogada_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now(),
  "atualizadoEm" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  concessao_id UUID NOT NULL REFERENCES oauth_concessoes(id) ON DELETE CASCADE,
  expira_em TIMESTAMP NOT NULL,
  usado_em TIMESTAMP,
  revogado_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS oauth_access_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  jti UUID NOT NULL UNIQUE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  concessao_id UUID NOT NULL REFERENCES oauth_concessoes(id) ON DELETE CASCADE,
  expira_em TIMESTAMP NOT NULL,
  revogado_em TIMESTAMP,
  "criadoEm" TIMESTAMP NOT NULL DEFAULT now()
);
```

Índices adicionais: `usuario_id` e `concessao_id` nas tabelas filhas. `scopes` é a string concedida, com espaços simples, na ordem pedida.

# Runbook de homologação e produção

Este runbook descreve a ordem. Ele não registra uma execução. Nesta mudança de documentação ninguém aplicou SQL, ninguém alterou variável na Railway e ninguém publicou o serviço.

O repositório documenta o projeto Railway de produção **ChekAI-PRD** e a API `https://api.chekai.com.br` em `docs/DEPLOY.md`. Não há um segundo host de homologação versionado. Homologação aqui significa um Postgres e um serviço da API que não sejam os de produção, com `FRONTEND_URL` apontando para um web que já tenha a rota `/oauth/autorizar`. Quem for executar precisa das credenciais desse ambiente. Não reutilize o `DATABASE_URL` de produção para ensaio.

O MCP sobe no mesmo serviço `@meta-app/api`. Não há serviço Railway novo. Schema continua script SQL em `scripts/`, não migration TypeORM.

## Antes de qualquer ambiente

1. O web desse ambiente já responde em `{FRONTEND_URL}/oauth/autorizar`.
2. `EMAIL_PROVIDER` desse ambiente entrega OTP (em produção, provedor HTTP na porta 443).
3. `JWT_SECRET` já existe e permanecerá a chave do web/mobile.
4. Gere outra chave para `OAUTH_JWT_SECRET` (por exemplo `openssl rand -base64 48`). As duas strings não podem ser iguais.
5. Confirme que `uuid_generate_v4()` existe no banco. Os scripts atuais do produto já dependem dela (`uuid-ossp` ou equivalente). Não instale extensão nova se a função já responder.

Pré-checagem, somente leitura:

```sql
SELECT EXISTS (
  SELECT 1 FROM pg_proc WHERE proname = 'uuid_generate_v4'
) AS uuid_generate_v4;

SELECT to_regclass('public.usuarios') AS usuarios;

SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'oauth_clientes',
    'oauth_sessoes_consentimento',
    'oauth_authorization_codes',
    'oauth_concessoes',
    'oauth_refresh_tokens',
    'oauth_access_tokens'
  );
```

A última consulta deve voltar vazia na primeira aplicação. Se alguma tabela já existir, pare e compare o DDL com `scripts/criar-tabelas-oauth-mcp.sql` antes de seguir. O script usa `CREATE TABLE IF NOT EXISTS` e não migra coluna divergente.

## Variáveis no serviço da API

Defina antes do deploy que passa a incluir este código. Sem isso, `NODE_ENV=production` impede a API de escutar.

| Variável | Homologação | Produção |
|----------|-------------|----------|
| `MCP_PUBLIC_URL` | origem pública da API de homologação, sem barra | `https://api.chekai.com.br` |
| `OAUTH_ISSUER` | a mesma origem, salvo proxy dedicado do metadata | `https://api.chekai.com.br` |
| `OAUTH_ACCESS_TOKEN_TTL` | `3600` | `3600` |
| `OAUTH_REFRESH_TOKEN_TTL` | `1209600` | `1209600` |
| `OAUTH_JWT_SECRET` | chave nova, diferente de `JWT_SECRET` | outra chave nova, diferente de `JWT_SECRET` e diferente da de homologação |
| `FRONTEND_URL` | URL do web de homologação, sem barra | a URL já usada pelos e-mails (`https://chekai.com.br` no guia atual) |

`OAUTH_ISSUER` diferente de `MCP_PUBLIC_URL` só se esse issuer publicar o well-known desta mesma API. No serviço único, os dois valores são iguais.

Uma réplica enquanto o token de finalização for memória de processo. Ver [seguranca.md](./seguranca.md).

## SQL de criação

Arquivo: `scripts/criar-tabelas-oauth-mcp.sql`.

Aplique no banco de homologação primeiro, com um papel que possa criar tabela. O script não altera `usuarios` além das FKs que apontam para `usuarios(id) ON DELETE CASCADE`. Apagar um usuário passa a apagar sessões, codes, concessões e tokens OAuth dele.

Ordem prática:

1. Backup lógico das tabelas `usuarios` não é obrigatório para este DDL, porque o script não dá `UPDATE` nem `DELETE` em dados de negócio. Um snapshot do banco antes do primeiro `CREATE` em produção ainda é o rollback mais simples se o DDL falhar no meio.
2. Rode o arquivo inteiro.
3. Confira:

```sql
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname LIKE 'oauth\_%' ESCAPE '\'
ORDER BY 1;
```

São seis tabelas: `oauth_access_tokens`, `oauth_authorization_codes`, `oauth_clientes`, `oauth_concessoes`, `oauth_refresh_tokens`, `oauth_sessoes_consentimento`.

## Publicar

1. Homologação: deploy do serviço da API com este código e as variáveis acima. O web de homologação precisa da página `/oauth/autorizar` no mesmo deploy ou num deploy anterior.
2. Sem abrir o MCP ainda em produção, exerça a homologação com conta real (o OTP mock não existe com `NODE_ENV=production`):

```bash
curl -sS -D - -o /tmp/oauth-resource.json \
  "https://<host-homolog>/.well-known/oauth-protected-resource"

curl -sS -D - -o /tmp/oauth-as.json \
  "https://<host-homolog>/.well-known/oauth-authorization-server"

curl -sS -D - -o /tmp/mcp-anon.json \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"runbook","version":"0"}}}' \
  "https://<host-homolog>/mcp"
```

Esperado: os dois well-known em 200; `resource` igual a `https://<host-homolog>/mcp`; `authorization_servers` com o issuer; `POST /mcp` em 401 com `resource_metadata` apontando para o well-known do recurso. Corpo `{ "error": "invalid_token" }`.

3. Conecte Cursor ou Claude pela URL de homologação, conclua e-mail e OTP, conceda os scopes e chame `chekai_me`. Confira que o perfil é o da conta e que não aparecem tools administrativas.
4. Só então repita variáveis, SQL e os três `curl` em produção (`https://api.chekai.com.br`). Produção usa outra `OAUTH_JWT_SECRET`.

Nenhum desses `curl` foi executado contra homologação ou produção nesta tarefa.

## Rollback

Escolha um. Os dois assumem que você ainda tem acesso ao banco. Nenhum deles foi executado aqui.

### Cortar acesso e manter o schema

Revoga concessões e tokens. Clientes OAuth cadastrados permanecem. A API continua no ar; chamadas MCP passam a 401 até uma autorização nova. Se a intenção for desligar o canal de vez, rode isto e em seguida remova as variáveis MCP ou faça o rollback de código.

```sql
BEGIN;

UPDATE oauth_concessoes
SET revogada_em = now(),
    "atualizadoEm" = now()
WHERE revogada_em IS NULL;

UPDATE oauth_refresh_tokens
SET revogado_em = now()
WHERE revogado_em IS NULL;

UPDATE oauth_access_tokens
SET revogado_em = now()
WHERE revogado_em IS NULL;

COMMIT;
```

### Remover o schema OAuth

Não apaga clientes, auditorias, usuários nem o restante do produto. Sessões de consentimento e tokens OAuth somem. Faça o corte de código (deploy sem o módulo, ou variáveis que impeçam o boot se o código novo continuar exigindo-as) em coordenação: o código deste branch espera as tabelas quando alguém autoriza.

```sql
BEGIN;

DROP TABLE IF EXISTS oauth_access_tokens;
DROP TABLE IF EXISTS oauth_refresh_tokens;
DROP TABLE IF EXISTS oauth_authorization_codes;
DROP TABLE IF EXISTS oauth_concessoes;
DROP TABLE IF EXISTS oauth_sessoes_consentimento;
DROP TABLE IF EXISTS oauth_clientes;

COMMIT;
```

Índices dessas tabelas caem junto. `usuarios` permanece.

Se o boot em produção passou a exigir as variáveis OAuth, voltar o código anterior também exige deploy. Remover só as variáveis com o código novo no ar derruba a API inteira, não só o MCP, porque `OauthConfigService` roda na inicialização do processo.

## Depois do rollback

- `POST /mcp` deixa de ser o canal autenticado se o código foi revertido, ou responde 401 se as concessões foram revogadas e o código continua.
- Web e mobile seguem no JWT antigo. A chave `JWT_SECRET` não entra no rollback.
- Confirme `/api/docs` e um login web. Isso também não foi executado nesta tarefa.

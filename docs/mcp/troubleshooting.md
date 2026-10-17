# Troubleshooting

## A API não sobe

Mensagem: `Configuração OAuth inválida: ...`.

Em `NODE_ENV=production` não há padrão. Confira `FRONTEND_URL`, `MCP_PUBLIC_URL`, `OAUTH_ISSUER`, `OAUTH_ACCESS_TOKEN_TTL`, `OAUTH_REFRESH_TOKEN_TTL` e `OAUTH_JWT_SECRET`. A chave OAuth tem de ser outra string, diferente de `JWT_SECRET`. TTL precisa ser inteiro positivo em segundos (`3600`, não `1h`). URLs com barra no final são aceitas e normalizadas; o cliente deve usar o endpoint sem barra duplicada (`/mcp`, não `/mcp/`).

`DATABASE_URL é obrigatória` é anterior ao MCP: a API não sobe sem Postgres. Não há modo MCP só em memória.

## 404 em `/mcp` ou metadata em `/api/...`

Discovery, OAuth e MCP estão fora do prefixo `/api`. Os caminhos certos:

- `GET /.well-known/oauth-protected-resource`
- `GET /.well-known/oauth-authorization-server`
- `GET` e `POST /oauth/authorize`
- `POST /oauth/otp/solicitar`, `/oauth/otp/validar`, `/oauth/token`, `/oauth/revoke`, `/oauth/register`
- `GET` e `POST /mcp`

`/api/mcp` não é o recurso. O `resource` do token é `{MCP_PUBLIC_URL}/mcp`.

## 401 em toda chamada

O cliente precisa do access token OAuth desta API, header `Authorization: Bearer`. JWT do web/mobile, token expirado, `iss` ou `aud` de outro ambiente, concessão revogada, conta inativa e token cujo hash não está em `oauth_access_tokens` caem no mesmo 401 `invalid_token`, com `resource_metadata`.

Se o issuer configurado não for o host que serve o well-known, o cliente busca o metadata no lugar errado. Em um único host, `OAUTH_ISSUER` e `MCP_PUBLIC_URL` são iguais.

## A tela de login não abre

`GET /oauth/authorize` só redireciona se o pedido estiver completo: `response_type=code`, `state`, `code_challenge`, `code_challenge_method=S256`, `resource` exatamente igual ao endpoint MCP, scopes da lista operacional e `redirect_uri` idêntica à do cliente. Senão a API responde 400 `Pedido OAuth inválido`, `Scope inválido` ou `Cliente ou redirect_uri inválido`.

A tela fica em `{FRONTEND_URL}/oauth/autorizar`. `FRONTEND_URL` errada manda o navegador para outro site. O web precisa estar no ar com essa rota antes do cliente concluir o login.

## OTP

- E-mail não cadastrado: 401.
- Convite ainda não aceito: 403, convite pendente.
- Conta inativa: 403 ou 401 na validação.
- OTP de 10 minutos. Código errado não emite sessão.
- Em desenvolvimento, `252622` passa sem o e-mail. Em produção esse código é ignorado e o e-mail tem de funcionar (provedor HTTP em `EMAIL_PROVIDER`; SMTP clássico estoura timeout na Railway).

## `invalid_grant` no token

Code expirado (10 minutos), já usado, `redirect_uri` diferente, `code_verifier` que não bate com o `code_challenge`, `resource` diferente ou `client_id` diferente. O code é invalidado na primeira apresentação, mesmo quando o verifier está errado.

Refresh já rotacionado: `Reuso de refresh token` e a família inteira é revogada. O cliente precisa autorizar de novo. Refresh expirado não gira.

## 403 `insufficient_scope`

A tool existe, o perfil pode usá-la, mas o scope não foi concedido. O header `scope` diz qual scope falta. Autorizar de novo pedindo esse scope. Não há elevação implícita.

## Tool desconhecida ou input inválido

Nome fora das 25 tools não executa handler de domínio. Input que não passa no schema Zod vira erro de tool (`Input inválido`), não uma chamada ao service. Campo `gestorId`, `tenantId` ou `consultorId` em qualquer profundidade responde `Identificadores de isolamento não são aceitos`.

## Finalização recusada

`Confirmação inválida ou expirada`: token de outro usuário, de outra ação, de outro id, expirado (10 minutos) ou já consumido. A preparação e a finalização precisam cair no mesmo processo da API, porque o token está em memória. Mais de uma réplica faz a segunda chamada falhar mesmo com o token certo. Ver o runbook.

O resumo `prontaParaFinalizar: false` não impede a chamada de finalizar; a regra de negócio do service ainda pode recusar. O token já foi consumido nessa tentativa.

## Cliente não lista as 25 tools

`tools/list` é filtrado pelos scopes do token e pelo perfil relido agora. Uma concessão só com `chekai:contexto` lista `chekai_me`. Conta de auditor não ganha tools administrativas: elas não existem no registry.

## MCP Inspector

O comando e o motivo de não haver sessão Inspector contra a API sem banco estão em [validacao-local.md](./validacao-local.md).

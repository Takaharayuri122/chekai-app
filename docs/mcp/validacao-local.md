# Validação local

Nesta sessão não houve deploy, push, SQL em banco compartilhado, alteração de variável na Railway nem login de Cursor ou Claude num host publicado.

## MCP Inspector CLI

Pacote oficial: `@modelcontextprotocol/inspector` versão **2.11.0**, obtido com `npx --yes @modelcontextprotocol/inspector` (não está nas dependências do repositório).

Ajuda do modo CLI (flags antes das opções do app):

```bash
npx @modelcontextprotocol/inspector --cli --help
```

Comando não interativo para listar tools quando a API deste branch estiver no ar. `--stored-auth-only` não abre navegador: se o servidor exigir OAuth e não houver token guardado pelo Inspector, o CLI termina com `auth_required`.

```bash
npx @modelcontextprotocol/inspector --cli \
  --transport http \
  --server-url http://127.0.0.1:3001/mcp \
  --method tools/list \
  --stored-auth-only \
  --format json \
  --connect-timeout 8000
```

`--transport http` é redundante para URL terminada em `/mcp` (o CLI detecta esse sufixo), e fica explícito aqui. Para o handshake completo com OTP, o modo web (`npx @modelcontextprotocol/inspector --web`) pede o mesmo URL e segue o OAuth no navegador. Isso exige a API e o web no ar, conta ativa e entrega de e-mail. Não foi executado.

### O que foi executado

O comando acima rodou em 17 de outubro de 2026 contra `http://127.0.0.1:3001/mcp`. Saiu com código 1:

```json
{"error":{"code":"error","message":"Error POSTing to endpoint: {\"statusCode\":404,\"timestamp\":\"2026-10-17T15:50:36.166Z\",\"path\":\"/mcp\",\"method\":\"POST\",\"message\":\"Cannot POST /mcp\"}","status":404}}
```

O processo que escutava a porta 3001 era `node .../meta-app/apps/api/dist/main`, com diretório de trabalho `meta-app/apps/api`. É o build do workspace principal, não este worktree. `GET /.well-known/oauth-protected-resource` e `POST /mcp` nesse processo responderam 404. Esse processo não foi reiniciado nem reconfigurado.

A API deste branch não foi iniciada. `apps/api/src/app.module.ts` lança `DATABASE_URL é obrigatória` antes de servir o MCP, e subir o Nest usaria o Postgres configurado no ambiente. Não há modo da API sem banco. Por isso o Inspector não chegou a `initialize` nem a `tools/list` do servidor ChekAI.

## Evidência de protocolo neste worktree

O teste `protocolo Streamable HTTP` em `apps/api/src/modules/mcp/mcp-seguranca.spec.ts` não abre banco. Nos três primeiros casos ele sobe um HTTP em `127.0.0.1` e chama `McpServerService.atender`. Esse serviço usa `McpServer` (`@modelcontextprotocol/server` 2.3.1) com `NodeStreamableHTTPServerTransport` (`@modelcontextprotocol/node` 2.1.1), o mesmo par do servidor Nest. O quarto caso chama `McpRecursoController.atender` direto, sem socket.

Comando, a partir de `apps/api`:

```bash
npx jest modules/mcp/mcp-seguranca.spec.ts -t "protocolo Streamable HTTP" --no-coverage --forceExit
```

Resultado nesta sessão: suíte passou, 4 testes executados e 23 ignorados pelo filtro.

- `initialize`, `tools/list` e `tools/call` de `chekai_me` em HTTP 200, servidor `ChekAI`, catálogo igual a `MCP_TOOLS_PRIMEIRA_ONDA`, sem as tools administrativas e sem segredo no corpo.
- `tools/call` sem o scope responde 403 `insufficient_scope` com `resource_metadata` e não chama o service.
- Tool administrativa e input com `tenantId` aninhado não chamam o service.
- `McpRecursoController` sem bearer responde 401 com `resource_metadata` e não abre o servidor MCP.

O cliente do teste envia `Accept: application/json, text/event-stream` e `mcp-protocol-version: 2025-11-25`.

## Conferência da documentação

Um script local comparou os nomes em `MCP_TOOLS_PRIMEIRA_ONDA` e os scopes em `SCOPES_OPERACIONAIS` com `docs/mcp/catalogo.md`, `docs/mcp/oauth.md`, `apps/api/env.example` e `docs/DEPLOY.md`. Resultado: 25 tools, na mesma ordem do registro, 13 scopes, e as cinco variáveis `MCP_PUBLIC_URL`, `OAUTH_ISSUER`, `OAUTH_ACCESS_TOKEN_TTL`, `OAUTH_REFRESH_TOKEN_TTL` e `OAUTH_JWT_SECRET` presentes no exemplo e no guia de deploy. Nenhum arquivo TypeScript foi alterado, então o build da API não foi reexecutado.

## O que fica para credencial externa

- Subir esta API contra um Postgres (local ou de homologação) e repetir o comando do Inspector acima até `tools/list` autenticado.
- Aplicar `scripts/criar-tabelas-oauth-mcp.sql` e definir as variáveis no serviço, na ordem de [runbook.md](./runbook.md).
- Conectar Cursor e Claude na URL de homologação, concluir OTP real e só então repetir em `https://api.chekai.com.br`.

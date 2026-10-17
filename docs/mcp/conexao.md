# Conexão no Cursor e no Claude

O cliente aponta só para a URL do recurso. Ele não recebe client secret. O primeiro `POST /mcp` sem access token válido responde `401` com `WWW-Authenticate` e `resource_metadata`. A partir daí o cliente lê `/.well-known/oauth-protected-resource` e `/.well-known/oauth-authorization-server`, abre a tela `{FRONTEND_URL}/oauth/autorizar` e conclui Authorization Code + PKCE S256.

A conta precisa estar ativa. Convite pendente ou usuário inativo não recebe OTP utilizável. Em desenvolvimento, com `NODE_ENV` diferente de `production`, o código `252622` é aceito no lugar do OTP enviado por e-mail. Em produção esse atalho não existe.

Use a URL do ambiente que você está homologando. Não aponte um cliente de teste para `https://api.chekai.com.br/mcp` antes do runbook de produção.

## Cursor

No projeto, ou em `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "chekai": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

Em um ambiente publicado, troque a URL por `https://<host-da-api>/mcp`. O Cursor inicia o OAuth quando o servidor responde 401 com `resource_metadata`. Não coloque o JWT do login web nesse arquivo.

Confira, depois do consentimento:

1. O servidor aparece como `ChekAI`.
2. `tools/list` mostra só as tools dos scopes concedidos (no máximo as 25 da primeira onda).
3. Uma chamada a `chekai_me` devolve `id`, `nome`, `email` e `perfil` da conta que autorizou.

O arquivo `.cursor/mcp.json` deste repositório continua só com o servidor ClickUp. Esta documentação não altera essa configuração.

## Claude Desktop

Em macOS, o arquivo é `~/Library/Application Support/Claude/claude_desktop_config.json`. Acrescente o servidor HTTP sem misturar com o bloco de servidores locais `command`/`args`:

```json
{
  "mcpServers": {
    "chekai": {
      "type": "http",
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

Reinicie o Claude Desktop. O fluxo esperado é o mesmo 401 → metadata → navegador em `/oauth/autorizar` → e-mail e OTP → consentimento dos scopes → retorno ao cliente.

## Claude.ai

Em conectores personalizados, informe a URL HTTPS do recurso (`https://<host-da-api>/mcp`). O conector precisa alcançar a API e a tela web na internet; `localhost` não serve para o Claude.ai. O domínio de redirect do conector tem de estar na lista exata de `redirect_uris` do cliente OAuth (documento CIMD em HTTPS, ou o fallback `POST /oauth/register`).

## Claude Code

No `.mcp.json` do projeto, ou na configuração de usuário do Claude Code:

```json
{
  "mcpServers": {
    "chekai": {
      "type": "http",
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

O cliente envia `Accept: application/json, text/event-stream` e o header `mcp-protocol-version`. O servidor é stateless: cada requisição abre um `McpServer` novo e não há `mcp-session-id` para reaproveitar (`sessionIdGenerator` indefinido).

## O que o usuário vê na autorização

1. O cliente redireciona o navegador para `GET /oauth/authorize` na API.
2. A API valida `response_type=code`, `state`, PKCE `S256`, `resource` igual ao endpoint MCP, scopes operacionais e `redirect_uri` exata do cliente.
3. A API responde 302 para `{FRONTEND_URL}/oauth/autorizar` com a mesma query.
4. A tela pede e-mail, OTP e o consentimento. Só scopes operacionais aparecem.
5. `POST /oauth/authorize` devolve `redirectPara` com `code` e `state`.
6. O cliente troca o code em `POST /oauth/token` com `code_verifier` e `resource`.

O code, a sessão de consentimento e o OTP valem 10 minutos. O code é de uso único.

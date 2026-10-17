# Canal MCP do ChekAI

O MCP do ChekAI é um servidor remoto no mesmo processo da API NestJS. O transporte é Streamable HTTP em `/mcp`, fora do prefixo `/api`. A autenticação é OAuth 2.1 (Authorization Code + PKCE S256 + OTP de e-mail). O JWT de sessão do web e do mobile não entra nesse canal, e o access token OAuth não autentica web nem mobile.

Esta pasta descreve conexão, OAuth, o catálogo da primeira onda (25 tools), exemplos, troubleshooting, segurança e o runbook de homologação e produção. As regras de negócio estão em `docs/regras-de-negocio.md` (`RN-AUTH-010`, `RN-MCP-001` a `RN-MCP-011`).

## Estado desta entrega documental

A documentação e os exemplos de configuração local foram escritos a partir do código deste branch. Nenhum deploy, push, alteração de variável na Railway, execução de SQL em banco compartilhado ou conexão real de Cursor/Claude em ambiente publicado foi feito aqui.

O que ainda depende de credenciais e de um ambiente externo está marcado em [runbook.md](./runbook.md) e em [validacao-local.md](./validacao-local.md). A checagem local desta sessão está nesse último arquivo: o Inspector CLI oficial não alcançou o servidor deste worktree, e a evidência de protocolo é o teste Streamable HTTP já existente.

## Índice

| Documento | Conteúdo |
|-----------|----------|
| [conexao.md](./conexao.md) | Cursor, Claude Desktop, Claude.ai e Claude Code |
| [oauth.md](./oauth.md) | Discovery, fluxo, scopes, TTLs e revogação |
| [catalogo.md](./catalogo.md) | As 25 tools, inputs e o que fica de fora |
| [exemplos.md](./exemplos.md) | Chamadas JSON-RPC e confirmação em duas etapas |
| [troubleshooting.md](./troubleshooting.md) | Falhas de subida, OAuth, escopo e protocolo |
| [seguranca.md](./seguranca.md) | Isolamento, segredos, OTP de desenvolvimento e limites |
| [runbook.md](./runbook.md) | Ordem de homologação e produção, SQL e rollback |
| [validacao-local.md](./validacao-local.md) | MCP Inspector e a evidência Streamable HTTP |

## Endereços

Sem barra no final em `MCP_PUBLIC_URL` e `OAUTH_ISSUER`. O código remove a barra final antes de montar os paths.

| Uso | Desenvolvimento | Produção prevista |
|-----|-----------------|-------------------|
| Recurso MCP | `http://localhost:3001/mcp` | `https://api.chekai.com.br/mcp` |
| Metadata do recurso | `http://localhost:3001/.well-known/oauth-protected-resource` | `https://api.chekai.com.br/.well-known/oauth-protected-resource` |
| Metadata do authorization server | `http://localhost:3001/.well-known/oauth-authorization-server` | `https://api.chekai.com.br/.well-known/oauth-authorization-server` |
| Tela de consentimento | `http://localhost:3031/oauth/autorizar` | `{FRONTEND_URL}/oauth/autorizar` |

O parâmetro `resource` e a audience do access token são exatamente `{MCP_PUBLIC_URL}/mcp`.

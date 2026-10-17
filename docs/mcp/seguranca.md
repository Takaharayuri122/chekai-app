# Segurança

O canal é deny-by-default. O registry só publica nomes de `MCP_TOOLS_PRIMEIRA_ONDA`. Tool fora dessa lista não entra em `tools/list` e `tools/call` não chama handler. Não há proxy do Swagger nem da API REST.

## Autenticação separada

| | Web e mobile | MCP |
|--|----------------|-----|
| Credencial | JWT com `JWT_SECRET` | Access token com `OAUTH_JWT_SECRET` |
| Duração típica | `JWT_EXPIRES_IN` (exemplo de deploy `7d`; env de dev `30d`) | `OAUTH_ACCESS_TOKEN_TTL` (padrão de dev 1 hora) |
| Renovação | sessão do produto | refresh opaco, rotativo, revogável |
| Audience | a sessão do produto | exatamente `{MCP_PUBLIC_URL}/mcp` |

Chaves iguais são erro de configuração e a API não inicia. O verifier do MCP exige `iss`, `aud`, HS256 e a chave OAuth. Algoritmo diferente ou segredo do web falha fechado (401).

Access, refresh e authorization code persistem só como SHA-256. A comparação do hash do access usa tempo constante. O valor cru do refresh e do code não é coluna do banco.

## Autorização

Cada request relê o usuário. Conta que deixou de estar `ativo` perde o acesso mesmo com JWT ainda dentro do `exp`. `gestorId` e `tenantId` vêm dessa leitura, não do modelo.

Scope e perfil se cruzam na listagem e de novo na execução. Scope faltante é 403 `insufficient_scope` antes do `McpServer`. Perfil fora da tool, ou tool inexistente, não chama o service.

O modelo não escolhe o tenant. `gestorId`, `tenantId` e `consultorId` no input, inclusive aninhados, são rejeitados antes do service. A resposta é resumo: sem entidade TypeORM, sem segredo, sem token de sessão e sem URL que contorne o isolamento. `chekai_me` devolve só id, nome, e-mail e perfil.

AUDITOR continua limitado pelos services (vínculos e recursos próprios). Checklist inativo não é entregue a auditor. Não há tool de administração de equipe, plano, crédito, legislação ou IA.

## Confirmação e réplicas

Finalizar auditoria ou relatório exige token opaco de 32 bytes em base64url, uso único, validade de 10 minutos, amarrado a usuário, ação e recurso. O mapa é do processo Node. Duas réplicas não compartilham esse mapa: a preparação numa instância e a finalização em outra falham, e o token da instância errada nunca existiu. Enquanto isso for memória local, opere uma instância ou aceite que a confirmação só funciona com afinidade de processo. Isso não foi alterado nesta documentação.

## CIMD e registro

O fetch do documento do cliente só aceita `https`, sem usuário ou senha na URL, sem redirect, timeout de 5 segundos e corpo de até 64 KiB. `redirect_uri` de registro precisa ser `http` ou `https` e não pode ter fragmento. A comparação na autorização é exata.

`POST /oauth/register` é fallback público, sem autenticação de quem registra. O client id gerado não é URL. Trate o endpoint como compatibilidade MCP, não como um cadastro administrativo.

## OTP de desenvolvimento

Com `NODE_ENV` diferente de `production`, `aceitaOtpMock` é verdadeiro e o código `252622` valida qualquer conta ativa, sem consumir o OTP gravado. Produção desliga esse atalho. Não use `NODE_ENV=development` num host publicado.

## O que o MCP não faz

Não cria sessão offline, não grava fila no aparelho e não altera os contratos REST do web e do mobile. Não expõe prompt livre, RAG cru, créditos nem auditoria global de tokens.

## Segredos operacionais

`OAUTH_JWT_SECRET` fica só no ambiente da API. Não entre em `env.example` com valor real, nem no repositório, nem no metadata OAuth. Rotacionar a chave invalida os access tokens já emitidos; os refresh opacos continuam até serem apresentados, e a emissão nova sai com a chave nova. Para cortar o canal na hora, revogue as concessões com o SQL do [runbook.md](./runbook.md) e só então troque a chave.

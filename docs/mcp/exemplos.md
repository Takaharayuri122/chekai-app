# Exemplos

Os corpos abaixo são o `arguments` de `tools/call`, ou o pedido JSON-RPC completo quando o transporte importa. IDs são ilustrativos. O access token sai do fluxo OAuth; não use o JWT do login web.

Cabeçalhos do POST em `/mcp`:

```http
POST /mcp HTTP/1.1
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json, text/event-stream
mcp-protocol-version: 2025-11-25
```

O resultado bem-sucedido do SDK vem em SSE (`data: {jsonrpc...}`). O texto da tool é JSON dentro de `result.content[0].text`.

## Identidade

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": { "name": "chekai_me", "arguments": {} }
}
```

Resposta de negócio, já parseada do texto:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "nome": "Ana Gestor",
  "email": "ana@exemplo.com",
  "perfil": "gestor"
}
```

## Leitura paginada

```json
{ "page": 1, "limit": 20 }
```

Tool: `chekai_listar_clientes`. Unidade de um cliente:

```json
{
  "clienteId": "00000000-0000-4000-8000-000000000010",
  "page": 1,
  "limit": 20
}
```

Tool: `chekai_listar_unidades`.

## Auditoria

Iniciar:

```json
{
  "unidadeId": "00000000-0000-4000-8000-000000000020",
  "templateId": "00000000-0000-4000-8000-000000000030"
}
```

Responder um item:

```json
{
  "auditoriaId": "00000000-0000-4000-8000-000000000040",
  "itemId": "00000000-0000-4000-8000-000000000041",
  "resposta": "conforme",
  "observacao": "Documento no local."
}
```

Preparar e finalizar. O segundo passo usa o `token` devolvido no primeiro, não um segredo inventado:

```json
{ "auditoriaId": "00000000-0000-4000-8000-000000000040" }
```

Tool: `chekai_preparar_finalizacao`. Exemplo de retorno:

```json
{
  "token": "<opaco, uso único, 10 minutos>",
  "expiraEm": "2026-10-17T15:10:00.000Z",
  "resumo": {
    "auditoriaId": "00000000-0000-4000-8000-000000000040",
    "status": "em_andamento",
    "obrigatoriosPendentes": 0,
    "itensPendentes": [],
    "prontaParaFinalizar": true
  }
}
```

```json
{
  "auditoriaId": "00000000-0000-4000-8000-000000000040",
  "confirmationToken": "<token devolvido acima>",
  "observacoesGerais": "Visita encerrada."
}
```

Tool: `chekai_finalizar_auditoria`.

## Agenda e tarefas

Agenda do período, só o que a conta pode ver:

```json
{
  "status": "agendada",
  "de": "2026-10-01",
  "ate": "2026-10-31",
  "page": 1,
  "limit": 20
}
```

Concluir: `{ "agendamentoId": "00000000-0000-4000-8000-000000000050" }` na tool `chekai_concluir_agendamento`.

Criar tarefa:

```json
{
  "titulo": "Trocar termômetro da câmara",
  "descricao": "Registrar a troca e o certificado.",
  "prazo": "2026-10-24",
  "auditoriaId": "00000000-0000-4000-8000-000000000040"
}
```

Concluir ou reabrir: `{ "tarefaId": "00000000-0000-4000-8000-000000000060" }`.

## Relatório técnico

Abrir: `{ "clienteId": "...", "unidadeId": "..." }` em `chekai_iniciar_relatorio`.

Atualizar campos ainda em rascunho:

```json
{
  "relatorioId": "00000000-0000-4000-8000-000000000070",
  "identificacao": "Visita de rotina",
  "descricaoOcorrenciaHtml": "<p>Temperatura acima do limite na câmara 2.</p>",
  "avaliacaoTecnicaHtml": "<p>Desvio pontual, sem produto exposto.</p>",
  "acoesExecutadas": ["Ajuste do setpoint", "Nova leitura após 30 minutos"],
  "recomendacoesConsultoraHtml": "<p>Recalibrar o sensor neste mês.</p>",
  "planoAcaoSugeridoHtml": "<p>Incluir a troca do sensor no plano.</p>"
}
```

`chekai_preparar_finalizacao_relatorio` resume `camposHtmlVazios`, `possuiAcaoExecutada` e `prontaParaFinalizar`. A finalização repete o `relatorioId` e o `confirmationToken`.

## Pedido recusado de propósito

Identificador de isolamento em qualquer nível do JSON não chega ao service. A resposta HTTP continua 200, com erro de protocolo da tool:

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "chekai_listar_clientes",
    "arguments": { "lote": [{ "meta": { "tenantId": "outro-gestor" } }] }
  }
}
```

O texto do resultado é `Identificadores de isolamento não são aceitos` e `isError` é verdadeiro.

# Respostas configuráveis, faixas de classificação e relatório ao cliente — design

Data: 2026-10-26 · Escopo: API (`apps/api`) e web (`apps/web`). O app mobile (`apps/mobile`) fica fora.

## Por que

Clientes e consultores comparam o chekAI com o Moki. O que mais pesa nessa comparação é o resultado da auditoria: como as respostas aparecem, como a nota é classificada e como o relatório chega ao cliente. Hoje:

- As opções de resposta personalizadas não têm sentido. O sistema não sabe que "Não" ou "Parcial" é ruim, então essas respostas **não contam como não conformidade** em lugar nenhum (só conta o valor literal `nao_conforme`). Isso faz o relatório mostrar menos não conformidades do que existem.
- O ícone da resposta no relatório é fixo: ✓ para conforme, ✗ para não conforme e ⚠ para qualquer outra resposta, inclusive as personalizadas.
- As faixas de classificação ("Com Excelência", "Bom"…) estão fixas no código e copiadas em 3 lugares (PDF e duas telas web).
- O relatório não traz linhas de assinatura e não é enviado ao cliente; o gestor baixa o PDF e manda por fora.

## Objetivos

1. **Sentido e ícone por opção de resposta.** Cada opção de resposta de uma pergunta passa a ter um *sentido* (positiva, negativa, neutra) e um *ícone* opcional (emoji ou símbolo). O sentido decide o que é não conformidade; o ícone aparece na execução e no relatório.
2. **Faixas de classificação configuráveis por checklist.** Nome, cor, emoji, de e até, com as faixas atuais como padrão.
3. **Cartão de resultado** (na tela de relatório web e no PDF): percentual com emoji da faixa, seta de tendência, nome da faixa, barra colorida das faixas com marcação da nota, as 3 avaliações anteriores da mesma unidade com o mesmo checklist, e contadores (pontos possíveis, pontos realizados, não conformidades, fotos, planos de ação).
4. **PDF mais completo.** Dados da avaliação no topo, colunas de não aplicáveis e não respondidas na tabela por grupo, ícone da resposta configurado em cada pergunta, e página final com resumo e linhas de assinatura em branco.
5. **Envio do relatório ao cliente.** Envio automático ao finalizar (opção por checklist) e botão de envio/reenvio manual, com registro de cada envio.

## Fora do escopo (agora)

- Configurações de plano de ação (herdar, encerramento automático, envio de PA), modelo de relatório com módulos ligáveis, workflow de avaliação, ponderação/frequência — ficam para projetos seguintes.
- Assinatura desenhada na tela. O usuário decidiu: **apenas linhas em branco** para assinar no papel.
- Contador de anexos (o chekAI não tem anexos além de fotos).
- App mobile: não mexer. Ele deve continuar funcionando com os dados novos (os campos novos são opcionais e os valores de resposta não mudam).

## Antiobjetivos (seria falha mesmo funcionando)

- Mudar a nota ou a contagem de auditorias **já finalizadas** sem ninguém pedir. A nota gravada (`pontuacaoTotal`) não é recalculada.
- Um checklist existente passar a se comportar diferente só porque a funcionalidade entrou (os padrões têm que reproduzir o comportamento atual, salvo a correção das não conformidades personalizadas, abaixo).
- Finalização de auditoria falhar ou travar porque o e-mail falhou.
- Mandar e-mail ao cliente sem o gestor ter ligado a opção.
- Jargão na interface ("enum", "jsonb", "SMTP"…).

## Como funciona

### 1. Sentido e ícone da resposta

`TemplateItem.opcoesRespostaConfig` (jsonb) ganha dois campos opcionais por opção:

- `sentido: 'positiva' | 'negativa' | 'neutra'`
- `icone: string | null` — código de emoji no formato já usado pelo `apps/web/src/lib/emoji.ts` (`renderEmoji`), ou o próprio caractere Unicode.

Regras:

- **Não conformidade** = resposta cuja opção tem sentido `negativa`. As respostas padrão continuam: `conforme` é positiva, `nao_conforme` negativa, `nao_aplicavel` neutra, `nao_avaliado` = não respondida (fora das contagens de sentido; conta na coluna "não respondidas").
- **Sentido padrão quando não configurado** (opções personalizadas antigas) — **decisão do usuário: deduzir automaticamente.** Calcula-se a pontuação de cada opção como hoje (`calcularPontuacaoOpcao`: valor configurado, ou a regra sequencial quando não há). Entre as opções que pontuam (as que `isOpcaoSemPontuacao` ignora ficam neutras): a(s) de **maior** pontuação é positiva, a(s) de **menor** é negativa, as do meio são neutras. Se todas tiverem a mesma pontuação, ou houver só uma, todas ficam neutras. Ex.: "Sim / Não" → Sim positiva, Não negativa; "Sim / Parcial / Não" → Parcial neutra. Quando a opção tem `sentido` gravado, ele prevalece. O editor mostra o sentido deduzido já preenchido para o gestor ajustar.
- **Decisão minha:** a migração de banco **não** grava sentido nos registros antigos; o padrão é calculado na leitura. Assim nada muda nos dados e o mobile não é afetado.
- **Decisão minha:** a cor do botão e do ícone vem do sentido, com os tokens do design system: positiva `success` (verde), negativa `destructive` (vermelho), neutra `warning` (âmbar) — âmbar porque é o que a tela de execução já pinta hoje para pontuação 0/nula (`classeSelecionada` em `respostas-item.tsx`), então o visual atual não muda. As respostas padrão mantêm as cores atuais (N/A continua cinza `muted`). Não há cor livre por resposta — mantém o relatório coerente.
- **Ícone:** escolhido de uma lista curta e curada (✓ ✗ 👍 👎 🙂 😐 🙁 ⚠️ ⭐ 🟢 🟡 🔴 —, ajuste final do builder), mais "sem ícone". Sem ícone, usa o padrão do sentido (✓ positiva, ✗ negativa, — neutra). Lista curada porque o PDF precisa renderizar o emoji com a fonte do Chromium da API.
- A pontuação continua independente do sentido (já existe e não muda).
- Onde configurar: no editor de respostas da pergunta (`app/admin/templates/[id]/page.tsx`), no editor em lote (`components/checklist/editor-respostas-lote.tsx`) e na revisão da importação pela IA (`components/checklist/importacao/pergunta-revisada.tsx`). Na importação pela IA, a IA sugere o sentido de cada opção (o prompt já devolve as opções; acrescentar o sentido), respeitando a auditoria de tokens que já existe.
- Execução web (`components/auditoria/execucao/respostas-item.tsx`, `lista-secoes.tsx`, `revisao-final.tsx` e o modal da página `app/admin/auditoria/[id]/page.tsx`): botões mostram ícone + texto, cor pelo sentido.

**Efeito nas auditorias:** a contagem de não conformidades passa a ser feita pelo sentido em todos os lugares que hoje comparam com `nao_conforme`. Lista conhecida (o builder deve fazer um `grep` por `nao_conforme`/`NAO_CONFORME` para não deixar nenhum): API — `auditoria.service.ts` (~559 `buscarItensNaoConformes`, ~652, ~674), `relatorio-html.service.ts` (~980, ~1236), `ia.service.ts:468` (resumo executivo), `plano-acao.service.ts:90` (`gerarDaAuditoria`); web — `app/admin/auditoria/[id]/relatorio/page.tsx` (~132), `app/auditoria/[id]/relatorio/page.tsx`, `components/auditoria/execucao/lista-secoes.tsx`, `lib/auditoria/execucao.ts`, `status-chip.tsx`. Onde o filtro hoje é feito na consulta ao banco (`resposta = 'nao_conforme'`), passa a carregar os itens com a pergunta e filtrar em código pela função única. **Decisão minha:** a geração de plano de ação a partir da auditoria usa a regra nova (gera tarefas também para respostas personalizadas negativas); tarefas já criadas não são tocadas. Isso vale também para auditorias já finalizadas ao reabrir o relatório — é a correção que o usuário quer (uma resposta "Não" passa a aparecer como não conformidade). A **nota** gravada não muda.

Centralizar a regra numa função pura compartilhada na API (ex.: `sentidoDaResposta(item, resposta)` em `checklist-regras.ts`) e um equivalente no web (`lib/auditoria/`), com testes. Hoje a lógica de pontuação está duplicada entre `auditoria.service.ts` e `relatorio-html.service.ts`; a nova regra não deve ser duplicada de novo.

### 2. Faixas de classificação

`ChecklistTemplate` ganha `faixasClassificacao` (jsonb, nulo = usar padrão):

```
[{ nome: string (até 20 caracteres), cor: string (#RRGGBB), emoji: string | null, de: number, ate: number }]
```

- **Padrão** (quando nulo) reproduz as faixas atuais: Crítico 0–59,99 · Atenção Necessária 60–69,99 · Regular 70–79,99 · Bom 80–89,99 · Com Excelência 90–100. Cores e emojis padrão: escolha do builder dentro dos tokens/paleta da marca.
- Validação (API e formulário): de < até, entre 0 e 100, duas casas decimais, sem sobreposição; faixas ordenadas. Lacunas entre faixas são permitidas, mas o formulário avisa; nota caída numa lacuna aparece como "Sem classificação".
- Configuração numa seção "Classificação" da tela de edição do checklist (`app/admin/templates/[id]/page.tsx`), com lista de faixas, "Nova faixa", seletor de cor (paleta curta + campo hexadecimal) e o mesmo seletor de ícone curado. Excluir faixa usa `ConfirmDialog`. Tooltips nas ações.
- Nota abaixo de 0 (possível com pontuações negativas): fora das faixas, mostra o rótulo fixo "Abaixo do mínimo" como hoje; a validação das faixas fica em 0–100. **Decisão minha.**
- **Nota usada:** auditoria finalizada usa sempre a nota gravada (`pontuacaoTotal`) — no PDF, no cartão web e na seta de tendência. Hoje o relatório web recalcula a partir dos itens (`app/admin/auditoria/[id]/relatorio/page.tsx` ~144); passa a usar a gravada. Só auditoria não finalizada recalcula. **Decisão minha.**
- A faixa é calculada na leitura a partir da nota e das faixas **atuais** do checklist (decisão minha: não congelar a faixa na finalização; se o gestor ajustar as faixas, os relatórios antigos acompanham — é o que se espera de "configuração").
- Substitui as três cópias de `getClassificacao` (API `relatorio-html.service.ts:1311`, web `app/admin/auditoria/[id]/relatorio/page.tsx` e `app/auditoria/[id]/relatorio/page.tsx`) por uma função única de cada lado.

### 3. Cartão de resultado

Mesmo conteúdo no topo do relatório web (`app/admin/auditoria/[id]/relatorio/page.tsx` e `app/auditoria/[id]/relatorio/page.tsx`) e no PDF:

- Lado esquerdo: emoji da faixa + percentual + seta (▲ subiu / ▼ caiu / nada se igual ou sem anterior, comparando com a avaliação finalizada imediatamente anterior da mesma unidade e mesmo checklist); nome da faixa na cor da faixa; barra horizontal com um segmento por faixa (largura proporcional ao intervalo) e marcação na posição da nota; abaixo, até 3 avaliações anteriores (data de fim + percentual).
- Lado direito: pontos possíveis, pontos realizados, não conformidades, fotos, planos de ação (tarefas de plano de ação ligadas à auditoria).
- No mobile web: os dois lados empilham.
- Histórico: o endpoint `GET /auditorias/historico-unidade/:unidadeId` já existe mas não filtra por checklist. Adicionar filtro opcional `templateId`, mantendo as regras de isolamento atuais (consultor/gestor). Para o PDF, a mesma consulta no service.

### 4. PDF

Em `relatorio-html.service.ts`:

- **Topo**: nome do checklist, cliente/unidade, auditor, código da auditoria (decisão minha: 8 primeiros caracteres do id em maiúsculas, já que não há número sequencial), início, fim, duração, e "Ver no mapa" (link para o Google Maps com `latitudeInicio/longitudeInicio`, só quando houver coordenadas).
- **Cartão de resultado** como descrito acima.
- **Tabela por grupo**: colunas aproveitamento, pontos possíveis, pontos realizados, não aplicáveis, não conformidades e não respondidas, com linha "Geral" e legenda das siglas.
- **Perguntas**: ícone e cor pela opção respondida (sentido + ícone configurado); "?" para não respondida. O resto do conteúdo de cada pergunta não muda.
- **Página final**: quadro de resumo (checklist, unidade, início, fim, duração, auditor, aproveitamento, faixa, pontos e não conformidades), linha "____________, ___ de ________ de ____", e duas linhas de assinatura em branco: nome do auditor embaixo da primeira; nome do responsável da unidade (`Unidade.responsavel`) embaixo da segunda.
- Seções já existentes (histórico de evolução, gráficos, resumo executivo da IA) continuam; o builder decide a ordem para não repetir o histórico do cartão com o gráfico de evolução.
- O PDF já é regenerado quando a auditoria muda (`atualizadoEm > pdfGeradoEm`). Como sentido/faixas/ícones mudam no checklist e não na auditoria, PDFs em cache podem ficar desatualizados: o builder deve incluir na condição de regeneração a data de atualização do checklist (ou invalidar de outra forma simples).

### 5. Envio do relatório ao cliente

- `ChecklistTemplate` ganha `enviarRelatorioAoFinalizar: boolean` (padrão `false`), configurado na tela de edição do checklist: "Enviar o relatório ao cliente quando a auditoria for finalizada".
- Destinatário: `Unidade.email`; se vazio, `Cliente.email`. Sem nenhum dos dois, não envia e registra a falha.
- Ao finalizar (`AuditoriaService.finalizarAuditoria`): se a opção estiver ligada, dispara o envio **depois** de salvar a finalização e **sem bloquear** a resposta (assíncrono; erro só é registrado). A geração do PDF hoje está no controller (`GET /auditorias/:id/pdf`); extrair para um service reutilizável pelo envio.
- E-mail: assunto e corpo curtos, sóbrios, em pt-BR: nome da unidade, checklist, data, aproveitamento e faixa, quem auditou; PDF **anexado**. Template HTML novo em `modules/email/templates/` (lembrar do `nest-cli.json` assets). O `EmailService` não aceita anexos hoje — estender `enviarEmail` com anexos opcionais para todos os provedores configurados (SMTP/nodemailer, SendGrid, MailerSend, Resend, Ethereal). **Decisão minha:** anexa o PDF quando o provedor aceita e o arquivo tem até 8 MB; acima disso (relatórios com muitas fotos) ou em provedor sem anexo, manda um link assinado do bucket do Supabase válido por 30 dias. O provedor de produção é escolhido por `EMAIL_PROVIDER` no Railway; o builder confere os limites de anexo de cada provedor suportado.
- Botão "Enviar ao cliente" na tela da auditoria finalizada / relatório web: abre um modal com o e-mail sugerido (editável, aceita mais de um separado por vírgula) e confirma. Serve para envio manual e reenvio, mesmo com a opção automática desligada.
- **Registro**: tabela nova `auditoria_envios_relatorio` (auditoria, destinatários, enviado em, enviado por — nulo quando automático —, sucesso, mensagem de erro). A tela da auditoria mostra "Relatório enviado para X em DD/MM às HH:MM" ou a falha, com o botão para tentar de novo.
- Quem pode enviar manualmente: quem pode ver a auditoria pela regra de isolamento atual. Autorização na API.

### Banco de dados

Uma migration em `supabase/migrations/<AAAAMMDDHHMMSS>_respostas_classificacao_relatorio.sql` (regra do projeto), idempotente, terminando com `NOTIFY pgrst, 'reload schema'`:

- `checklist_templates.faixas_classificacao jsonb null` (conferir nome real da coluna/tabela na entidade).
- `checklist_templates.enviar_relatorio_ao_finalizar boolean not null default false`.
- tabela `auditoria_envios_relatorio`.
- Sentido e ícone ficam dentro do jsonb `opcoesRespostaConfig` já existente — sem coluna nova.

### Documentação

- Regras novas em `docs/regras-de-negocio.md` (próximos IDs livres): sentido da resposta e não conformidade; faixas de classificação; envio do relatório.
- Atualizar `docs/paridade-plataformas.md` marcando que o mobile ainda não mostra ícone/sentido nem faixas.

## Decisões do usuário

- Trazer do Moki: respostas mais editáveis com emojis/símbolos e sentido positivo/negativo, relatório final refletindo essa configuração, e o "jeito como a auditoria se apresenta" (cartão de resultado e dados da avaliação).
- Levar assinatura e dados da avaliação para o PDF; **assinatura = linhas em branco**.
- Envio automático do relatório para o e-mail do cliente cadastrado na unidade.
- Seguir o design system do chekAI (shadcn + tokens da marca), não o visual do Moki.
- Não mexer no app mobile.
- Checklists antigos: deduzir o sentido automaticamente pela pontuação (maior = positiva, menor = negativa, meio = neutra); relatórios antigos passam a mostrar essas não conformidades, sem mudar a nota gravada.

## Decisões minhas (para revisar)

- Sentido deduzido calculado na leitura (sem reescrever dados).
- Cor neutra = âmbar (como a tela já pinta hoje); nota abaixo de 0 = "Abaixo do mínimo"; cartão e PDF usam a nota gravada.
- Geração de plano de ação passa a incluir respostas personalizadas negativas.
- PDF anexado até 8 MB; acima disso, link assinado de 30 dias.
- Cor da resposta vem do sentido; sem cor livre por resposta. Faixas, sim, têm cor livre.
- Lista curada de ícones em vez de seletor livre de emoji.
- Não conformidades de auditorias antigas passam a contar respostas personalizadas negativas; a nota gravada não muda.
- Faixa calculada na leitura com as faixas atuais do checklist.
- Envio automático desligado por padrão; e-mail da unidade, depois do cliente; PDF anexado.
- Código da auditoria no PDF = 8 primeiros caracteres do id.

## Deixado para o builder

- Divisão em tarefas/PRs, nomes internos, ordem das seções do PDF, layout exato do cartão dentro do design system, lista final de ícones e cores padrão das faixas, mecanismo assíncrono do envio, invalidação do PDF em cache.

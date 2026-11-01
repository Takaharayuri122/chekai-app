# App iOS offline-first para a consultora de campo

Data: 2026-11-01
Status: aguardando aprovação do usuário

## Intenção

A consultora de campo precisa fazer a auditoria inteira no local, mesmo sem internet. Hoje, sem conexão, as fotos "não carregam". Ela então tira as fotos pela câmera do celular, anota tudo à parte e refaz a auditoria em casa. Isso gera retrabalho e risco de perder um detalhe que deveria ter sido registrado na hora.

O objetivo é que o app no iPhone seja confiável em campo: registrar tudo na hora, sem depender de conexão, e enviar sozinho quando a internet voltar. O app é voltado para a consultora de campo.

## Objetivos

1. Fazer auditorias completas sem internet, depois de uma primeira sincronização com internet: escolher cliente, unidade e checklist, responder, tirar fotos, observar, assinar e finalizar.
2. Enviar auditorias finalizadas offline por uma fila, automaticamente, quando houver internet, **sem usar IA na fila**.
3. Relatório técnico e checklists continuam funcionando offline (já funcionam hoje; manter).
4. Check-in e checkout funcionando sem internet, guardando o horário do celular, marcados como "offline" no sistema, com o horário da sincronização.
5. Publicar o build no TestFlight do usuário.

## Fora do escopo

- **Agenda no app:** decidido pelo usuário que não traz resultado agora.
- **Publicação Android:** o código é React Native compartilhado, então as mudanças valem para os dois sistemas, mas só o iOS será publicado e verificado nesta etapa.
- **IA offline ou IA tardia:** nenhuma análise de foto nem sugestão de texto acontece na fila ou depois da auditoria.

## Anti-objetivos (falha mesmo que "funcione")

- A consultora perder uma foto, uma resposta ou uma marcação de check-in/checkout.
- A fila criar auditorias duplicadas no servidor.
- Algo ser descartado em silêncio. Toda falha de envio precisa ficar visível no app, com opção de tentar de novo.
- A fila chamar a IA (custo de créditos sem valor, pois a análise só tem valor na hora).
- O app travar esperando rede ou GPS antes de mostrar a foto.

## Restrições do projeto (AGENTS.md)

- Comunicação, commits e textos da interface em pt-BR, com linguagem natural do usuário (sem jargão como "sync", "offline-first", "fila" na interface; "aguardando envio", "enviado", "sem internet" são aceitáveis).
- Toda alteração no banco do servidor vai em `supabase/migrations/<AAAAMMDDHHMMSS>_<nome>.sql`, idempotente, terminando com `NOTIFY pgrst, 'reload schema'`. Nunca migrations do TypeORM.
- Isolamento e autorização garantidos na API.
- No mobile: `gerarUUID()` de `src/utils/uuid.ts` (não `crypto.randomUUID`); migrações do SQLite local seguem o padrão `SCHEMA_Vn` em `src/db/schema.ts` + `src/db/migrations.ts` (versão atual: 7).
- Não rodar `expo prebuild`: ajustes de build vão direto no projeto nativo (`apps/mobile/ios/chekAI.xcworkspace`, scheme `chekAI`, `Info.plist`).
- O FAB de check-in continua oculto nas áreas de checklist, auditoria e relatórios.
- Sem `SafeAreaView` com inset superior duplicado em telas filhas.
- Funcionalidades com IA respeitam a auditoria de tokens (`.cursor/rules/auditoria-tokens.mdc`).
- Atualizar `docs/regras-de-negocio.md` (regras novas/alteradas de check-in e sincronização) e `docs/paridade-plataformas.md`.

## Estado atual (levantamento de 2026-11-01)

Já funciona sem internet:
- criação local da auditoria a partir de cliente, unidade e checklist sincronizados (`app/(app)/auditorias/nova-template.tsx`);
- respostas, observações, assinatura e fotos gravadas no SQLite local; fotos comprimidas em `documentDirectory/fotos/`;
- fila `sync_queue` para auditorias e relatórios técnicos (`src/sync/push.ts`), drenada ao recuperar conexão (`SyncService.initAutoSync`) e na tela de listas (puxar para atualizar);
- a fila não chama IA; só envia `analiseIa` de fotos que já foram analisadas na hora;
- relatório técnico offline completo, com fila própria;
- primeira sincronização no login (`pullAll`: clientes, checklists, auditorias, modelo e relatórios técnicos, check-in aberto).

Problemas encontrados:
1. **Foto travando:** `src/utils/foto-picker.ts` aguarda `Location.getCurrentPositionAsync({ accuracy: High })` sem tempo limite **antes** de comprimir e salvar a foto. Sem internet (sem GPS assistido) e em ambiente fechado, isso pode demorar muito ou não terminar.
2. **IA chamada offline:** `FotoGrid` dispara `analisarImagemChecklist` automaticamente para fotos sem análise, sem checar conexão; essa chamada (`FileSystem.uploadAsync`) não tem tempo limite. A sugestão de não conformidade (`getSugestaoIa`, em `item/[itemId].tsx`, `ItemDetailSheet.tsx` e `SwipeCard.tsx`) também é chamada sem checar conexão.
3. **Fila não idempotente:** `pushAuditoria` sempre chama `POST /auditorias`. Se o envio falha no meio, a nova tentativa cria outra auditoria no servidor. A API ignora o `localId`. Além disso, o laço de fotos reenvia fotos já enviadas (não pula as que têm `remoteId`).
4. **Datas erradas:** `createAuditoria` (mobile) não envia `dataInicio`, e a API grava `dataInicio = new Date()`. Uma auditoria feita offline fica com a data do envio. O mesmo vale para a data de finalização.
5. **Fila sem controle:** sem limite de tentativas, sem estado de "falhou", sem indicação para a consultora do que está pendente.
6. **Check-in/checkout só online:** `src/store/checkin.ts` chama a API direto; o servidor grava `dataCheckin`/`dataCheckout = new Date()`. Há um job no servidor (`checkin-auto-checkout.job.ts`) que encerra check-ins abertos há mais de 12h.

## Decisões do usuário

- **IA só com internet e na hora.** Sem conexão, nada de IA. A fila nunca usa IA.
- **Agenda fora** desta etapa.
- **Check-in/checkout offline contam pelo horário do celular**, com marcação "offline" e o horário da sincronização visíveis para o gestor, inclusive no relatório de horas.
- Descrições aprovadas em conversa (auditoria, fila e check-in/checkout), detalhadas abaixo.
- **Envio completo ao TestFlight feito pelo agente**, sem o usuário buildar nada.
- **Trabalho de campo não se perde por bloqueio posterior.** A API aceita auditorias (e check-ins) feitas offline cujo início, pelo horário do celular, é anterior ao bloqueio: limite do plano estourado ou assinatura vencida, cliente ou unidade inativados, consultora desvinculada do cliente. Bloqueios que já existiam antes do início continuam valendo, e a auditoria fica como "falha no envio" com o motivo.
- **Check-in e checkout sem localização são permitidos** quando o GPS não responder, com a marcação "sem localização" visível para o gestor.

## Comportamento esperado

### 1. Auditoria em campo

- **Primeira sincronização:** o app precisa ter concluído ao menos uma sincronização completa com internet para iniciar auditorias offline. Se nunca sincronizou, a tela de nova auditoria explica que é preciso conectar uma vez. *(Decisão do agente.)*
- **Foto aparece na hora, sempre.** A foto é comprimida e salva primeiro. A localização é obtida com tempo limite curto, preferindo a última posição conhecida. Se não vier a tempo, a foto fica sem localização. Perder a localização de uma foto é aceitável; perder a foto não é. *(Decisão do agente; usuário não objetou.)*
- **IA só com internet, na hora.** Antes de chamar análise de foto ou sugestão de não conformidade, o app verifica se há internet de fato (não só rede conectada). Sem internet, não chama e mostra discretamente que a IA não está disponível sem internet; a consultora preenche à mão. Chamadas de IA têm tempo limite, para sinal fraco não deixar o indicador girando.
- **Sem IA depois.** Fotos sem análise não são analisadas na fila. Se a consultora reabrir o item **durante a auditoria** e já com internet, a análise pode rodar normalmente, porque ainda é "na hora" (comportamento atual do `FotoGrid`, mantido). *(Usuário não objetou.)*
- **Datas reais:** início e fim da auditoria registrados no celular são enviados ao servidor e prevalecem sobre o horário do envio. *(Decisão do agente, coerente com a decisão de check-in.)*

### 2. Fila de envio

- Auditoria finalizada sem conexão entra na fila e é enviada sozinha quando a internet voltar (ao recuperar conexão, ao abrir o app e ao puxar para atualizar nas listas).
- **Idempotência ponta a ponta:**
  - A API passa a aceitar o identificador local da auditoria; se já existir auditoria com esse identificador para o mesmo consultor, devolve a existente (com itens) em vez de criar outra. Requer coluna nova em `auditorias` via migration no Supabase, com índice único.
  - Respostas: o envio de item já é atualização (`PUT`), pode repetir.
  - Fotos: o laço pula fotos já enviadas (com `remoteId`/`sync_status = 'synced'`).
  - Finalização: se a auditoria já está finalizada no servidor, a etapa conta como concluída.
- **Estado visível:** cada auditoria mostra "aguardando envio", "enviando", "enviada" ou "falha no envio". Em falha, mensagem curta e botão para tentar de novo. Indicador na lista de auditorias, sem tela nova. *(Decisão do agente; usuário não objetou.)*
- **Tentativas:** após um número fixo de falhas seguidas (sugestão: 5), o item para de ser tentado automaticamente e fica como "falha no envio" até a consultora pedir nova tentativa. Erros de validação da API (4xx, exceto 401/408/429) vão direto para "falha no envio" com a mensagem do servidor.
- **Sessão expirada:** se o token expirar, a fila não perde nada. Os itens ficam pendentes até a consultora entrar de novo. Sair da conta com itens pendentes exige confirmação explícita avisando que há envios pendentes.
- Relatório técnico segue com a fila atual, ganhando o mesmo estado visível e controle de tentativas.
- **Checklist alterado entre a sincronização e o envio:** vale a versão que a consultora respondeu. O app envia os itens do checklist que usou, e a API cria os itens da auditoria a partir dessa lista (desde que pertençam ao template), em vez de usar os itens ativos no momento do envio. Assim nenhuma resposta some e nenhum item novo bloqueia a finalização. *(Decisão do agente, decorrente do anti-objetivo de não perder respostas.)*
- **Não finalizar no servidor com foto pendente:** se alguma foto falhar no envio, a auditoria não é finalizada no servidor; fica em "falha no envio" e a próxima tentativa continua das fotos que faltam. *(Decisão do agente.)*
- **Troca de usuária no mesmo aparelho:** cada item da fila guarda a usuária que o criou. Itens de outra usuária nunca são enviados com o token de quem está logada; ficam guardados até a dona entrar de novo. Sair da conta com pendentes pede confirmação e não apaga nada. *(Decisão do agente.)*

### 3. Check-in e checkout

- Funcionam sem conexão: o app grava a marcação no celular, com horário do celular e localização se disponível (mesma regra de tempo limite do GPS), e põe na fila.
- **No app:** a marcação mostra o horário em que foi feita e "aguardando envio"; depois do envio, mostra também o horário em que foi enviada.
- **No servidor:** cada evento (check-in e checkout) guarda separadamente se foi feito offline e quando foi sincronizado. Requer colunas novas em `checkins` via migration no Supabase. *(Nomes ficam com o construtor; ex.: `checkin_offline`, `checkin_sincronizado_em`, `checkout_offline`, `checkout_sincronizado_em`.)*
- A API aceita, nas rotas de iniciar e finalizar, o horário do celular e a indicação de offline, mais um identificador local para idempotência (repetir o mesmo check-in não cria outro).
- Validação do horário do celular na API: não pode estar no futuro além de uma pequena tolerância (sugestão: 5 min); o checkout não pode ser anterior ao check-in.
- **Sem localização:** se o GPS não responder dentro do tempo limite, o check-in/checkout é feito assim mesmo. Requer migration tornando `latitude_checkin`/`longitude_checkin` anuláveis, ajuste dos DTOs (`@IsOptional`), da RN-CKI-007 e do app (hoje bloqueia sem coordenadas). Web e PDF mostram "sem localização". No encerramento automático (RN-CKI-009), que copia a localização do check-in, a ausência é mantida como nula.
- **Exceção ao bloqueio:** a regra de aceitar trabalho iniciado antes do bloqueio (ver Decisões) vale também para check-ins offline em unidade ou cliente inativados depois da marcação. Para comparar, a API precisa saber quando o bloqueio aconteceu (ex.: data de inativação de cliente/unidade, data em que a consultora foi desvinculada); onde essa data não existe hoje, o construtor cria o registro necessário via migration.
- **No web do gestor:** a lista de check-ins e o relatório de horas (tela e PDF) mostram o horário do celular, a marcação "offline" e o horário da sincronização ao lado. Online, nada muda: vale o horário do servidor, sem marcação.

Conflitos (descritos ao usuário, sem objeção):
- **Check-in online e checkout offline:** o checkout entra na fila e fecha o check-in com o horário do celular.
- **Encerramento automático de 12h:** se o checkout offline aconteceu antes do encerramento automático, mas chegou depois, vale o horário real da consultora, que substitui o automático (e o registro deixa de constar como encerrado automaticamente). Se o checkout real foi depois das 12h, o encerramento automático prevalece, como hoje.
- **Check-in offline com outro já aberto no servidor:** o envio é recusado e a consultora vê o aviso no app para resolver. Nada é descartado em silêncio.
- **Check-in e checkout ambos offline:** sobem juntos, na ordem.
- **Gestor encerrou ou editou o check-in antes do checkout offline chegar:** prevalece a ação do gestor (decisão humana explícita). O checkout offline é registrado como recusado e a consultora vê o aviso no app. *(Decisão do agente.)*
- **Como a consultora "resolve" um check-in offline recusado:** o app mostra o motivo e oferece descartar a marcação offline, com confirmação. A marcação recusada fica visível até ela decidir. *(Decisão do agente.)*

### 4. TestFlight

- Incrementar `CFBundleVersion` no `apps/mobile/ios/chekAI/Info.plist` (hoje `4`), mantendo `CFBundleShortVersionString` `1.0.0`. `ITSAppUsesNonExemptEncryption` já está `false`.
- Archive e envio pela linha de comando (`xcodebuild archive` + `-exportArchive` com destino de upload), assinatura automática com `-allowProvisioningUpdates`, autenticando com a chave de API da App Store Connect que o usuário vai fornecer (`~/.appstoreconnect/private_keys/AuthKey_<KeyID>.p8`, Key ID e Issuer ID). Time `35W4YR6DBH`, bundle `com.evobit.chekai`.
- **Destino:** teste interno ("meu TestFlight"), sem grupo externo nem revisão Beta da Apple.
- **Quem publica a API:** o agente abre o PR; o usuário faz o merge em `master` (como nos PRs anteriores), o que publica a API e roda as migrations. O agente só envia o build depois de confirmar que a API nova está no ar. *(Decisão do agente, seguindo o fluxo já usado.)*
- **Ordem de publicação:** as mudanças da API (idempotência, datas, check-in offline) e as migrations precisam estar em produção antes de o build chegar às testadoras, senão a fila do app falha contra a API antiga.
- Se o Ruby do sistema quebrar o CocoaPods, usar o Ruby do Homebrew para `pod install`; se o pod `fmt` falhar com o Xcode novo, aplicar o workaround já documentado no `Podfile`.

## Verificação esperada

- Testes automatizados (TDD) para: idempotência da criação de auditoria e de check-in na API; aceitação e validação de horários do celular; regra de conflito com o encerramento automático; push que retoma de onde parou sem duplicar fotos; fila com estados e limite de tentativas; migração SQLite nova.
- Verificação manual no iPhone (ou simulador com rede desligada): auditoria completa em modo avião, com fotos; reativar a rede e ver o envio; derrubar a rede no meio do envio e ver a retomada sem duplicar; check-in e checkout em modo avião; conferir no web a marcação "offline" e os dois horários.

## Deixado para o construtor

- Nomes exatos de colunas, campos de DTO e estados da fila.
- Tempos exatos (limite do GPS, limite da IA, tolerância de horário futuro, número de tentativas), dentro das sugestões acima.
- Texto final das mensagens na interface, seguindo o tom sóbrio do projeto.
- Forma de verificar "internet de fato" (ex.: `isInternetReachable` do NetInfo) e de cancelar o upload da IA ao estourar o tempo.

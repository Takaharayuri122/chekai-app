# AGENTS.md

## Learned User Preferences

- Commits, MRs e comunicação geral em português (pt-BR); alinhar implementação ao design system DaisyUI e regras NestJS/TS do projeto
- UX mobile-first em listagens e formulários — tabelas em cards no mobile, modais e fluxos pensados primeiro para telas pequenas; no app Expo, evitar `SafeAreaView` com inset superior duplicado em telas filhas quando o layout `(app)/_layout` já aplicar safe area no topo
- Modais com cabeçalho e rodapé fixos, scroll vertical no conteúdo, botão fechar visível e confirmação ao descartar alterações somente após interação real do usuário
- CRUDs administrativos no web seguem a skill `crud-frontend` com `CrudFiltros` + `CrudTable`: filtros com Pesquisar/Limpar, listagem com menu de ações, carga inicial ~20 registros
- Tabela CRUD: mesmo card visual dos filtros; menu de ações não pode ser cortado por overflow — usar posicionamento fixed + getBoundingClientRect
- Interfaces de checklist: tooltips em todas as ações, ícones sempre visíveis (não só hover), botões `btn-square`, ordem: duplicar → editar → remover; exclusões com `ConfirmDialog`, não `confirm()` nativo
- PDFs e downloads: preferir abrir/visualizar no navegador (nova aba) quando a intenção for "ver o arquivo"; tratar bloqueio de pop-up com orientação ao usuário e download manual; durante geração de PDF de relatório, usar overlay de carregamento em tela cheia alinhado ao padrão visual dos modais
- Fotos em itens de auditoria: permitir múltiplas seleções, upload e processamento de IA em sequência (não paralelo), feedback visual imediato, grid de duas colunas no mobile
- Para mudanças de schema no banco, preferir scripts SQL em `scripts/` em vez de migrations do TypeORM
- Isolamento e autorização de dados devem ser garantidos na API (não só no front); regras de vínculo gestor/consultor/tenant prevalecem para todos os perfis
- Ocultar o FAB de check-in/checkout nas áreas de checklist, auditoria e relatórios para evitar controles duplicados
- Quando funcionalidade envolver IA, respeitar auditoria de tokens e regras do projeto (`.cursor/rules/auditoria-tokens.mdc`)

## Learned Workspace Facts

- Monorepo: API NestJS em `apps/api`, frontend Next.js em `apps/web`, app mobile Expo em `apps/mobile`, UI com DaisyUI/Tailwind no web; componentes compartilhados em `apps/web/src/components/ui/` (form-modal, crud-table, crud-filtros, overlay de loading em PDF); geração de PDF de relatórios na API com Puppeteer/Chromium (Docker) e preparação de imagens com sharp; variáveis opcionais `CHEKAI_LOGO_URL` e `PDF_GERACAO_METRICAS`; PWA offline completo abandonado em favor de API direta; skills em `.cursor/skills/` (ex.: crud-frontend) e subagentes em `.cursor/agents/` (ex.: skill-architect, use-case-driven-dev); observabilidade do Cursor com Langfuse via hooks em `.cursor/hooks/` (variáveis `LANGFUSE_*` no `.env`); build nativo iOS: em macOS recentes o Ruby do sistema pode quebrar o CocoaPods — usar Ruby Homebrew para `pod install`; pode ser necessário workaround do pod `fmt`/Clang no `Podfile` com Xcode muito novo
- Isolamento de dados combina `gestorId` (clientes, checklists, usuários) e `consultorId` (auditorias, relatórios técnicos); JWT enriquecido e `@CurrentUser()` injetam contexto; padrão gestor vê recursos dos auditores vinculados
- Perfis de usuário: MASTER, GESTOR, AUDITOR (enum `PerfilUsuario`); fluxo de criação por convite, enum `StatusUsuario`, OTP só para conta ativa após aceite
- Checklist: templates com status rascunho/ativo/inativo, geração com IA via `IaService`, RAG via legislação e auditoria de tokens (`CreditoService`)
- Relatório técnico é por cliente (sem auditoria/pontuação), com wizard/pré-criação, apoio analítico gerado por IA (somente leitura), evidências fotográficas sem IA nas imagens
- Check-in: AUDITOR, GESTOR e MASTER podem usar; checkout exige `ConfirmDialog`; filtros de auditor/cliente refletem apenas o vínculo da conta
- E-mail: em produção (Railway), SMTP em portas clássicas dá timeout — usar provider HTTP (Resend, MailerSend ou SendGrid via HTTPS/443); em dev, Ethereal via `nodemailer.createTestAccount()`; provider efetivo depende de `EMAIL_PROVIDER`
- `FRONTEND_URL` deve existir em todos os ambientes; sem fallback para localhost — falhar claro se a variável faltar
- Templates HTML de e-mail precisam estar listados em assets no `nest-cli.json` para irem para `dist` no build
- TypeORM: salvar entidade após carregar relação filtrada pode anular FK nos filhos — atualizar metadados sem persistir array incompleto; respostas binárias ou stream na API (ex.: PDF): interceptores globais não devem envolver em JSON quando `res.headersSent` ou quando o handler já enviou o corpo / `StreamableFile`
- Sincronização mobile de auditorias: a listagem `GET /auditorias` na API deve incluir a relação `itens` para o pull offline popular `auditoria_itens` no SQLite (sem isso o checklist pode ficar vazio após sync)
- MemPalace MCP no projeto: wing `chekai` (rooms como `architecture`, `decisions`, `ux-patterns`); protocolo de uso em `.cursor/rules/mempalace.mdc` para memória persistente entre sessões

# Reestruturação visual do web ChekAI — Design

**Data:** 2026-10-17
**Escopo:** `apps/web` (Next.js 15, React 18, Tailwind 3.4). Fora: apps Expo, landing pública (`/`), modo escuro (tokens preparados, desligado).

## 1. Objetivo e princípios

Tornar o web coeso e fluido, com duas experiências por perfil: **AUDITOR** (execução rápida, mobile em campo) e **GESTOR/MASTER** (gestão e indicadores), sem perder funcionalidade nem alterar a API.

1. Mobile-first: toda tela nasce em 375px e expande para desktop.
2. Uma tarefa por tela: informação secundária vai para folhas, abas ou páginas de detalhe.
3. Cor com significado: teal = ação principal; verde/âmbar/vermelho = status; o resto neutro.
4. Hierarquia por perfil: menu e Início mudam conforme o perfil.
5. Linguagem sem jargão, tom sóbrio (regra existente do projeto).

## 2. Decisões tomadas

| Tema | Decisão |
|---|---|
| Navegação desktop | Sidebar fixa agrupada (Operação / Gestão / Administração), recolhível para ícones |
| Navegação mobile | Barra inferior com 4 destinos + botão central "+ Nova auditoria" + "Mais" (bottom sheet) |
| Direção visual | Sidebar navy `#1B2A4A` + conteúdo claro e limpo, teal `#00B8A9` como cor de ação |
| Execução da auditoria | Lista por seções com status por cor + detalhe da pergunta em folha (mobile) / duas colunas (desktop) |
| Base de componentes | shadcn/ui + Radix (substitui DaisyUI ao fim da migração) |

## 3. Etapas (cada uma publicável sozinha)

- **E1 — Fundação:** tokens, shadcn/ui, componentes base, novo shell (Sidebar, Topbar, BottomBar, MoreSheet). Todas as telas passam a usar o shell novo.
- **E2 — Campo:** Início por perfil, lista de auditorias, execução da auditoria, nova auditoria.
- **E3 — Gestão:** dashboard (abas), relatório da auditoria (abas), planos de ação, agenda, relatórios técnicos, check-ins.
- **E4 — Cadastros e admin:** clientes (página com abas), checklists (editor), equipe, perfil, telas master; remoção do DaisyUI.

## 4. Fundação técnica

- shadcn/ui via CLI compatível com Tailwind 3 (`shadcn@2.x`). Componentes em `src/components/ui/shadcn/` durante a transição; consolidados em `components/ui/` na E4.
- Dependências novas: primitivas Radix (via shadcn), `class-variance-authority`, `tailwindcss-animate`, `vaul`.
- **Tokens** (variáveis CSS em `globals.css`, mapeadas no `tailwind.config.ts`):
  - `primary` #00B8A9; `sidebar` #1B2A4A com texto `#C7D0E0` e ativo teal suave; `background` #F4F7FA; `card` #FFFFFF; `border` #E5E9F0; `foreground` #1B2A4A; `muted-foreground` #64748B.
  - Status: `success` #10B981, `warning` #F59E0B, `danger` #EF4444, `info` #3B82F6, cada um com variante suave para chips.
  - Raio: 10px cartões, 8px controles. Sombras: `sm` (cartões) e `lg` (folhas/menus).
  - Tipografia: Inter (texto), Montserrat (títulos); escala 24/20/16 títulos, 14 corpo, 12 legenda.
  - Gutter: 16px mobile, 32px desktop.
- **Convivência com DaisyUI:** o tema DaisyUI é mantido com os mesmos valores, de modo que `bg-primary` etc. resultem na mesma cor nas telas antigas e novas. DaisyUI é removido na E4 após busca por classes remanescentes (`btn`, `card`, `modal`, `badge`, `menu`, `dropdown`, `tabs`, `input`, `select`, `table`).
- **Componentes base:** Button, Input, Select, Textarea, Checkbox, Switch, Label, Badge, Card, Tabs, DropdownMenu, Tooltip, Dialog, Sheet, Drawer, Skeleton, Separator, Avatar, Command.
- **Componentes ChekAI:** `AppShell`, `Sidebar`, `Topbar`, `BottomBar`, `MoreSheet`, `PageHeader`, `StatusChip`, `StatCard`, `EmptyState`, `ResponsiveDialog` (Dialog no desktop, Drawer no mobile; substitui `FormModal`).
- `toastService` mantém a mesma API.
- `CrudFiltros`, `CrudTable`, `ConfirmDialog`, `FormModal` continuam funcionando até a migração das suas telas.

## 5. Shell e navegação

**Desktop (≥1024px):** sidebar navy 240px (recolhível para 64px, preferência em `localStorage`); logo no topo, avatar no rodapé com Perfil, Limites/Créditos (gestor) e Sair. Topbar branca com busca global (⌘K — telas e entidades já carregadas), "+ Nova auditoria" e atalho de check-in.
**Tablet (768–1023px):** sidebar inicia recolhida.
**Mobile (<768px):** topbar compacta (título + ação de contexto, safe area). Barra inferior com 4 destinos + botão central "+". "Mais" abre bottom sheet em grade com o restante + Perfil/Sair. O check-in vira item do Início e do "Mais"; continua oculto em checklist, auditoria e relatórios.

| Grupo | AUDITOR | GESTOR | MASTER |
|---|---|---|---|
| — | Início | Início | Início |
| Operação | Auditorias, Agenda, Planos de ação, Relatórios técnicos | idem + Check-ins | idem |
| Gestão | — | Clientes, Checklists, Equipe | idem + Legislações |
| Administração | — | — | Lista de espera, Planos, Assinaturas, Créditos, Consumo de IA |
| Conta (avatar) | Perfil | Perfil, Limites, Créditos | Perfil |

Barra inferior — Auditor: Início · Auditorias · ➕ · Agenda · Mais. Gestor/Master: Início · Auditorias · ➕ · Planos de ação · Mais.
Renomeações de rótulo: "Usuários" → "Equipe"; "Auditoria Tokens" → "Consumo de IA" (rotas mantidas).
Fluidez: transição de página ~150ms (opacidade), skeletons no lugar de spinners, item ativo em teal suave com indicador lateral.

## 6. Padrões de tela

- **Anatomia:** `PageHeader` (título, subtítulo, até 1 ação primária; secundárias em "⋯") → filtros (no mobile, botão "Filtros" que abre folha com contagem de ativos) → conteúdo.
- **Listagens:** desktop em tabela limpa (linhas 48px, ações em "⋯" com posicionamento fixo); mobile em cards de 2 linhas (título + chip; metadados em cinza). Carga inicial ~20 + "Carregar mais".
- **Edição:** cadastros simples em `ResponsiveDialog`; entidades grandes (cliente, checklist, auditoria) em página própria com abas.
- **Telas-chave:**
  - Início Auditor: "Continuar auditoria", "Hoje na agenda", "Minhas tarefas atrasadas", botão grande "Nova auditoria".
  - Início Gestor: 4 KPIs + abas Visão geral / Checklists / Equipe / Unidades (gráficos e rankings dentro das abas).
  - Execução: lista por seções + detalhe em folha/duas colunas; IA e histórico recolhidos no detalhe; tela de revisão antes de finalizar (pendentes, não conformidades, Finalizar).
  - Relatório: topo com nota, status e ações (PDF, Gerar plano de ação) + abas Resumo / Não conformidades / Itens / Evolução.
  - Editor de checklist: grupos à esquerda, perguntas à direita (desktop); edição da pergunta em folha lateral; avançado recolhido.
  - Cliente: página com abas Dados · Unidades · Auditorias · Equipe.
- **Estados:** skeleton, vazio com ação, erro com "Tentar novamente".
- **Acessibilidade:** foco/teclado via Radix, toque ≥44px no mobile, contraste AA.
- Regras de UX do `AGENTS.md` continuam valendo (modais com cabeçalho/rodapé fixos e confirmação de descarte só após interação, `ConfirmDialog` em exclusões, tooltips e ordem duplicar → editar → remover em checklists, FAB oculto em checklist/auditoria/relatórios, PDF em nova aba com tratamento de pop-up).

## 7. Verificação e publicação

- Por etapa: `tsc --noEmit` e `next build` sem erros; teste local (`next dev` porta 3031 + API local) nos 3 perfis em 375px e 1440px.
- Checklist por tela: sem scroll horizontal, toque ≥44px, modais com header/footer fixos, menus sem corte, estados carregando/vazio/erro.
- Fluxo crítico ponta a ponta: login → nova auditoria → responder com foto → finalizar → relatório → PDF → gerar plano de ação.
- Cada etapa vira commit(s) em pt-BR; validação local com o usuário antes do push (deploy Railway) e acompanhamento de logs.
- Sem mudanças de API: rollback é reverter o frontend.

## 8. Riscos

- Conflito DaisyUI × shadcn → mesmos tokens, pasta isolada, remoção só na E4.
- Telas de 1.200–1.700 linhas → quebrar em componentes por seção ao migrar, sem mudar comportamento.
- PWA (`next-pwa`) mantido como está.
- `AGENTS.md`: atualizar a preferência de design system para shadcn/ui + Radix com tokens da marca.

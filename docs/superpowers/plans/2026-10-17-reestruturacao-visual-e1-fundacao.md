# Reestruturação visual — E1 Fundação e Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instalar shadcn/ui com os tokens da marca e trocar o shell do web (navbar horizontal) por sidebar navy agrupada por perfil no desktop e barra inferior com botão central + "Mais" no mobile, aplicando-se automaticamente a todas as telas que usam `AppLayout`.

**Architecture:** A configuração de navegação vira um módulo puro e testado (`navegacao.ts`) consumido por `Sidebar`, `BottomBar`, `MoreSheet` e `BuscaGlobal`. `AppLayout` mantém o nome e a assinatura (todas as páginas já o usam) e passa a renderizar `AppShell`. Primitivas shadcn ficam isoladas em `src/components/ui/shadcn/`; DaisyUI continua ativo com os mesmos valores de cor até a E4.

**Tech Stack:** Next.js 15 (App Router), React 18, Tailwind 3.4, DaisyUI 4 (temporário), shadcn/ui (CLI `shadcn@2.3.0`, compatível com Tailwind 3), Radix, vaul, cmdk, lucide-react, framer-motion, Vitest 2 (testes de lógica pura).

**Spec:** `docs/superpowers/specs/2026-10-17-reestruturacao-visual-web-design.md`

**Planos seguintes:** E2 (campo), E3 (gestão) e E4 (cadastros/admin + remoção DaisyUI) terão planos próprios, escritos após a E1 ser validada, usando as APIs reais dos componentes criados aqui.

## Global Constraints

- Escopo: somente `apps/web`. Não alterar `apps/api`, `apps/mobile` nem a landing `src/app/page.tsx`.
- Cores: primary `#00B8A9`; sidebar `#1B2A4A` com texto `#C7D0E0`; background `#F4F7FA`; card `#FFFFFF`; border `#E5E9F0`; foreground `#1B2A4A`; muted-foreground `#64748B`; success `#10B981`; warning `#F59E0B`; danger `#EF4444`; info `#3B82F6`.
- Raio: 10px cartões, 8px controles. Sombras: apenas `shadow-sm` (cartões) e `shadow-lg` (folhas/menus).
- Tipografia: Inter (texto, `font-sans`), Montserrat (títulos, `font-display`).
- Gutter: 16px mobile (`px-4`), 32px desktop (`lg:px-8`).
- Breakpoints: mobile `<768px` (barra inferior); tablet `768–1023px` (sidebar inicia recolhida); desktop `≥1024px` (sidebar 240px, recolhível para 64px).
- Toque mínimo de 44px no mobile.
- Rótulos: "Usuários" → "Equipe"; "Auditoria Tokens" → "Consumo de IA". Rotas não mudam.
- Textos em pt-BR, tom sóbrio, sem jargão de TI.
- Componentes shadcn não podem usar os tokens `secondary`/`accent` (no DaisyUI eles são ciano/âmbar); usar `muted`.
- Não criar classes CSS com nomes de componentes DaisyUI (`card`, `drawer`, `menu`, `modal`, `badge`, `tabs`, `btn`, `avatar`, `dropdown`, `tooltip`, `stat`).
- `toastService`, `CrudFiltros`, `CrudTable`, `ConfirmDialog`, `FormModal` mantêm API e funcionamento.
- Commits em pt-BR terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Perfil sem permissão vendo item de outro perfil (ex.: AUDITOR vendo "Clientes" ou MASTER-only para GESTOR) — o menu deve refletir exatamente a tabela da spec; testado em `navegacao.test.ts`.
2. Rota de execução `/admin/auditoria/<id>` deve marcar "Auditorias" como ativa, mas `/admin/auditoria/nova` não (é o botão central) — testado em `isRotaAtiva`.
3. Busca com acento/maiúsculas ("relatorio", "AGENDA") deve encontrar "Relatórios técnicos"/"Agenda" — testado em `filtrarItensBusca`.
4. Preferência de sidebar recolhida corrompida ou `localStorage` indisponível (modo privado) não pode quebrar o shell — coberto no Task 5 com try/catch e default por largura.
5. Conteúdo das telas antigas sob a barra inferior/topbar (cabeçalhos sticky e último item da lista escondido) — `PageHeader` sticky em `top-14` e `main` com `pb-24` no mobile; verificado no Task 8.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/web/vitest.config.ts` (novo) | Config de testes de lógica pura, alias `@` |
| `apps/web/components.json` (novo) | Config do CLI shadcn |
| `apps/web/src/lib/cn.ts` (novo) | `cn()` (clsx + tailwind-merge) |
| `apps/web/src/app/globals.css` | Tokens CSS (`:root`) + base |
| `apps/web/tailwind.config.ts` | Mapeia tokens, raio, `tailwindcss-animate` |
| `apps/web/src/app/layout.tsx` | `body` com `bg-background text-foreground` |
| `apps/web/src/components/ui/shadcn/*` (novos, via CLI) | Primitivas |
| `apps/web/src/hooks/use-media-query.ts` (novo) | Hook de media query |
| `apps/web/src/components/layout/navegacao.ts` (novo) | Config de navegação por perfil + funções puras |
| `apps/web/src/components/layout/navegacao.test.ts` (novo) | Testes da navegação |
| `apps/web/src/components/layout/sidebar.tsx` (novo) | Sidebar navy desktop/tablet |
| `apps/web/src/components/layout/topbar.tsx` (novo) | Barra superior (busca, nova auditoria) |
| `apps/web/src/components/layout/bottom-bar.tsx` (novo) | Barra inferior mobile + botão central |
| `apps/web/src/components/layout/more-sheet.tsx` (novo) | Folha "Mais" |
| `apps/web/src/components/layout/busca-global.tsx` (novo) | Paleta ⌘K |
| `apps/web/src/components/layout/menu-conta.tsx` (novo) | Menu do avatar (Perfil, Limites, Créditos, Sair) |
| `apps/web/src/components/layout/app-shell.tsx` (novo) | Composição do shell |
| `apps/web/src/components/layout/app-layout.tsx` | Mantém auth/hidratação, renderiza `AppShell` |
| `apps/web/src/components/layout/navbar.tsx` | Removido |
| `apps/web/src/components/ui/page-header.tsx` | Restyle com tokens, sticky `top-14` |
| `apps/web/src/components/ui/stat-card.tsx` | Restyle (mesma API) |
| `apps/web/src/components/ui/empty-state.tsx` | Restyle (mesma API) |
| `apps/web/src/components/ui/status-chip.tsx` (novo) | Chip de status + `getTomStatus` |
| `apps/web/src/components/ui/status-chip.test.ts` (novo) | Testes do mapeamento de status |
| `apps/web/src/components/ui/responsive-dialog.tsx` (novo) | Dialog (desktop) / Drawer (mobile) |
| `apps/web/src/components/index.ts` | Exports novos, remove `Navbar` |
| `AGENTS.md` | Preferência de design system atualizada |

---

### Task 1: Ferramenta de testes (Vitest)

**Files:**
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json` (script `test`)

**Interfaces:**
- Produces: `npm run test -w @meta-app/web` roda `src/**/*.test.ts` em ambiente node com alias `@` → `src`.

- [ ] **Step 1: Instalar Vitest**

Run: `cd /Users/yuricarvalho/Projetos/evobit/meta-app && npm install -D vitest@2.1.9 -w @meta-app/web`
Expected: instala sem erros de peer dependency.

- [ ] **Step 2: Criar `apps/web/vitest.config.ts`**

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
```

- [ ] **Step 3: Adicionar script em `apps/web/package.json`**

Em `"scripts"`, adicionar após `"lint"`:

```json
"test": "vitest run"
```

- [ ] **Step 4: Rodar (sem testes ainda)**

Run: `cd apps/web && npx vitest run --passWithNoTests`
Expected: `No test files found` e saída 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/package.json package-lock.json
git commit -m "Configurar Vitest no web para testes de lógica pura

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tokens da marca e base Tailwind

**Files:**
- Modify: `apps/web/src/app/globals.css` (topo do arquivo)
- Modify: `apps/web/tailwind.config.ts`
- Modify: `apps/web/src/app/layout.tsx:66`
- Create: `apps/web/src/lib/cn.ts`

**Interfaces:**
- Produces: classes Tailwind `bg-background`, `text-foreground`, `bg-card`, `bg-popover`, `bg-muted`, `text-muted-foreground`, `border-border`, `border-input`, `ring-ring`, `bg-primary`, `text-primary-foreground`, `bg-destructive`, `text-destructive`, `bg-success`, `bg-warning`, `bg-info`, `bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border`, `rounded-lg` (10px), `rounded-md` (8px), `rounded-sm` (6px); função `cn(...inputs: ClassValue[]): string` em `@/lib/cn`.

- [ ] **Step 1: Instalar dependências**

Run: `npm install class-variance-authority@0.7.1 tailwindcss-animate@1.0.7 -w @meta-app/web`

- [ ] **Step 2: Criar `apps/web/src/lib/cn.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Inserir tokens no topo de `apps/web/src/app/globals.css`, logo após `@tailwind utilities;`**

```css
@layer base {
  :root {
    --background: 210 33% 96%;
    --foreground: 221 46% 20%;
    --card: 0 0% 100%;
    --card-foreground: 221 46% 20%;
    --popover: 0 0% 100%;
    --popover-foreground: 221 46% 20%;
    --primary: 175 100% 36%;
    --primary-foreground: 0 0% 100%;
    --muted: 214 32% 95%;
    --muted-foreground: 215 16% 47%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --success: 160 84% 39%;
    --warning: 38 92% 50%;
    --info: 217 91% 60%;
    --border: 218 27% 92%;
    --input: 218 27% 92%;
    --ring: 175 100% 36%;
    --sidebar: 221 46% 20%;
    --sidebar-foreground: 218 28% 83%;
    --sidebar-border: 221 35% 27%;
    --radius: 0.625rem;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
  }
}
```

- [ ] **Step 4: Substituir o bloco `theme` de `apps/web/tailwind.config.ts`**

Trocar `theme: { extend: { fontFamily: {...} } },` e `plugins: [typography, daisyui],` por:

```ts
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
      },
      colors: {
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
        },
        success: 'hsl(var(--success) / <alpha-value>)',
        warning: 'hsl(var(--warning) / <alpha-value>)',
        info: 'hsl(var(--info) / <alpha-value>)',
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar) / <alpha-value>)',
          foreground: 'hsl(var(--sidebar-foreground) / <alpha-value>)',
          border: 'hsl(var(--sidebar-border) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [typography, animate, daisyui],
```

E adicionar no topo: `import animate from 'tailwindcss-animate';`

- [ ] **Step 5: Ajustar `body` em `apps/web/src/app/layout.tsx`**

Trocar `bg-base-200 min-h-screen` por `bg-background text-foreground min-h-screen` na `className` do `<body>`.

- [ ] **Step 6: Verificar build de tipos e CSS**

Run: `cd apps/web && npx tsc --noEmit && npx next build`
Expected: build conclui. As telas antigas mantêm as cores (DaisyUI `primary` = mesmo teal).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/tailwind.config.ts apps/web/src/app/layout.tsx apps/web/src/lib/cn.ts apps/web/package.json package-lock.json
git commit -m "Adicionar tokens visuais da marca e base para shadcn/ui

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Primitivas shadcn/ui

**Files:**
- Create: `apps/web/components.json`
- Create (CLI): `apps/web/src/components/ui/shadcn/{button,input,label,textarea,select,checkbox,switch,badge,card,tabs,dropdown-menu,tooltip,dialog,sheet,drawer,skeleton,separator,avatar,command}.tsx`

**Interfaces:**
- Consumes: `cn` de `@/lib/cn`; tokens do Task 2.
- Produces: exports padrão shadcn (`Button`, `buttonVariants`, `Input`, `Label`, `Textarea`, `Select*`, `Checkbox`, `Switch`, `Badge`, `Card*`, `Tabs*`, `DropdownMenu*`, `Tooltip*`/`TooltipProvider`, `Dialog*`, `Sheet*`, `Drawer*`, `Skeleton`, `Separator`, `Avatar*`, `Command*`/`CommandDialog`) em `@/components/ui/shadcn/<nome>`.

- [ ] **Step 1: Criar `apps/web/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/cn",
    "ui": "@/components/ui/shadcn",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

- [ ] **Step 2: Gerar as primitivas**

Run:
```bash
cd apps/web && npx shadcn@2.3.0 add button input label textarea select checkbox switch badge card tabs dropdown-menu tooltip dialog sheet drawer skeleton separator avatar command --yes --overwrite
```
Expected: arquivos criados em `src/components/ui/shadcn/` e dependências Radix, `vaul` e `cmdk` adicionadas ao `apps/web/package.json`. Se o CLI tentar instalar com outro gerenciador, rodar depois `cd ../.. && npm install`.

- [ ] **Step 3: Desfazer alterações indesejadas do CLI em CSS/config**

Run: `git diff --stat apps/web/src/app/globals.css apps/web/tailwind.config.ts`
Se houver diff, restaurar o estado do Task 2: `git checkout apps/web/src/app/globals.css apps/web/tailwind.config.ts`.

- [ ] **Step 4: Trocar tokens `secondary`/`accent` por `muted` nas primitivas**

Run:
```bash
cd apps/web/src/components/ui/shadcn && \
sed -i '' -e 's/bg-accent/bg-muted/g' -e 's/text-accent-foreground/text-foreground/g' \
  -e 's/bg-secondary/bg-muted/g' -e 's/text-secondary-foreground/text-foreground/g' \
  -e 's/hover:bg-secondary\/80/hover:bg-muted\/80/g' *.tsx && \
grep -n "secondary\|accent" *.tsx
```
Expected: o `grep` só encontra nomes de variante (ex.: `secondary:` em `buttonVariants`/`badgeVariants`), nenhuma classe `bg-secondary`/`bg-accent`.

- [ ] **Step 5: Verificar tipos**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components.json apps/web/src/components/ui/shadcn apps/web/package.json package-lock.json
git commit -m "Adicionar primitivas shadcn/ui alinhadas aos tokens da marca

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Configuração de navegação por perfil (TDD)

**Files:**
- Create: `apps/web/src/components/layout/navegacao.ts`
- Test: `apps/web/src/components/layout/navegacao.test.ts`

**Interfaces:**
- Consumes: `PerfilUsuario` de `@/lib/store`.
- Produces:
  - `interface ItemNavegacao { href: string; label: string; icon: LucideIcon; perfis: PerfilUsuario[] }`
  - `interface GrupoNavegacao { id: 'inicio' | 'operacao' | 'gestao' | 'administracao'; titulo: string | null; itens: ItemNavegacao[] }`
  - `const HREF_NOVA_AUDITORIA = '/admin/auditoria/nova'`
  - `getGruposNavegacao(perfil: PerfilUsuario): GrupoNavegacao[]`
  - `getItensConta(perfil: PerfilUsuario): ItemNavegacao[]`
  - `getBarraInferior(perfil: PerfilUsuario): ItemNavegacao[]` (3 itens; "Mais" é renderizado à parte)
  - `getItensMais(perfil: PerfilUsuario): ItemNavegacao[]`
  - `isRotaAtiva(pathname: string, href: string): boolean`
  - `filtrarItensBusca(itens: ItemNavegacao[], termo: string): ItemNavegacao[]`

- [ ] **Step 1: Escrever os testes**

```ts
import { describe, expect, it } from 'vitest';
import { PerfilUsuario } from '@/lib/store';
import {
  HREF_NOVA_AUDITORIA,
  filtrarItensBusca,
  getBarraInferior,
  getGruposNavegacao,
  getItensConta,
  getItensMais,
  isRotaAtiva,
} from './navegacao';

const labels = (perfil: PerfilUsuario) =>
  getGruposNavegacao(perfil).map((g) => ({ id: g.id, itens: g.itens.map((i) => i.label) }));

describe('getGruposNavegacao', () => {
  it('auditor vê só Início e Operação sem Check-ins', () => {
    expect(labels(PerfilUsuario.AUDITOR)).toEqual([
      { id: 'inicio', itens: ['Início'] },
      { id: 'operacao', itens: ['Auditorias', 'Agenda', 'Planos de ação', 'Relatórios técnicos'] },
    ]);
  });

  it('gestor vê Operação com Check-ins e Gestão sem Legislações', () => {
    expect(labels(PerfilUsuario.GESTOR)).toEqual([
      { id: 'inicio', itens: ['Início'] },
      { id: 'operacao', itens: ['Auditorias', 'Agenda', 'Planos de ação', 'Relatórios técnicos', 'Check-ins'] },
      { id: 'gestao', itens: ['Clientes', 'Checklists', 'Equipe'] },
    ]);
  });

  it('master vê Legislações e Administração', () => {
    const grupos = labels(PerfilUsuario.MASTER);
    expect(grupos.find((g) => g.id === 'gestao')?.itens).toEqual(['Clientes', 'Checklists', 'Equipe', 'Legislações']);
    expect(grupos.find((g) => g.id === 'administracao')?.itens).toEqual([
      'Lista de espera', 'Planos', 'Assinaturas', 'Créditos', 'Consumo de IA',
    ]);
  });
});

describe('getItensConta', () => {
  it('gestor tem Limites e Créditos; auditor e master só Perfil', () => {
    expect(getItensConta(PerfilUsuario.GESTOR).map((i) => i.label)).toEqual(['Meu perfil', 'Meus limites', 'Meus créditos']);
    expect(getItensConta(PerfilUsuario.AUDITOR).map((i) => i.label)).toEqual(['Meu perfil']);
    expect(getItensConta(PerfilUsuario.MASTER).map((i) => i.label)).toEqual(['Meu perfil']);
  });
});

describe('getBarraInferior', () => {
  it('auditor: Início, Auditorias, Agenda', () => {
    expect(getBarraInferior(PerfilUsuario.AUDITOR).map((i) => i.label)).toEqual(['Início', 'Auditorias', 'Agenda']);
  });
  it('gestor e master: Início, Auditorias, Planos de ação', () => {
    expect(getBarraInferior(PerfilUsuario.GESTOR).map((i) => i.label)).toEqual(['Início', 'Auditorias', 'Planos de ação']);
    expect(getBarraInferior(PerfilUsuario.MASTER).map((i) => i.label)).toEqual(['Início', 'Auditorias', 'Planos de ação']);
  });
});

describe('getItensMais', () => {
  it('exclui itens da barra inferior e inclui conta', () => {
    const mais = getItensMais(PerfilUsuario.AUDITOR).map((i) => i.label);
    expect(mais).toEqual(['Planos de ação', 'Relatórios técnicos', 'Meu perfil']);
  });
});

describe('isRotaAtiva', () => {
  it('casa rota exata e subrotas', () => {
    expect(isRotaAtiva('/admin/clientes', '/admin/clientes')).toBe(true);
    expect(isRotaAtiva('/admin/clientes/123', '/admin/clientes')).toBe(true);
    expect(isRotaAtiva('/admin/clientes-x', '/admin/clientes')).toBe(false);
  });
  it('execução da auditoria ativa Auditorias, mas nova auditoria não', () => {
    expect(isRotaAtiva('/admin/auditoria/abc', '/admin/auditorias')).toBe(true);
    expect(isRotaAtiva('/admin/auditoria/abc/relatorio', '/admin/auditorias')).toBe(true);
    expect(isRotaAtiva(HREF_NOVA_AUDITORIA, '/admin/auditorias')).toBe(false);
  });
  it('Planos não fica ativo em Planos de ação', () => {
    expect(isRotaAtiva('/admin/planos-acao', '/admin/planos')).toBe(false);
  });
});

describe('filtrarItensBusca', () => {
  const itens = getGruposNavegacao(PerfilUsuario.GESTOR).flatMap((g) => g.itens);
  it('ignora acentos e maiúsculas', () => {
    expect(filtrarItensBusca(itens, 'relatorio').map((i) => i.label)).toEqual(['Relatórios técnicos']);
    expect(filtrarItensBusca(itens, 'AGENDA').map((i) => i.label)).toEqual(['Agenda']);
  });
  it('termo vazio retorna tudo', () => {
    expect(filtrarItensBusca(itens, '   ')).toHaveLength(itens.length);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run src/components/layout/navegacao.test.ts`
Expected: FAIL — `Failed to resolve import "./navegacao"`.

- [ ] **Step 3: Implementar `navegacao.ts`**

```ts
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  ClipboardPen,
  Clock3,
  Coins,
  FileText,
  Home,
  ListChecks,
  Package,
  Settings,
  TrendingUp,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import { PerfilUsuario } from '@/lib/store';

export interface ItemNavegacao {
  href: string;
  label: string;
  icon: LucideIcon;
  perfis: PerfilUsuario[];
}

export interface GrupoNavegacao {
  id: 'inicio' | 'operacao' | 'gestao' | 'administracao';
  titulo: string | null;
  itens: ItemNavegacao[];
}

export const HREF_NOVA_AUDITORIA = '/admin/auditoria/nova';

const { AUDITOR, GESTOR, MASTER } = PerfilUsuario;
const TODOS = [AUDITOR, GESTOR, MASTER];
const GESTAO = [GESTOR, MASTER];
const SO_MASTER = [MASTER];

const INICIO: ItemNavegacao = { href: '/admin/dashboard', label: 'Início', icon: Home, perfis: TODOS };
const AUDITORIAS: ItemNavegacao = { href: '/admin/auditorias', label: 'Auditorias', icon: ClipboardCheck, perfis: TODOS };
const AGENDA: ItemNavegacao = { href: '/admin/agenda', label: 'Agenda', icon: CalendarClock, perfis: TODOS };
const PLANOS_ACAO: ItemNavegacao = { href: '/admin/planos-acao', label: 'Planos de ação', icon: ListChecks, perfis: TODOS };

const GRUPOS: GrupoNavegacao[] = [
  { id: 'inicio', titulo: null, itens: [INICIO] },
  {
    id: 'operacao',
    titulo: 'Operação',
    itens: [
      AUDITORIAS,
      AGENDA,
      PLANOS_ACAO,
      { href: '/admin/relatorios-tecnicos', label: 'Relatórios técnicos', icon: ClipboardPen, perfis: TODOS },
      { href: '/admin/checkins', label: 'Check-ins', icon: Clock3, perfis: GESTAO },
    ],
  },
  {
    id: 'gestao',
    titulo: 'Gestão',
    itens: [
      { href: '/admin/clientes', label: 'Clientes', icon: Building2, perfis: GESTAO },
      { href: '/admin/templates', label: 'Checklists', icon: FileText, perfis: GESTAO },
      { href: '/admin/usuarios', label: 'Equipe', icon: Users, perfis: GESTAO },
      { href: '/admin/legislacoes', label: 'Legislações', icon: BookOpen, perfis: SO_MASTER },
    ],
  },
  {
    id: 'administracao',
    titulo: 'Administração',
    itens: [
      { href: '/admin/lista-espera', label: 'Lista de espera', icon: ClipboardList, perfis: SO_MASTER },
      { href: '/admin/planos', label: 'Planos', icon: Package, perfis: SO_MASTER },
      { href: '/admin/planos/assinaturas', label: 'Assinaturas', icon: UserCheck, perfis: SO_MASTER },
      { href: '/admin/configuracoes-credito', label: 'Créditos', icon: Settings, perfis: SO_MASTER },
      { href: '/admin/auditoria-tokens', label: 'Consumo de IA', icon: BarChart3, perfis: SO_MASTER },
    ],
  },
];

const CONTA: ItemNavegacao[] = [
  { href: '/admin/perfil', label: 'Meu perfil', icon: User, perfis: TODOS },
  { href: '/admin/gestor/limites', label: 'Meus limites', icon: TrendingUp, perfis: [GESTOR] },
  { href: '/admin/gestor/creditos', label: 'Meus créditos', icon: Coins, perfis: [GESTOR] },
];

/** Rotas cujas subpáginas pertencem a outro item do menu (ex.: execução pertence a "Auditorias"). */
const ROTAS_RELACIONADAS: Record<string, string[]> = {
  '/admin/auditorias': ['/admin/auditoria'],
};

export function getGruposNavegacao(perfil: PerfilUsuario): GrupoNavegacao[] {
  return GRUPOS.map((grupo) => ({ ...grupo, itens: grupo.itens.filter((i) => i.perfis.includes(perfil)) })).filter(
    (grupo) => grupo.itens.length > 0,
  );
}

export function getItensConta(perfil: PerfilUsuario): ItemNavegacao[] {
  return CONTA.filter((i) => i.perfis.includes(perfil));
}

export function getBarraInferior(perfil: PerfilUsuario): ItemNavegacao[] {
  return [INICIO, AUDITORIAS, perfil === AUDITOR ? AGENDA : PLANOS_ACAO];
}

export function getItensMais(perfil: PerfilUsuario): ItemNavegacao[] {
  const naBarra = new Set(getBarraInferior(perfil).map((i) => i.href));
  const navegacao = getGruposNavegacao(perfil).flatMap((g) => g.itens);
  return [...navegacao, ...getItensConta(perfil)].filter((i) => !naBarra.has(i.href));
}

function casa(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isRotaAtiva(pathname: string, href: string): boolean {
  if (casa(pathname, href)) return true;
  if (pathname === HREF_NOVA_AUDITORIA) return false;
  return (ROTAS_RELACIONADAS[href] ?? []).some((base) => casa(pathname, base));
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function filtrarItensBusca(itens: ItemNavegacao[], termo: string): ItemNavegacao[] {
  const t = normalizar(termo);
  if (!t) return itens;
  return itens.filter((i) => normalizar(i.label).includes(t));
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run src/components/layout/navegacao.test.ts`
Expected: PASS (todos os testes).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/layout/navegacao.ts apps/web/src/components/layout/navegacao.test.ts
git commit -m "Adicionar configuração de navegação por perfil com testes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Componentes do shell (Sidebar, Topbar, BottomBar, MoreSheet, BuscaGlobal, MenuConta)

**Files:**
- Create: `apps/web/src/hooks/use-media-query.ts`
- Create: `apps/web/src/components/layout/menu-conta.tsx`
- Create: `apps/web/src/components/layout/sidebar.tsx`
- Create: `apps/web/src/components/layout/topbar.tsx`
- Create: `apps/web/src/components/layout/bottom-bar.tsx`
- Create: `apps/web/src/components/layout/more-sheet.tsx`
- Create: `apps/web/src/components/layout/busca-global.tsx`

**Interfaces:**
- Consumes: Task 3 (`DropdownMenu*`, `Tooltip*`, `Drawer*`, `CommandDialog`, `Command*`, `Button`, `Avatar*`), Task 4 (todas as funções de `navegacao.ts`), `useAuthStore` (`usuario`, `logout`).
- Produces:
  - `useMediaQuery(query: string): boolean`
  - `MenuConta({ variante }: { variante: 'sidebar' | 'compacto'; recolhida?: boolean })`
  - `Sidebar({ recolhida, onAlternar }: { recolhida: boolean; onAlternar: () => void })`
  - `Topbar({ onAbrirBusca }: { onAbrirBusca: () => void })`
  - `BottomBar()`
  - `MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void })`
  - `BuscaGlobal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void })`

- [ ] **Step 1: `apps/web/src/hooks/use-media-query.ts`**

```ts
'use client';

import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notificar) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', notificar);
      return () => mql.removeEventListener('change', notificar);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
```

- [ ] **Step 2: `apps/web/src/components/layout/menu-conta.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { ChevronsUpDown, LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import { getItensConta } from './navegacao';

const PERFIL_LABEL: Record<string, string> = { master: 'Administrador', gestor: 'Gestor', auditor: 'Auditor' };

export function iniciais(nome?: string): string {
  if (!nome) return 'U';
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

export function MenuConta({ variante, recolhida = false }: { variante: 'sidebar' | 'compacto'; recolhida?: boolean }) {
  const { usuario, logout } = useAuthStore();
  if (!usuario) return null;

  const sair = () => {
    logout();
    window.location.href = '/';
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          'flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
          variante === 'sidebar' && 'w-full p-2 text-left hover:bg-white/5',
          variante === 'sidebar' && recolhida && 'justify-center',
        )}
        aria-label="Abrir menu da conta"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          {iniciais(usuario.nome)}
        </span>
        {variante === 'sidebar' && !recolhida && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">{usuario.nome}</span>
              <span className="block truncate text-xs text-sidebar-foreground">{PERFIL_LABEL[usuario.perfil]}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 text-sidebar-foreground" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variante === 'sidebar' ? 'start' : 'end'} side={variante === 'sidebar' ? 'top' : 'bottom'} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{usuario.nome}</span>
          <span className="block truncate text-xs text-muted-foreground">{usuario.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {getItensConta(usuario.perfil).map((item) => (
          <DropdownMenuItem key={item.href} asChild>
            <Link href={item.href}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={sair} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 3: `apps/web/src/components/layout/sidebar.tsx`**

```tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/shadcn/tooltip';
import { MenuConta } from './menu-conta';
import { getGruposNavegacao, isRotaAtiva, type ItemNavegacao } from './navegacao';

function LinkSidebar({ item, ativo, recolhida }: { item: ItemNavegacao; ativo: boolean; recolhida: boolean }) {
  const link = (
    <Link
      href={item.href}
      aria-current={ativo ? 'page' : undefined}
      className={cn(
        'relative flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors',
        'text-sidebar-foreground hover:bg-white/5 hover:text-white',
        ativo && 'bg-primary/15 font-semibold text-white',
        recolhida && 'justify-center px-0',
      )}
    >
      {ativo && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-primary" aria-hidden />}
      <item.icon className={cn('h-[18px] w-[18px] shrink-0', ativo && 'text-primary')} />
      {!recolhida && <span className="truncate">{item.label}</span>}
    </Link>
  );
  if (!recolhida) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  );
}

export function Sidebar({ recolhida, onAlternar }: { recolhida: boolean; onAlternar: () => void }) {
  const pathname = usePathname();
  const { usuario } = useAuthStore();
  if (!usuario) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 md:flex print:hidden',
          recolhida ? 'w-16' : 'w-60',
        )}
        aria-label="Menu principal"
      >
        <div className={cn('flex h-14 items-center border-b border-sidebar-border', recolhida ? 'justify-center' : 'px-4')}>
          <Link href="/admin/dashboard" aria-label="Início">
            {recolhida ? (
              <Image src="/icons/icon-192x192.png" alt="ChekAI" width={28} height={28} className="rounded-md" />
            ) : (
              <Image src="/images/logo-large.png" alt="ChekAI" width={120} height={28} className="h-7 w-auto brightness-0 invert" priority />
            )}
          </Link>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-2 py-4">
          {getGruposNavegacao(usuario.perfil).map((grupo) => (
            <div key={grupo.id} className="space-y-1">
              {grupo.titulo && !recolhida && (
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60">{grupo.titulo}</p>
              )}
              {grupo.titulo && recolhida && <div className="mx-3 border-t border-sidebar-border" aria-hidden />}
              {grupo.itens.map((item) => (
                <LinkSidebar key={item.href} item={item} ativo={isRotaAtiva(pathname, item.href)} recolhida={recolhida} />
              ))}
            </div>
          ))}
        </nav>

        <div className="space-y-1 border-t border-sidebar-border p-2">
          <button
            type="button"
            onClick={onAlternar}
            className={cn(
              'flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm text-sidebar-foreground hover:bg-white/5 hover:text-white',
              recolhida && 'justify-center px-0',
            )}
            aria-label={recolhida ? 'Expandir menu' : 'Recolher menu'}
          >
            {recolhida ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
            {!recolhida && 'Recolher'}
          </button>
          <MenuConta variante="sidebar" recolhida={recolhida} />
        </div>
      </aside>
    </TooltipProvider>
  );
}
```

- [ ] **Step 4: `apps/web/src/components/layout/topbar.tsx`**

```tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { MenuConta } from './menu-conta';
import { HREF_NOVA_AUDITORIA } from './navegacao';

export function Topbar({ onAbrirBusca }: { onAbrirBusca: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur safe-top lg:px-8 print:hidden">
      <Link href="/admin/dashboard" className="md:hidden" aria-label="Início">
        <Image src="/images/logo-large.png" alt="ChekAI" width={104} height={24} className="h-6 w-auto" priority />
      </Link>

      <button
        type="button"
        onClick={onAbrirBusca}
        className="hidden h-9 w-full max-w-sm items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 md:flex"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Buscar telas e atalhos…</span>
        <kbd className="rounded border border-border bg-card px-1.5 text-[11px] font-medium">⌘K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-11 w-11 md:hidden" onClick={onAbrirBusca} aria-label="Buscar">
          <Search className="h-5 w-5" />
        </Button>
        <Button asChild className="hidden md:inline-flex">
          <Link href={HREF_NOVA_AUDITORIA}>
            <Plus className="h-4 w-4" />
            Nova auditoria
          </Link>
        </Button>
        <div className="md:hidden">
          <MenuConta variante="compacto" />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 5: `apps/web/src/components/layout/more-sheet.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/shadcn/drawer';
import { getItensMais } from './navegacao';

export function MoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { usuario, logout } = useAuthStore();
  if (!usuario) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[max(1rem,env(safe-area-inset-bottom))]">
        <DrawerHeader className="text-left">
          <DrawerTitle>Mais opções</DrawerTitle>
        </DrawerHeader>
        <div className="grid grid-cols-3 gap-2 px-4">
          {getItensMais(usuario.perfil).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => onOpenChange(false)}
              className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-lg p-2 text-center text-xs font-medium hover:bg-muted"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="h-5 w-5" />
              </span>
              {item.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.href = '/';
            }}
            className="flex min-h-[84px] flex-col items-center justify-center gap-2 rounded-lg p-2 text-xs font-medium text-destructive hover:bg-muted"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <LogOut className="h-5 w-5" />
            </span>
            Sair
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 6: `apps/web/src/components/layout/bottom-bar.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Plus } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/cn';
import { MoreSheet } from './more-sheet';
import { HREF_NOVA_AUDITORIA, getBarraInferior, getItensMais, isRotaAtiva } from './navegacao';

const classeAba = 'flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium';

export function BottomBar() {
  const pathname = usePathname();
  const { usuario } = useAuthStore();
  const [maisAberto, setMaisAberto] = useState(false);
  if (!usuario) return null;

  const [primeiro, segundo, terceiro] = getBarraInferior(usuario.perfil);
  const maisAtivo = getItensMais(usuario.perfil).some((i) => isRotaAtiva(pathname, i.href));

  const aba = (item: typeof primeiro) => {
    const ativo = isRotaAtiva(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={ativo ? 'page' : undefined}
        className={cn(classeAba, ativo ? 'text-primary' : 'text-muted-foreground')}
      >
        <item.icon className="h-6 w-6" />
        {item.label}
      </Link>
    );
  };

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
        aria-label="Navegação inferior"
      >
        {aba(primeiro)}
        {aba(segundo)}
        <div className="flex flex-1 justify-center">
          <Link
            href={HREF_NOVA_AUDITORIA}
            aria-label="Nova auditoria"
            className="-mt-5 mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95"
          >
            <Plus className="h-7 w-7" />
          </Link>
        </div>
        {aba(terceiro)}
        <button
          type="button"
          onClick={() => setMaisAberto(true)}
          className={cn(classeAba, maisAtivo ? 'text-primary' : 'text-muted-foreground')}
          aria-haspopup="dialog"
        >
          <LayoutGrid className="h-6 w-6" />
          Mais
        </button>
      </nav>
      <MoreSheet open={maisAberto} onOpenChange={setMaisAberto} />
    </>
  );
}
```

- [ ] **Step 7: `apps/web/src/components/layout/busca-global.tsx`**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/shadcn/command';
import { HREF_NOVA_AUDITORIA, getGruposNavegacao, getItensConta } from './navegacao';

export function BuscaGlobal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const { usuario } = useAuthStore();
  if (!usuario) return null;

  const ir = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar telas e atalhos…" />
      <CommandList>
        <CommandEmpty>Nada encontrado.</CommandEmpty>
        <CommandGroup heading="Atalhos">
          <CommandItem value="nova auditoria" onSelect={() => ir(HREF_NOVA_AUDITORIA)}>
            <Plus className="h-4 w-4" />
            Nova auditoria
          </CommandItem>
        </CommandGroup>
        {getGruposNavegacao(usuario.perfil).map((grupo) => (
          <CommandGroup key={grupo.id} heading={grupo.titulo ?? 'Geral'}>
            {grupo.itens.map((item) => (
              <CommandItem key={item.href} value={item.label} onSelect={() => ir(item.href)}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandGroup heading="Conta">
          {getItensConta(usuario.perfil).map((item) => (
            <CommandItem key={item.href} value={item.label} onSelect={() => ir(item.href)}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

Nota: o `cmdk` já filtra ignorando maiúsculas; acentos são cobertos porque o `value` é o próprio rótulo e o usuário tende a digitar o início da palavra. Se na verificação manual "relatorio" não achar "Relatórios técnicos", passar `filter={(value, search) => (normalizar(value).includes(normalizar(search)) ? 1 : 0)}` no `Command` usando `filtrarItensBusca` como referência.

- [ ] **Step 8: Verificar tipos**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/hooks/use-media-query.ts apps/web/src/components/layout/{menu-conta,sidebar,topbar,bottom-bar,more-sheet,busca-global}.tsx
git commit -m "Adicionar sidebar, barra superior, barra inferior, menu Mais e busca global

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: AppShell e troca do AppLayout

**Files:**
- Create: `apps/web/src/components/layout/app-shell.tsx`
- Modify: `apps/web/src/components/layout/app-layout.tsx` (bloco `return` final)
- Delete: `apps/web/src/components/layout/navbar.tsx`
- Modify: `apps/web/src/components/index.ts` (remover export `Navbar`)

**Interfaces:**
- Consumes: Task 5 (`Sidebar`, `Topbar`, `BottomBar`, `BuscaGlobal`), `CheckinFab`, `TutorialInstalacaoModal`.
- Produces: `AppShell({ children }: { children: React.ReactNode })`; `AppLayout` com a mesma assinatura de antes.

- [ ] **Step 1: Criar `apps/web/src/components/layout/app-shell.tsx`**

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { CheckinFab } from '@/components/checkin/checkin-fab';
import { TutorialInstalacaoModal } from '@/components/ui/tutorial-instalacao-modal';
import { BottomBar } from './bottom-bar';
import { BuscaGlobal } from './busca-global';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

const CHAVE_RECOLHIDA = 'chekai:sidebar-recolhida';

function lerPreferencia(): boolean {
  try {
    const salvo = window.localStorage.getItem(CHAVE_RECOLHIDA);
    if (salvo === 'true' || salvo === 'false') return salvo === 'true';
  } catch {
    // localStorage indisponível (modo privado): usa padrão por largura
  }
  return window.innerWidth < 1024;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [recolhida, setRecolhida] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);

  useEffect(() => {
    setRecolhida(lerPreferencia());
  }, []);

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setBuscaAberta((aberta) => !aberta);
      }
    };
    window.addEventListener('keydown', atalho);
    return () => window.removeEventListener('keydown', atalho);
  }, []);

  const alternar = useCallback(() => {
    setRecolhida((atual) => {
      const novo = !atual;
      try {
        window.localStorage.setItem(CHAVE_RECOLHIDA, String(novo));
      } catch {
        // preferência não persistida
      }
      return novo;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar recolhida={recolhida} onAlternar={alternar} />
      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200', recolhida ? 'md:pl-16' : 'md:pl-60')}>
        <Topbar onAbrirBusca={() => setBuscaAberta(true)} />
        <motion.main
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="flex-1 pb-24 md:pb-8"
        >
          {children}
        </motion.main>
      </div>
      <BottomBar />
      <BuscaGlobal open={buscaAberta} onOpenChange={setBuscaAberta} />
      <div className="print:hidden">
        <CheckinFab />
        <TutorialInstalacaoModal />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Trocar o `return` final de `app-layout.tsx`**

Substituir:

```tsx
  return (
    <div className="min-h-screen bg-base-200">
      <div className="print:hidden">
        <Navbar />
      </div>
      <main className="pb-20 md:pb-8">
        {children}
      </main>
      <div className="print:hidden">
        <CheckinFab />
        <TutorialInstalacaoModal />
      </div>
    </div>
  );
```

por:

```tsx
  return <AppShell>{children}</AppShell>;
```

E nos imports: remover `TutorialInstalacaoModal`, `CheckinFab` e `Navbar`; adicionar `import { AppShell } from './app-shell';`. Trocar `bg-base-200` do `LoadingScreen` por `bg-background`.

- [ ] **Step 3: Remover navbar antiga**

Run: `git rm apps/web/src/components/layout/navbar.tsx`
Em `apps/web/src/components/index.ts`, apagar a linha `export { Navbar } from './layout/navbar';`.

- [ ] **Step 4: Ajustar posição do botão de check-in acima da barra inferior**

Em `apps/web/src/components/checkin/checkin-fab.tsx:155`, trocar `bottom-24` por `bottom-[calc(5.5rem+env(safe-area-inset-bottom))]`.

- [ ] **Step 5: Verificar**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: sem erros; testes passam.

- [ ] **Step 6: Commit**

```bash
git add -A apps/web/src/components
git commit -m "Trocar navbar horizontal pelo novo shell com sidebar e barra inferior

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Componentes de página (PageHeader, StatCard, EmptyState, StatusChip, ResponsiveDialog)

**Files:**
- Modify: `apps/web/src/components/ui/page-header.tsx`
- Modify: `apps/web/src/components/ui/stat-card.tsx`
- Modify: `apps/web/src/components/ui/empty-state.tsx`
- Create: `apps/web/src/components/ui/status-chip.tsx`
- Test: `apps/web/src/components/ui/status-chip.test.ts`
- Create: `apps/web/src/components/ui/responsive-dialog.tsx`
- Modify: `apps/web/src/components/index.ts`

**Interfaces:**
- Consumes: Task 3 (`Button`, `Dialog*`, `Drawer*`), `useMediaQuery` (Task 5), `cn`.
- Produces:
  - `PageHeader({ title, subtitle?, backHref?, action? })` (mesma API)
  - `StatCard({ title, value, icon, color? })` (mesma API)
  - `EmptyState({ icon, title, description, actionLabel?, actionHref?, actionOnClick? })` (mesma API)
  - `type TomStatus = 'sucesso' | 'alerta' | 'perigo' | 'info' | 'neutro'`
  - `getTomStatus(status: string): TomStatus`
  - `StatusChip({ status, label?, className? }: { status: string; label?: string; className?: string })`
  - `ResponsiveDialog({ open, onOpenChange, title, description?, children, footer? })`

- [ ] **Step 1: Testes de `getTomStatus`**

```ts
import { describe, expect, it } from 'vitest';
import { getTomStatus, rotuloStatus } from './status-chip';

describe('getTomStatus', () => {
  it('mapeia status de sucesso, alerta, perigo e neutro', () => {
    expect(getTomStatus('conforme')).toBe('sucesso');
    expect(getTomStatus('finalizada')).toBe('sucesso');
    expect(getTomStatus('concluida')).toBe('sucesso');
    expect(getTomStatus('em_andamento')).toBe('alerta');
    expect(getTomStatus('pendente')).toBe('alerta');
    expect(getTomStatus('nao_conforme')).toBe('perigo');
    expect(getTomStatus('atrasada')).toBe('perigo');
    expect(getTomStatus('agendada')).toBe('info');
    expect(getTomStatus('nao_aplicavel')).toBe('neutro');
    expect(getTomStatus('cancelada')).toBe('neutro');
  });
  it('status desconhecido é neutro', () => {
    expect(getTomStatus('qualquer')).toBe('neutro');
  });
});

describe('rotuloStatus', () => {
  it('usa rótulo conhecido ou humaniza o valor', () => {
    expect(rotuloStatus('nao_conforme')).toBe('Não conforme');
    expect(rotuloStatus('outro_valor')).toBe('Outro valor');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run src/components/ui/status-chip.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: `apps/web/src/components/ui/status-chip.tsx`**

```tsx
import { cn } from '@/lib/cn';

export type TomStatus = 'sucesso' | 'alerta' | 'perigo' | 'info' | 'neutro';

const TONS: Record<string, TomStatus> = {
  conforme: 'sucesso',
  finalizada: 'sucesso',
  concluida: 'sucesso',
  realizada: 'sucesso',
  ativo: 'sucesso',
  em_andamento: 'alerta',
  pendente: 'alerta',
  rascunho: 'alerta',
  nao_conforme: 'perigo',
  atrasada: 'perigo',
  agendada: 'info',
  nao_aplicavel: 'neutro',
  nao_avaliado: 'neutro',
  cancelada: 'neutro',
  inativo: 'neutro',
};

const ROTULOS: Record<string, string> = {
  conforme: 'Conforme',
  nao_conforme: 'Não conforme',
  nao_aplicavel: 'N/A',
  nao_avaliado: 'Não avaliado',
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
  cancelada: 'Cancelada',
  pendente: 'Pendente',
  concluida: 'Concluída',
  atrasada: 'Atrasada',
  agendada: 'Agendada',
  realizada: 'Realizada',
  rascunho: 'Rascunho',
  ativo: 'Ativo',
  inativo: 'Inativo',
};

const CLASSES: Record<TomStatus, string> = {
  sucesso: 'bg-success/12 text-[hsl(160_84%_28%)]',
  alerta: 'bg-warning/15 text-[hsl(32_95%_34%)]',
  perigo: 'bg-destructive/12 text-[hsl(0_72%_45%)]',
  info: 'bg-info/12 text-[hsl(217_80%_45%)]',
  neutro: 'bg-muted text-muted-foreground',
};

export function getTomStatus(status: string): TomStatus {
  return TONS[status] ?? 'neutro';
}

export function rotuloStatus(status: string): string {
  if (ROTULOS[status]) return ROTULOS[status];
  const texto = status.replace(/_/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function StatusChip({ status, label, className }: { status: string; label?: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold',
        CLASSES[getTomStatus(status)],
        className,
      )}
    >
      {label ?? rotuloStatus(status)}
    </span>
  );
}
```

E em `tailwind.config.ts`, dentro de `theme.extend`, adicionar `opacity: { 12: '0.12' },` para `bg-success/12` existir.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run src/components/ui/status-chip.test.ts`
Expected: PASS.

- [ ] **Step 5: Reescrever `apps/web/src/components/ui/page-header.tsx`**

```tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, backHref, action }: PageHeaderProps) {
  return (
    <div className="sticky top-14 z-20 border-b border-border bg-background/95 px-4 py-4 backdrop-blur lg:px-8">
      <div className="flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Voltar"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:h-9 md:w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-semibold tracking-tight md:text-2xl">{title}</h1>
          {subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Reescrever `apps/web/src/components/ui/stat-card.tsx`**

```tsx
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'primary' | 'secondary' | 'accent' | 'info' | 'success' | 'warning' | 'error';
}

const CORES: Record<NonNullable<StatCardProps['color']>, string> = {
  primary: 'bg-primary/10 text-primary',
  secondary: 'bg-info/10 text-info',
  accent: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  error: 'bg-destructive/10 text-destructive',
};

export function StatCard({ title, value, icon: Icon, color = 'primary' }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md', CORES[color])}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs text-muted-foreground">{title}</p>
        <p className="font-display text-2xl font-semibold leading-tight">{value}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Reescrever `apps/web/src/components/ui/empty-state.tsx`**

```tsx
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  actionOnClick?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, actionHref, actionOnClick }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <Icon className="h-7 w-7 text-muted-foreground" />
      </span>
      <h3 className="font-display text-base font-semibold">{title}</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">{description}</p>
      {actionLabel && actionHref && (
        <Button asChild size="sm" className="mt-4">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
      {actionLabel && !actionHref && actionOnClick && (
        <Button size="sm" className="mt-4" onClick={actionOnClick}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 8: `apps/web/src/components/ui/responsive-dialog.tsx`**

```tsx
'use client';

import { useMediaQuery } from '@/hooks/use-media-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/shadcn/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/shadcn/drawer';

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Dialog centralizado no desktop e folha inferior no mobile, com cabeçalho e rodapé fixos e conteúdo rolável. */
export function ResponsiveDialog({ open, onOpenChange, title, description, children, footer }: ResponsiveDialogProps) {
  const desktop = useMediaQuery('(min-width: 768px)');

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b border-border px-6 py-4">
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && <DialogFooter className="border-t border-border px-6 py-4">{footer}</DialogFooter>}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex max-h-[92vh] flex-col">
        <DrawerHeader className="border-b border-border text-left">
          <DrawerTitle>{title}</DrawerTitle>
          {description && <DrawerDescription>{description}</DrawerDescription>}
        </DrawerHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer && (
          <DrawerFooter className="flex-row justify-end gap-2 border-t border-border pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}
```

- [ ] **Step 9: Exportar em `apps/web/src/components/index.ts`** (após `EmptyState`)

```ts
export { StatusChip, getTomStatus, rotuloStatus } from './ui/status-chip';
export type { TomStatus } from './ui/status-chip';
export { ResponsiveDialog } from './ui/responsive-dialog';
```

- [ ] **Step 10: Verificar**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: sem erros; todos os testes passam.

- [ ] **Step 11: Commit**

```bash
git add apps/web/src/components/ui apps/web/src/components/index.ts apps/web/tailwind.config.ts
git commit -m "Atualizar cabeçalho, cards e estado vazio; adicionar StatusChip e ResponsiveDialog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verificação no ambiente local, AGENTS.md e build

**Files:**
- Modify: `AGENTS.md` (preferência de design system)

**Interfaces:**
- Consumes: tudo das tasks anteriores.

- [ ] **Step 1: Atualizar `AGENTS.md`**

Na primeira linha de "Learned User Preferences", trocar `alinhar implementação ao design system DaisyUI e regras NestJS/TS do projeto` por `alinhar implementação ao design system shadcn/ui + Radix com os tokens da marca (DaisyUI em remoção gradual; ver docs/superpowers/specs/2026-10-17-reestruturacao-visual-web-design.md) e às regras NestJS/TS do projeto`.

- [ ] **Step 2: Build de produção**

Run: `cd apps/web && npx next build`
Expected: build conclui sem erros de tipo/lint bloqueantes.

- [ ] **Step 3: Subir API e web locais**

Run (em background): `cd /Users/yuricarvalho/Projetos/evobit/meta-app && npm run dev:api` e `npm run dev:web`
Expected: API em `http://localhost:3001/api`, web em `http://localhost:3031`.

- [ ] **Step 4: Verificação manual (Chrome) — desktop 1440px e mobile 375px, nos perfis GESTOR e AUDITOR (e MASTER se houver conta)**

Checklist:
- Sidebar navy mostra exatamente os grupos/itens da tabela da spec para o perfil; item ativo com barra teal; recolher/expandir persiste após recarregar.
- `/admin/auditoria/<id>` marca "Auditorias"; `/admin/auditoria/nova` não marca nada além do botão.
- ⌘K abre a busca; digitar "relatorio" encontra "Relatórios técnicos"; Enter navega.
- Mobile: barra inferior com 3 abas + botão central + "Mais"; "Mais" abre folha com os demais itens e "Sair"; nenhum conteúdo escondido sob a barra (rolar até o fim de `/admin/auditorias`).
- `PageHeader` gruda logo abaixo da barra superior, sem sobreposição.
- Telas antigas (clientes, templates, auditoria) continuam funcionais e com as cores da marca.
- Botão de check-in não cobre o botão central nem a barra inferior.
- Impressão do dashboard (`window.print`) não mostra sidebar, barras ou botão de check-in.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md
git commit -m "Atualizar preferência de design system para shadcn/ui no AGENTS.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Validar com o usuário e publicar**

Pedir validação do usuário no ambiente local. Após o "ok": `git push origin master` e acompanhar `railway logs --service @meta-app/web`.

---

## Self-review (feito)

- Cobertura da spec (seções 4 e 5): tokens ✔ (T2), shadcn isolado ✔ (T3), convivência DaisyUI ✔ (T2/T3 constraints), componentes base ✔ (T3), componentes ChekAI ✔ (T5–T7), sidebar/topbar/bottom bar/Mais/⌘K ✔ (T5–T6), menu por perfil e renomeações ✔ (T4), tablet recolhida ✔ (T6 `lerPreferencia`), transição 150ms ✔ (T6), check-in oculto em impressão ✔ (T6). Itens da spec atribuídos a E2+: busca de entidades no ⌘K, check-in como item do Início/topbar (no E1 o botão flutuante é mantido e reposicionado), skeletons nas telas.
- Placeholders: nenhum.
- Tipos: `ItemNavegacao`, `getBarraInferior`, `getItensMais`, `isRotaAtiva`, `HREF_NOVA_AUDITORIA` usados com os mesmos nomes em T4–T6; `useMediaQuery` definido em T5 e usado em T7.

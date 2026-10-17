# Reestruturação visual — E4 Migração total e remoção do DaisyUI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar todas as telas restantes (cadastros, editor de checklists, administração, Legislações, relatório técnico e páginas públicas) para os tokens/primitivas da E1 e remover o DaisyUI do projeto; reorganizar clientes em abas e levar Legislações para o layout padrão.

**Architecture:** Um conversor puro e testado (`converterClasses`) traduz classes DaisyUI em utilitários Tailwind com os tokens da marca; um migrador (`migrarConteudo`) aplica o conversor somente dentro de `className=` e de chamadas `cn(`/`clsx(`. Um teste-guarda varre `src/` e falha enquanto houver classes DaisyUI — ele é o critério de "pronto" da etapa. Componentes com comportamento próprio do DaisyUI (dropdown, collapse, tooltip, modal) são migrados à mão. Depois o plugin é removido.

**Tech Stack:** Next.js 15, Tailwind 3.4, shadcn/ui, Vitest 2, tsx (para rodar o migrador).

**Spec:** `docs/superpowers/specs/2026-10-17-reestruturacao-visual-web-design.md` (seções 3, 4 e 8). Decisão do usuário (2026-10-17): migrar também as páginas públicas e remover o DaisyUI por completo.

## Global Constraints

- Mesmas das etapas anteriores (tokens, raio, sombras, tipografia, toque ≥44px no mobile, pt-BR sóbrio).
- Páginas públicas: só troca de classes, sem redesenho (decisão do usuário).
- Nenhuma regra de negócio ou chamada de API muda.
- `secondary` → `info`, `accent` → `warning`, `neutral` → `sidebar`, `error` → `destructive` (DaisyUI deixa de definir essas cores).
- Commits em pt-BR terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Botão com tamanho/variante em literal separado (`${cond ? 'btn-primary' : 'btn-ghost'}`) — a variante precisa vencer o padrão; testado em `converterClasses` (modificadores avulsos usam `!`).
2. `card-body` com padding próprio (`card-body p-4`) — não pode receber um segundo padding que vença; testado.
3. Aba ativa e checkbox/toggle no mesmo literal da base — sem utilitários conflitantes; testado.
4. Texto que não é classe dentro de `className={...}` (comparações como `status === 'error'`) — não pode ser alterado; testado em `migrarConteudo`.
5. Classes DaisyUI fora de `className` (mapas de estilo em objetos) — o teste-guarda aponta e elas são corrigidas à mão no Task 4.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/web/scripts/daisyui/converter-classes.ts` (novo) + teste | Tradução de tokens DaisyUI |
| `apps/web/scripts/daisyui/migrar-conteudo.ts` (novo) + teste | Aplica a tradução em `className`/`cn`/`clsx` |
| `apps/web/scripts/daisyui/migrar.ts` (novo) | CLI: migra arquivos passados por argumento |
| `apps/web/src/guarda/sem-daisyui.test.ts` (novo) | Falha enquanto existir classe DaisyUI em `src/` |
| `apps/web/vitest.config.ts` | Incluir `scripts/**/*.test.ts` |
| `apps/web/src/app/**`, `apps/web/src/components/**` | Migração |
| `apps/web/src/app/admin/clientes/page.tsx` | Edição de cliente em abas |
| `apps/web/src/app/admin/legislacoes/**` | `AppLayout` + padrão visual |
| `apps/web/tailwind.config.ts`, `apps/web/package.json`, `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx` | Remoção do DaisyUI |

---

### Task 1: Conversor de classes (TDD)

**Files:**
- Create: `apps/web/scripts/daisyui/converter-classes.ts`
- Test: `apps/web/scripts/daisyui/converter-classes.test.ts`
- Modify: `apps/web/vitest.config.ts` (`include: ['src/**/*.test.ts', 'scripts/**/*.test.ts']`)

**Interfaces:**
- Produces: `converterClasses(classes: string): string` — recebe uma lista de classes separadas por espaço (pode conter `${…}` opacos) e devolve a lista traduzida, preservando espaçamento simples e a ordem; tokens desconhecidos ficam como estão.

- [ ] **Step 1: Testes**

```ts
import { describe, expect, it } from 'vitest';
import { converterClasses as c } from './converter-classes';

const tem = (saida: string, ...classes: string[]) => classes.every((x) => saida.split(/\s+/).includes(x));
const naoTem = (saida: string, ...classes: string[]) => classes.every((x) => !saida.split(/\s+/).includes(x));

describe('botões', () => {
  it('base + variante + tamanho no mesmo literal', () => {
    const s = c('btn btn-primary btn-sm gap-2');
    expect(tem(s, 'inline-flex', 'bg-primary', 'text-primary-foreground', 'h-9', 'px-3', 'gap-2')).toBe(true);
    expect(naoTem(s, 'btn', 'btn-primary', 'btn-sm', 'h-10', 'px-4')).toBe(true);
  });
  it('quadrado e círculo', () => {
    expect(tem(c('btn btn-ghost btn-sm btn-square'), 'h-9', 'w-9', 'px-0')).toBe(true);
    expect(tem(c('btn btn-circle btn-xs'), 'h-7', 'w-7', 'rounded-full')).toBe(true);
  });
  it('outline colorido', () => {
    const s = c('btn btn-outline btn-primary');
    expect(tem(s, 'border', 'border-primary', 'text-primary')).toBe(true);
    expect(naoTem(s, 'bg-primary')).toBe(true);
  });
  it('sem variante usa fundo neutro', () => {
    expect(tem(c('btn'), 'bg-muted')).toBe(true);
  });
  it('modificador avulso vence com !important', () => {
    expect(tem(c('btn-primary'), '!bg-primary', '!text-primary-foreground')).toBe(true);
    expect(tem(c('btn-sm'), '!h-9', '!px-3')).toBe(true);
  });
});

describe('badges', () => {
  it('base + cor + tamanho', () => {
    const s = c('badge badge-success badge-sm');
    expect(tem(s, 'rounded-full', 'bg-success/12', 'text-[11px]')).toBe(true);
    expect(naoTem(s, 'badge', 'badge-success', 'badge-sm', 'text-xs')).toBe(true);
  });
  it('prefixo responsivo em modificador', () => {
    expect(tem(c('sm:badge-lg'), 'sm:!text-sm')).toBe(true);
  });
});

describe('formulários', () => {
  it('input e select com borda e tamanho', () => {
    const s = c('input input-bordered input-sm w-full');
    expect(tem(s, 'h-9', 'rounded-md', 'border', 'border-input', 'bg-card', 'w-full')).toBe(true);
    expect(naoTem(s, 'input', 'input-bordered', 'input-sm', 'h-10')).toBe(true);
    expect(tem(c('select select-bordered'), 'h-10', 'border-input')).toBe(true);
  });
  it('textarea com erro', () => {
    expect(tem(c('textarea textarea-bordered textarea-error'), 'border-destructive')).toBe(true);
  });
  it('form-control, label e label-text', () => {
    expect(c('form-control')).toBe('flex flex-col');
    expect(tem(c('label'), 'flex', 'justify-between')).toBe(true);
    expect(tem(c('label-text'), 'text-sm', 'font-medium')).toBe(true);
    expect(tem(c('label-text-alt'), 'text-xs', 'text-muted-foreground')).toBe(true);
  });
  it('checkbox e toggle', () => {
    expect(tem(c('checkbox checkbox-primary checkbox-sm'), 'accent-[hsl(175_100%_36%)]', 'h-3.5', 'w-3.5')).toBe(true);
    const t = c('toggle toggle-sm');
    expect(tem(t, 'appearance-none', 'h-4', 'w-7')).toBe(true);
    expect(naoTem(t, 'h-5', 'w-9')).toBe(true);
  });
});

describe('cards', () => {
  it('card-body ganha padding só se não houver', () => {
    expect(tem(c('card-body'), 'p-6')).toBe(true);
    const s = c('card-body p-4');
    expect(tem(s, 'p-4')).toBe(true);
    expect(naoTem(s, 'p-6')).toBe(true);
    expect(naoTem(c('card-body px-4 py-3'), 'p-6')).toBe(true);
  });
  it('card e card-title', () => {
    expect(tem(c('card bg-base-100'), 'rounded-lg', 'bg-card')).toBe(true);
    expect(tem(c('card-title'), 'font-semibold')).toBe(true);
  });
});

describe('abas, alerta, loading, tabela, progresso', () => {
  it('aba ativa no mesmo literal não mantém cor conflitante', () => {
    const s = c('tab tab-active');
    expect(tem(s, 'border-primary', 'text-foreground')).toBe(true);
    expect(naoTem(s, 'border-transparent', 'text-muted-foreground')).toBe(true);
    expect(tem(c('tab-active'), '!border-primary')).toBe(true);
  });
  it('alerta por variante', () => {
    expect(tem(c('alert alert-warning'), 'bg-warning/15', 'rounded-md')).toBe(true);
    expect(tem(c('alert alert-error'), 'text-destructive')).toBe(true);
  });
  it('loading por tamanho', () => {
    const s = c('loading loading-spinner loading-lg text-primary');
    expect(tem(s, 'animate-spin', 'h-8', 'w-8', 'text-primary')).toBe(true);
    expect(naoTem(s, 'h-5')).toBe(true);
  });
  it('tabela zebrada', () => {
    expect(tem(c('table table-zebra'), 'w-full', '[&_tbody_tr:nth-child(even)]:bg-muted/40')).toBe(true);
  });
  it('progress com cor', () => {
    expect(tem(c('progress progress-primary w-full'), '[&::-webkit-progress-value]:bg-primary', 'w-full')).toBe(true);
  });
});

describe('cores', () => {
  it('base e conteúdo', () => {
    expect(c('bg-base-100')).toBe('bg-card');
    expect(c('bg-base-200/50')).toBe('bg-muted/50');
    expect(c('border-base-300')).toBe('border-border');
    expect(c('text-base-content')).toBe('text-foreground');
    expect(c('text-base-content/60')).toBe('text-muted-foreground');
    expect(c('text-base-content/80')).toBe('text-foreground/80');
    expect(c('text-base-content/40')).toBe('text-muted-foreground/70');
    expect(c('hover:bg-base-200')).toBe('hover:bg-muted');
  });
  it('cores removidas do tema', () => {
    expect(c('text-secondary')).toBe('text-info');
    expect(c('bg-secondary/10')).toBe('bg-info/10');
    expect(c('text-error')).toBe('text-destructive');
    expect(c('hover:text-error')).toBe('hover:text-destructive');
    expect(c('text-primary-content')).toBe('text-primary-foreground');
    expect(c('text-error-content')).toBe('text-destructive-foreground');
    expect(c('bg-accent/10')).toBe('bg-warning/10');
    expect(c('from-base-100')).toBe('from-card');
  });
});

describe('preservação', () => {
  it('mantém tokens desconhecidos e interpolações', () => {
    expect(c('flex gap-2 ${ativo ? "x" : ""} mt-4')).toBe('flex gap-2 ${ativo ? "x" : ""} mt-4');
  });
  it('remove modificadores sem efeito', () => {
    expect(c('input-bordered')).toBe('');
    expect(c('select-bordered')).toBe('');
    expect(c('loading-spinner')).toBe('');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run scripts/daisyui/converter-classes.test.ts`
Expected: FAIL — módulo não encontrado (após ajustar o `include` do vitest).

- [ ] **Step 3: Implementar `converter-classes.ts`**

```ts
/**
 * Traduz classes DaisyUI para utilitários Tailwind com os tokens da marca (E1).
 * Regras de grupo (btn, badge, input…) só se aplicam quando a base está no mesmo literal;
 * modificadores avulsos (em outro literal/ternário) saem com "!" para vencer o padrão.
 */

const ACENTO = 'accent-[hsl(175_100%_36%)]';

const CORES_BOTAO: Record<string, string> = {
  primary: 'primary',
  secondary: 'info',
  accent: 'warning',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'destructive',
  neutral: 'sidebar',
};

const BTN_BASE = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50';
const BTN_TAMANHO: Record<string, string> = { xs: 'h-7 px-2 text-xs', sm: 'h-9 px-3', md: 'h-10 px-4', lg: 'h-11 px-6 text-base' };
const BTN_QUADRADO: Record<string, string> = { xs: 'h-7 w-7 px-0', sm: 'h-9 w-9 px-0', md: 'h-10 w-10 px-0', lg: 'h-11 w-11 px-0' };

function corBotao(cor: string): string {
  if (cor === 'primary') return 'bg-primary text-primary-foreground hover:bg-primary/90';
  if (cor === 'destructive') return 'bg-destructive text-destructive-foreground hover:bg-destructive/90';
  return `bg-${cor} text-white hover:bg-${cor}/90`;
}

const BADGE_BASE = 'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold';
const BADGE_TAMANHO: Record<string, string> = { xs: 'px-1.5 py-0 text-[10px]', sm: 'px-2 py-0.5 text-[11px]', md: 'px-2.5 py-0.5 text-xs', lg: 'px-3 py-1 text-sm' };
const BADGE_COR: Record<string, string> = {
  primary: 'bg-primary/12 text-primary',
  secondary: 'bg-info/12 text-[hsl(217_80%_45%)]',
  info: 'bg-info/12 text-[hsl(217_80%_45%)]',
  accent: 'bg-warning/15 text-[hsl(32_95%_34%)]',
  warning: 'bg-warning/15 text-[hsl(32_95%_34%)]',
  success: 'bg-success/12 text-[hsl(160_84%_28%)]',
  error: 'bg-destructive/12 text-[hsl(0_72%_45%)]',
  neutral: 'bg-sidebar text-white',
  ghost: 'bg-muted text-muted-foreground',
  outline: 'border border-border bg-transparent',
};

const CAMPO = 'rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60';
const CAMPO_TAMANHO: Record<string, string> = { xs: 'h-7 px-2 text-xs', sm: 'h-9 px-2.5 text-xs', md: 'h-10 px-3', lg: 'h-11 px-4 text-base' };

const LOADING_TAMANHO: Record<string, string> = { xs: 'h-3 w-3', sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-8 w-8' };
const LOADING_BASE = 'inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent';

const TOGGLE_TAMANHO: Record<string, string> = {
  xs: 'h-3.5 w-6 before:h-2.5 before:w-2.5 checked:before:translate-x-2.5',
  sm: 'h-4 w-7 before:h-3 before:w-3 checked:before:translate-x-3',
  md: 'h-5 w-9 before:h-4 before:w-4 checked:before:translate-x-4',
  lg: 'h-6 w-11 before:h-5 before:w-5 checked:before:translate-x-5',
};
const TOGGLE_BASE = 'relative shrink-0 cursor-pointer appearance-none rounded-full bg-muted-foreground/30 transition-colors checked:bg-primary before:absolute before:left-0.5 before:top-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform disabled:opacity-50';

const CHECK_TAMANHO: Record<string, string> = { xs: 'h-3 w-3', sm: 'h-3.5 w-3.5', md: 'h-4 w-4', lg: 'h-5 w-5' };

const TABELA_TAMANHO: Record<string, string> = {
  xs: 'text-xs [&_th]:px-2 [&_th]:py-1.5 [&_td]:px-2 [&_td]:py-1.5',
  sm: 'text-sm [&_th]:px-3 [&_th]:py-2 [&_td]:px-3 [&_td]:py-2',
  md: 'text-sm [&_th]:px-4 [&_th]:py-3 [&_td]:px-4 [&_td]:py-3',
  lg: 'text-base [&_th]:px-6 [&_th]:py-4 [&_td]:px-6 [&_td]:py-4',
};
const TABELA_BASE = 'w-full text-left [&_th]:text-xs [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted-foreground [&_tr]:border-b [&_tr]:border-border';

const ALERTA_COR: Record<string, string> = {
  info: 'border-info/30 bg-info/10',
  success: 'border-success/30 bg-success/10',
  warning: 'border-warning/40 bg-warning/15',
  error: 'border-destructive/30 bg-destructive/10 text-destructive',
};

const PROGRESSO_COR: Record<string, string> = {
  primary: 'primary',
  secondary: 'info',
  accent: 'warning',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'destructive',
};
const progresso = (cor: string) =>
  `[&::-webkit-progress-value]:bg-${cor} [&::-moz-progress-bar]:bg-${cor}`;
const PROGRESSO_BASE = 'h-2 w-full appearance-none overflow-hidden rounded-full bg-muted [&::-webkit-progress-bar]:bg-muted';

/** Classes simples, sem regras de grupo. Valor vazio = remover. */
const SIMPLES: Record<string, string> = {
  'form-control': 'flex flex-col',
  label: 'flex items-center justify-between gap-2 py-1',
  'label-text': 'text-sm font-medium text-foreground',
  'label-text-alt': 'text-xs text-muted-foreground',
  card: 'relative flex flex-col rounded-lg border border-border bg-card',
  'card-title': 'flex items-center gap-2 font-display text-lg font-semibold',
  'card-actions': 'flex flex-wrap items-start justify-end gap-2',
  'card-compact': '',
  'card-bordered': '',
  'input-bordered': '',
  'select-bordered': '',
  'textarea-bordered': '',
  'input-ghost': 'border-transparent bg-transparent',
  'input-group': 'flex items-stretch',
  'loading-spinner': '',
  'loading-dots': '',
  'loading-ring': '',
  tabs: 'flex items-center gap-1 border-b border-border',
  'tabs-bordered': '',
  'tabs-lifted': '',
  'tabs-boxed': '',
  steps: 'flex w-full gap-2',
  step: 'flex-1 text-center text-xs text-muted-foreground',
  'step-primary': '!font-semibold !text-primary',
  join: 'inline-flex items-stretch [&>*]:rounded-none [&>*:first-child]:rounded-l-md [&>*:last-child]:rounded-r-md',
  'join-item': '',
  divider: 'my-4 flex items-center gap-4 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border',
  stats: 'grid rounded-lg border border-border bg-card',
  stat: 'flex flex-col gap-1 p-4',
  'stat-title': 'text-sm text-muted-foreground',
  'stat-value': 'font-display text-3xl font-semibold',
  'stat-desc': 'text-xs text-muted-foreground',
  'stat-figure': 'float-right',
  'table-zebra': '[&_tbody_tr:nth-child(even)]:bg-muted/40',
  kbd: 'rounded border border-border bg-muted px-1.5 text-[11px] font-medium',
  link: 'cursor-pointer underline underline-offset-2',
  'link-primary': 'text-primary',
  'link-hover': 'no-underline hover:underline',
  'rounded-box': 'rounded-lg',
  avatar: 'relative inline-flex',
  placeholder: '[&>div]:flex [&>div]:items-center [&>div]:justify-center',
  radio: `h-4 w-4 cursor-pointer ${ACENTO}`,
  range: `w-full cursor-pointer ${ACENTO}`,
  'range-sm': '',
  'range-xs': '',
  'btn-block': 'w-full',
  'btn-wide': 'w-64',
  'btn-disabled': 'pointer-events-none opacity-50',
  'btn-active': 'bg-muted',
  'btn-link': 'text-primary underline-offset-4 hover:underline',
};

const PREFIXO = /^((?:[a-z0-9-]+:|\[[^\]]+\]:)*)(.*)$/;

function prefixar(prefixo: string, classes: string): string {
  if (!prefixo) return classes;
  return classes
    .split(/\s+/)
    .filter(Boolean)
    .map((cl) => (cl.startsWith('!') ? `${prefixo}!${cl.slice(1)}` : `${prefixo}${cl}`))
    .join(' ');
}

const importante = (classes: string) =>
  classes
    .split(/\s+/)
    .filter(Boolean)
    .map((cl) => {
      const idx = cl.lastIndexOf(':');
      if (idx < 0) return `!${cl}`;
      return `${cl.slice(0, idx + 1)}!${cl.slice(idx + 1)}`;
    })
    .join(' ');

function converterCor(core: string): string | null {
  const m = core.match(/^([a-z]+(?:-[a-z]+)?)-(base-100|base-200|base-300|base-content|primary-content|secondary-content|accent-content|neutral-content|error-content|success-content|warning-content|info-content|secondary|accent|neutral|error)(\/\d+)?$/);
  if (!m) return null;
  const [, prop, cor, alfa = ''] = m;
  const propsValidas = ['bg', 'text', 'border', 'ring', 'from', 'to', 'via', 'fill', 'stroke', 'outline', 'divide', 'placeholder', 'shadow', 'border-t', 'border-b', 'border-l', 'border-r', 'ring-offset', 'decoration', 'caret', 'accent'];
  if (!propsValidas.includes(prop)) return null;
  if (cor === 'base-content') {
    if (prop === 'text' && alfa) {
      const n = Number(alfa.slice(1));
      if (n >= 75) return `text-foreground${alfa}`;
      if (n >= 50) return 'text-muted-foreground';
      if (n >= 40) return 'text-muted-foreground/70';
      if (n >= 30) return 'text-muted-foreground/50';
      return 'text-muted-foreground/40';
    }
    return `${prop}-foreground${alfa}`;
  }
  const mapa: Record<string, string> = {
    'base-100': 'card',
    'base-200': 'muted',
    'base-300': prop === 'bg' ? 'border' : 'border',
    'primary-content': 'primary-foreground',
    'error-content': 'destructive-foreground',
    'secondary-content': 'white',
    'accent-content': 'white',
    'neutral-content': 'white',
    'success-content': 'white',
    'warning-content': 'white',
    'info-content': 'white',
    secondary: 'info',
    accent: 'warning',
    neutral: 'sidebar',
    error: 'destructive',
  };
  const destino = mapa[cor];
  return `${prop}-${destino}${destino === 'white' ? '' : alfa}`;
}

const tamanhoDe = (tokens: string[], base: string) => {
  for (const t of ['xs', 'sm', 'md', 'lg']) if (tokens.includes(`${base}-${t}`)) return t;
  return 'md';
};
const temPadding = (tokens: string[]) => tokens.some((t) => /^(p|px|py|pt|pb|pl|pr)-/.test(t));

export function converterClasses(classes: string): string {
  if (!classes.trim()) return classes;
  // Interpolações ${...} viram tokens opacos (podem conter espaços)
  const partes = classes.match(/\$\{[^}]*\}|\S+/g) ?? [];
  const tokens = partes;
  const nus = tokens.filter((t) => !t.startsWith('${') && !t.includes(':'));
  const consumidos = new Set<string>();
  const saida: string[] = [];

  const consumir = (...ts: string[]) => ts.forEach((t) => consumidos.add(t));

  // Grupos com base presente no mesmo literal
  if (nus.includes('btn')) {
    const tam = tamanhoDe(nus, 'btn');
    const quadrado = nus.includes('btn-square') || nus.includes('btn-circle');
    const outline = nus.includes('btn-outline');
    const ghost = nus.includes('btn-ghost');
    const corKey = Object.keys(CORES_BOTAO).find((k) => nus.includes(`btn-${k}`));
    let variante = 'bg-muted text-foreground hover:bg-muted/80';
    if (ghost) variante = 'hover:bg-muted';
    if (corKey) variante = corBotao(CORES_BOTAO[corKey]);
    if (outline) variante = corKey ? `border border-${CORES_BOTAO[corKey]} bg-transparent text-${CORES_BOTAO[corKey]} hover:bg-${CORES_BOTAO[corKey]} hover:text-white` : 'border border-input bg-card hover:bg-muted';
    const forma = quadrado ? `${BTN_QUADRADO[tam]}${nus.includes('btn-circle') ? ' rounded-full' : ''}` : BTN_TAMANHO[tam];
    saida.push(`${BTN_BASE} ${forma} ${variante}`);
    consumir('btn', 'btn-xs', 'btn-sm', 'btn-md', 'btn-lg', 'btn-square', 'btn-circle', 'btn-outline', 'btn-ghost', ...Object.keys(CORES_BOTAO).map((k) => `btn-${k}`));
  }
  if (nus.includes('badge')) {
    const tam = tamanhoDe(nus, 'badge');
    const cores = Object.keys(BADGE_COR).filter((k) => nus.includes(`badge-${k}`));
    const cor = cores.length ? cores.map((k) => BADGE_COR[k]).join(' ') : 'bg-muted text-foreground';
    saida.push(`${BADGE_BASE} ${BADGE_TAMANHO[tam]} ${cor}`);
    consumir('badge', 'badge-xs', 'badge-sm', 'badge-md', 'badge-lg', ...Object.keys(BADGE_COR).map((k) => `badge-${k}`));
  }
  for (const campo of ['input', 'select'] as const) {
    if (nus.includes(campo)) {
      const tam = tamanhoDe(nus, campo);
      const erro = nus.includes(`${campo}-error`) ? ' border-destructive' : '';
      saida.push(`${CAMPO} ${CAMPO_TAMANHO[tam]}${erro}`.replace('border-input border-destructive', 'border-destructive'));
      consumir(campo, `${campo}-xs`, `${campo}-sm`, `${campo}-md`, `${campo}-lg`, `${campo}-error`, `${campo}-primary`);
    }
  }
  if (nus.includes('textarea')) {
    const erro = nus.includes('textarea-error');
    saida.push(`min-h-[80px] px-3 py-2 ${CAMPO}${erro ? ' border-destructive' : ''}`);
    consumir('textarea', 'textarea-xs', 'textarea-sm', 'textarea-md', 'textarea-lg', 'textarea-error', 'textarea-primary');
  }
  if (nus.includes('card-body')) {
    saida.push(`flex flex-1 flex-col gap-2${temPadding(nus) ? '' : ' p-6'}`);
    consumir('card-body');
  }
  if (nus.includes('loading')) {
    saida.push(`${LOADING_BASE} ${LOADING_TAMANHO[tamanhoDe(nus, 'loading')]}`);
    consumir('loading', 'loading-xs', 'loading-sm', 'loading-md', 'loading-lg');
  }
  if (nus.includes('checkbox')) {
    saida.push(`${CHECK_TAMANHO[tamanhoDe(nus, 'checkbox')]} shrink-0 cursor-pointer rounded border-input ${ACENTO}`);
    consumir('checkbox', 'checkbox-xs', 'checkbox-sm', 'checkbox-md', 'checkbox-lg', ...Object.keys(BADGE_COR).map((k) => `checkbox-${k}`));
  }
  if (nus.includes('toggle')) {
    saida.push(`${TOGGLE_BASE} ${TOGGLE_TAMANHO[tamanhoDe(nus, 'toggle')]}`);
    consumir('toggle', 'toggle-xs', 'toggle-sm', 'toggle-md', 'toggle-lg', ...Object.keys(BADGE_COR).map((k) => `toggle-${k}`));
  }
  if (nus.includes('table')) {
    saida.push(`${TABELA_BASE} ${TABELA_TAMANHO[tamanhoDe(nus, 'table')]}`);
    consumir('table', 'table-xs', 'table-sm', 'table-md', 'table-lg');
  }
  if (nus.includes('tab')) {
    const ativa = nus.includes('tab-active');
    saida.push(
      ativa
        ? '-mb-px inline-flex h-10 cursor-pointer items-center gap-2 border-b-2 border-primary px-3 text-sm font-medium text-foreground'
        : '-mb-px inline-flex h-10 cursor-pointer items-center gap-2 border-b-2 border-transparent px-3 text-sm text-muted-foreground hover:text-foreground',
    );
    consumir('tab', 'tab-active', 'tab-bordered', 'tab-lifted');
  }
  if (nus.includes('alert')) {
    const corKey = Object.keys(ALERTA_COR).find((k) => nus.includes(`alert-${k}`));
    saida.push(`flex w-full items-start gap-3 rounded-md border p-4 text-sm ${corKey ? ALERTA_COR[corKey] : 'border-border bg-muted'}`);
    consumir('alert', ...Object.keys(ALERTA_COR).map((k) => `alert-${k}`));
  }
  if (nus.includes('progress')) {
    const corKey = Object.keys(PROGRESSO_COR).find((k) => nus.includes(`progress-${k}`));
    saida.push(`${PROGRESSO_BASE} ${progresso(corKey ? PROGRESSO_COR[corKey] : 'primary')}`);
    consumir('progress', ...Object.keys(PROGRESSO_COR).map((k) => `progress-${k}`));
  }

  const resultado: string[] = [];
  let gruposEmitidos = false;
  for (const token of tokens) {
    if (token.startsWith('${')) {
      resultado.push(token);
      continue;
    }
    if (consumidos.has(token)) {
      if (!gruposEmitidos) {
        resultado.push(...saida);
        gruposEmitidos = true;
      }
      continue;
    }
    const [, prefixo, core] = token.match(PREFIXO) as RegExpMatchArray;
    const cor = converterCor(core);
    if (cor !== null) {
      resultado.push(prefixar(prefixo, cor));
      continue;
    }
    if (core in SIMPLES) {
      const v = SIMPLES[core];
      if (v) resultado.push(prefixar(prefixo, v));
      continue;
    }
    // Modificadores avulsos (base em outro literal): vencem com !important
    const avulso = converterAvulso(core);
    if (avulso !== null) {
      if (avulso) resultado.push(prefixar(prefixo, importante(avulso)));
      continue;
    }
    resultado.push(token);
  }
  if (!gruposEmitidos && saida.length) resultado.unshift(...saida);
  return resultado.filter(Boolean).join(' ');
}

function converterAvulso(core: string): string | null {
  let m = core.match(/^btn-(xs|sm|md|lg)$/);
  if (m) return BTN_TAMANHO[m[1]];
  m = core.match(/^btn-(primary|secondary|accent|info|success|warning|error|neutral)$/);
  if (m) return corBotao(CORES_BOTAO[m[1]]);
  if (core === 'btn-ghost') return 'bg-transparent hover:bg-muted';
  if (core === 'btn-outline') return 'border border-input bg-card hover:bg-muted';
  if (core === 'btn-square') return 'w-10 px-0';
  if (core === 'btn-circle') return 'w-10 rounded-full px-0';
  m = core.match(/^badge-(xs|sm|md|lg)$/);
  if (m) return BADGE_TAMANHO[m[1]];
  m = core.match(/^badge-(primary|secondary|accent|info|success|warning|error|neutral|ghost|outline)$/);
  if (m) return BADGE_COR[m[1]];
  m = core.match(/^(input|select)-(xs|sm|md|lg)$/);
  if (m) return CAMPO_TAMANHO[m[2]];
  if (/^(input|select|textarea)-error$/.test(core)) return 'border-destructive';
  if (core === 'tab-active') return 'border-primary font-medium text-foreground';
  m = core.match(/^loading-(xs|sm|md|lg)$/);
  if (m) return LOADING_TAMANHO[m[1]];
  m = core.match(/^checkbox-(primary|secondary|accent|info|success|warning|error)$/);
  if (m) return '';
  m = core.match(/^alert-(info|success|warning|error)$/);
  if (m) return ALERTA_COR[m[1]];
  m = core.match(/^progress-(primary|secondary|accent|info|success|warning|error)$/);
  if (m) return progresso(PROGRESSO_COR[m[1]]);
  return null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run scripts/daisyui/converter-classes.test.ts`
Expected: PASS. Ajustar a implementação (não os testes) até passar.

- [ ] **Step 5: Commit**

```bash
git add apps/web/scripts/daisyui/converter-classes.ts apps/web/scripts/daisyui/converter-classes.test.ts apps/web/vitest.config.ts
git commit -m "Adicionar conversor de classes DaisyUI para os tokens da marca com testes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Migrador de arquivos e teste-guarda (TDD)

**Files:**
- Create: `apps/web/scripts/daisyui/migrar-conteudo.ts` + `migrar-conteudo.test.ts`
- Create: `apps/web/scripts/daisyui/migrar.ts`
- Create: `apps/web/src/guarda/sem-daisyui.test.ts`

**Interfaces:**
- Consumes: `converterClasses` (Task 1).
- Produces: `migrarConteudo(codigo: string): string`; `encontrarClassesDaisy(codigo: string): string[]` (exportado de `migrar-conteudo.ts`, usado pelo guarda); CLI `npx tsx scripts/daisyui/migrar.ts <arquivos…>`.

- [ ] **Step 1: Testes do migrador**

```ts
import { describe, expect, it } from 'vitest';
import { encontrarClassesDaisy, migrarConteudo } from './migrar-conteudo';

describe('migrarConteudo', () => {
  it('converte className com aspas duplas', () => {
    const s = migrarConteudo('<div className="card bg-base-100 p-4">x</div>');
    expect(s).toContain('bg-card');
    expect(s).not.toContain('base-100');
    expect(s).toContain('>x</div>');
  });
  it('converte literais dentro de className={...} e preserva comparações', () => {
    const s = migrarConteudo("<b className={`btn ${status === 'error' ? 'btn-error' : 'btn-ghost'}`} />");
    expect(s).toContain("status === 'error'");
    expect(s).toContain('!bg-destructive');
    expect(s).not.toMatch(/\bbtn\b/);
  });
  it('converte argumentos de cn() e clsx()', () => {
    expect(migrarConteudo("cn('badge badge-sm', ativo && 'badge-primary')")).toContain('!bg-primary/12');
  });
  it('não mexe em texto fora de className/cn', () => {
    const codigo = "const titulo = 'card de cliente'; <p>btn</p>";
    expect(migrarConteudo(codigo)).toBe(codigo);
  });
});

describe('encontrarClassesDaisy', () => {
  it('aponta classes DaisyUI em className e em literais típicos', () => {
    expect(encontrarClassesDaisy('<div className="btn btn-primary" />')).toEqual(['btn', 'btn-primary']);
    expect(encontrarClassesDaisy("const estilo = { botao: 'btn-error' };")).toEqual(['btn-error']);
    expect(encontrarClassesDaisy('<div className="bg-card text-foreground" />')).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run scripts/daisyui/migrar-conteudo.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `migrar-conteudo.ts`**

```ts
import { converterClasses } from './converter-classes';

/** Converte cada literal de string (aspas simples/duplas e partes estáticas de template) de um trecho de código. */
function converterLiterais(trecho: string): string {
  let saida = '';
  let i = 0;
  while (i < trecho.length) {
    const ch = trecho[i];
    if (ch === "'" || ch === '"') {
      const fim = trecho.indexOf(ch, i + 1);
      if (fim < 0) return saida + trecho.slice(i);
      saida += ch + converterClasses(trecho.slice(i + 1, fim)) + ch;
      i = fim + 1;
    } else if (ch === '`') {
      let j = i + 1;
      let estatico = '';
      saida += '`';
      while (j < trecho.length && trecho[j] !== '`') {
        if (trecho[j] === '$' && trecho[j + 1] === '{') {
          saida += converterClasses(estatico);
          estatico = '';
          let prof = 1;
          let k = j + 2;
          while (k < trecho.length && prof > 0) {
            if (trecho[k] === '{') prof += 1;
            if (trecho[k] === '}') prof -= 1;
            k += 1;
          }
          saida += '${' + converterLiterais(trecho.slice(j + 2, k - 1)) + '}';
          j = k;
        } else {
          estatico += trecho[j];
          j += 1;
        }
      }
      saida += converterClassesPreservandoBordas(estatico) + '`';
      i = j + 1;
    } else {
      saida += ch;
      i += 1;
    }
  }
  return saida;
}

/** Mantém espaços nas bordas (separam do ${...} vizinho). */
function converterClassesPreservandoBordas(s: string): string {
  const ini = s.match(/^\s*/)?.[0] ?? '';
  const fim = s.match(/\s*$/)?.[0] ?? '';
  const meio = s.trim();
  return meio ? ini + converterClasses(meio) + fim : s;
}

function fimBalanceado(codigo: string, inicio: number, abre: string, fecha: string): number {
  let prof = 0;
  for (let i = inicio; i < codigo.length; i++) {
    const ch = codigo[i];
    if (ch === "'" || ch === '"' || ch === '`') {
      const fimStr = codigo.indexOf(ch, i + 1);
      if (fimStr < 0) return codigo.length;
      i = fimStr;
      continue;
    }
    if (ch === abre) prof += 1;
    if (ch === fecha) {
      prof -= 1;
      if (prof === 0) return i;
    }
  }
  return codigo.length;
}

export function migrarConteudo(codigo: string): string {
  let saida = '';
  let i = 0;
  const padrao = /className=|\bcn\(|\bclsx\(/g;
  let m: RegExpExecArray | null;
  while ((m = padrao.exec(codigo))) {
    const inicio = m.index + m[0].length;
    saida += codigo.slice(i, inicio);
    if (m[0] === 'className=') {
      const ch = codigo[inicio];
      if (ch === '"' || ch === "'") {
        const fim = codigo.indexOf(ch, inicio + 1);
        saida += ch + converterClasses(codigo.slice(inicio + 1, fim)) + ch;
        i = fim + 1;
      } else if (ch === '{') {
        const fim = fimBalanceado(codigo, inicio, '{', '}');
        saida += '{' + converterLiterais(codigo.slice(inicio + 1, fim)) + '}';
        i = fim + 1;
      } else {
        i = inicio;
      }
    } else {
      const fim = fimBalanceado(codigo, inicio - 1, '(', ')');
      saida += converterLiterais(codigo.slice(inicio, fim)) + ')';
      i = fim + 1;
    }
    padrao.lastIndex = i;
  }
  return saida + codigo.slice(i);
}

const DISTINTIVAS =
  /(?<![\w-])(btn(?:-(?:primary|secondary|accent|info|success|warning|error|neutral|ghost|outline|xs|sm|md|lg|square|circle|block|wide|link|disabled|active))?|badge(?:-(?:primary|secondary|accent|info|success|warning|error|neutral|ghost|outline|xs|sm|md|lg))?|card-body|card-title|card-actions|form-control|label-text(?:-alt)?|input-bordered|select-bordered|textarea-bordered|(?:input|select|textarea)-(?:xs|sm|lg|error)|loading-(?:spinner|xs|sm|md|lg|dots)|alert-(?:info|success|warning|error)|tab-active|tabs-(?:bordered|lifted|boxed)|stat-(?:title|value|desc|figure)|step-primary|join-item|modal-box|modal-open|dropdown-content|dropdown-(?:end|top|bottom|left|right)|checkbox-(?:primary|secondary|sm|xs|lg)|toggle-(?:sm|xs|lg|primary|success)|range-(?:sm|xs)|progress-(?:primary|success|warning|error|info)|table-(?:zebra|xs|sm)|rounded-box|(?:bg|text|border|ring|from|to|via|stroke|fill|divide)-(?:base-100|base-200|base-300|base-content|primary-content|secondary|secondary-content|accent|accent-content|neutral|neutral-content|error|error-content|success-content|warning-content|info-content)(?:\/\d+)?)(?![\w-])/g;

/** Classes DaisyUI em qualquer literal do arquivo (usado pelo teste-guarda). */
export function encontrarClassesDaisy(codigo: string): string[] {
  const achados: string[] = [];
  const literais = codigo.match(/(["'`])(?:(?!\1)[^\\]|\\.)*\1/g) ?? [];
  for (const lit of literais) {
    for (const m of lit.matchAll(DISTINTIVAS)) achados.push(m[1]);
  }
  for (const m of codigo.matchAll(/className=(["'])([^"']*)\1/g)) {
    for (const t of m[2].split(/\s+/)) {
      const core = t.replace(/^(?:[a-z0-9-]+:)+/, '');
      if (['btn', 'badge', 'card', 'input', 'select', 'textarea', 'label', 'loading', 'alert', 'tabs', 'tab', 'stat', 'stats', 'steps', 'step', 'join', 'divider', 'checkbox', 'toggle', 'radio', 'range', 'progress', 'table', 'menu', 'dropdown', 'modal', 'collapse', 'avatar', 'placeholder', 'kbd', 'link', 'tooltip', 'swap', 'navbar', 'drawer', 'mask', 'rating', 'file-input'].includes(core) && !achados.includes(core)) {
        achados.push(core);
      }
    }
  }
  return [...new Set(achados)];
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run scripts/daisyui/migrar-conteudo.test.ts`
Expected: PASS.

- [ ] **Step 5: CLI `migrar.ts`**

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { migrarConteudo } from './migrar-conteudo';

const arquivos = process.argv.slice(2);
let alterados = 0;
for (const arquivo of arquivos) {
  const original = readFileSync(arquivo, 'utf8');
  const migrado = migrarConteudo(original);
  if (migrado !== original) {
    writeFileSync(arquivo, migrado);
    alterados += 1;
    console.log(`migrado: ${arquivo}`);
  }
}
console.log(`${alterados} de ${arquivos.length} arquivo(s) alterado(s).`);
```

- [ ] **Step 6: Teste-guarda `apps/web/src/guarda/sem-daisyui.test.ts`**

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { encontrarClassesDaisy } from '../../scripts/daisyui/migrar-conteudo';

const RAIZ = path.resolve(__dirname, '..');

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = path.join(dir, nome);
    if (statSync(caminho).isDirectory()) return nome === 'shadcn' ? [] : arquivos(caminho);
    return /\.tsx?$/.test(nome) && !nome.endsWith('.test.ts') ? [caminho] : [];
  });
}

describe('sem DaisyUI', () => {
  it('nenhum arquivo em src/ usa classes DaisyUI', () => {
    const ocorrencias = arquivos(RAIZ)
      .map((arq) => ({ arq: path.relative(RAIZ, arq), classes: encontrarClassesDaisy(readFileSync(arq, 'utf8')) }))
      .filter((o) => o.classes.length > 0);
    expect(ocorrencias).toEqual([]);
  });
});
```

- [ ] **Step 7: Rodar o guarda e ver falhar (estado atual)**

Run: `cd apps/web && npx vitest run src/guarda`
Expected: FAIL listando dezenas de arquivos. (Fica vermelho até o Task 5; os demais testes devem continuar verdes.)

- [ ] **Step 8: Commit** (o guarda entra marcado como `it.fails` temporariamente para não quebrar a suíte; volta a `it` no Task 5)

Trocar `it(` por `it.fails(` no guarda antes de commitar.

```bash
git add apps/web/scripts/daisyui apps/web/src/guarda
git commit -m "Adicionar migrador de classes e teste-guarda contra DaisyUI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Rodar a migração em lotes

**Files:** todos os `.tsx` de `apps/web/src` exceto `components/ui/shadcn/**`.

- [ ] **Step 1: Instalar tsx** — `npm install -D tsx@4.19.2 -w @meta-app/web`
- [ ] **Step 2: Lote A (telas internas)**

Run: `cd apps/web && npx tsx scripts/daisyui/migrar.ts $(find src/app/admin src/app/auditoria -name '*.tsx')`
Then: `npx tsc --noEmit` — corrigir erros (não deve haver, só strings mudam). Commit "Migrar telas internas para os tokens da marca".

- [ ] **Step 3: Lote B (componentes)**

Run: `cd apps/web && npx tsx scripts/daisyui/migrar.ts $(find src/components -name '*.tsx' -not -path '*/shadcn/*')`
Then `npx tsc --noEmit`; commit "Migrar componentes para os tokens da marca".

- [ ] **Step 4: Lote C (páginas públicas e raiz do app)**

Run: `cd apps/web && npx tsx scripts/daisyui/migrar.ts $(find src/app -maxdepth 2 -name '*.tsx' -not -path 'src/app/admin*')`
Then `npx tsc --noEmit`; commit "Migrar páginas públicas para os tokens da marca".

---

### Task 4: Ajustes manuais apontados pelo guarda

**Files:** os listados pelo guarda (`cd apps/web && npx vitest run src/guarda` com `it` temporariamente no lugar de `it.fails`).

- [ ] **Step 1:** Rodar o guarda e listar o que restou.
- [ ] **Step 2: Componentes com comportamento**
  - `dropdown`/`dropdown-content`/`menu` → `DropdownMenu` (shadcn) com os mesmos itens.
  - `collapse` → `<details className="group rounded-lg border border-border">` + `<summary>` com `ChevronDown` girando em `group-open:rotate-180`.
  - `components/ui/tooltip.tsx` (`data-tip`) → reimplementar com `Tooltip`/`TooltipTrigger`/`TooltipContent` shadcn mantendo a mesma API do componente.
  - `avatar placeholder` → `span` redondo `flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground`.
  - `steps` restantes → mesmo indicador de barras usado em Nova auditoria.
  - `swap`, `rating`, `file-input`, `mask`, `kbd`: substituir por equivalentes utilitários caso apareçam.
- [ ] **Step 3: Literais fora de `className`** (mapas de estilo): rodar `converterClasses` mentalmente — trocar pelos utilitários correspondentes (ex.: `'btn-error'` → `'bg-destructive text-destructive-foreground hover:bg-destructive/90'`).
- [ ] **Step 4:** `npx tsc --noEmit && npx vitest run` (fora o guarda) verdes; commit "Migrar componentes com comportamento próprio do DaisyUI".

---

### Task 5: Remover o DaisyUI

**Files:**
- Modify: `apps/web/tailwind.config.ts` (remover `daisyui` do import, de `plugins` e o bloco `daisyui: {…}`)
- Modify: `apps/web/package.json` (`npm uninstall daisyui -w @meta-app/web`)
- Modify: `apps/web/src/app/globals.css` (remover regras `.modal…` e `.tooltip[data-tip]…`; trocar `#E5E9F0`/`#1B2A4A` da scrollbar por `hsl(var(--border))`/`hsl(var(--foreground))`)
- Modify: `apps/web/src/app/layout.tsx` (remover `data-theme="light"`)
- Modify: `apps/web/src/guarda/sem-daisyui.test.ts` (`it.fails` → `it`)

- [ ] **Step 1:** aplicar as remoções acima.
- [ ] **Step 2:** `cd apps/web && npx tsc --noEmit && npx vitest run` — guarda PASS e suíte verde.
- [ ] **Step 3:** `npx next build` — sai 0.
- [ ] **Step 4:** Commit "Remover DaisyUI do projeto".

---

### Task 6: Clientes em abas e Legislações no layout padrão

**Files:**
- Modify: `apps/web/src/app/admin/clientes/page.tsx`
- Modify: `apps/web/src/app/admin/legislacoes/page.tsx`, `apps/web/src/app/admin/legislacoes/nova/page.tsx`, `apps/web/src/app/admin/legislacoes/[id]/page.tsx`

- [ ] **Step 1: Clientes** — dentro do `FormModal` de edição (`editingCliente` definido), envolver o conteúdo em `Tabs` (shadcn) com:
  - **Dados**: logo + razão social, nome fantasia, CNPJ, telefone, e-mail, tipo de atividade (bloco atual, sem mudanças de lógica);
  - **Unidades**: a "Seção de Unidades" atual (listagem, edição inline, nova unidade);
  - **Equipe**: o `MultiSelectAuditores` do cliente;
  - **Auditorias**: lista somente leitura das auditorias do cliente (`auditoriaService.listar(1, 100)` filtrado por `unidade.cliente.id`), com data, unidade, `StatusChip` e link para o relatório/execução; estado vazio quando não houver.
  - No cadastro novo (`!editingCliente`) manter o formulário em uma página só (Dados + Unidades), pois as unidades são obrigatórias na criação.
  - `maxWidth="3xl"` para o modal de edição.
- [ ] **Step 2: Legislações** — envolver as três páginas em `AppLayout` + `PageHeader` (título, `backHref` nas internas), removendo o cabeçalho escuro próprio e o fundo gradiente; cards e campos já migrados pelo Task 3; botões de ação como `Button`.
- [ ] **Step 3:** `npx tsc --noEmit && npx vitest run`; commit "Organizar edição de cliente em abas e levar Legislações ao layout padrão".

---

### Task 7: Verificação local

- [ ] `cd apps/web && npx next build` (sai 0) e reiniciar `npm run dev`.
- [ ] Checklist manual (375px e 1440px): landing, login, cadastro, páginas legais e aviso de cookies sem quebra visual; clientes (abas), equipe, perfil, checklists (lista/criar/editar/importar), planos, assinaturas, créditos, consumo de IA, lista de espera, limites/créditos do gestor, Legislações, relatório técnico (novo/editar), relatório público da auditoria (`/auditoria/[id]/relatorio`), execução e modais.
- [ ] Validar com o usuário e publicar.

---

## Self-review (feito)

- Cobertura: páginas públicas + remoção total (decisão do usuário) ✔ T3–T5; clientes em abas ✔ T6 (Ruling: abas dentro da folha de edição em vez de rota própria — evita mover ~1.400 linhas de estado; informação separada como na spec); Legislações no layout ✔ T6; editor de checklists: migração visual completa ✔ T3, reorganização estrutural (grupos à esquerda + pergunta em folha) fica para uma etapa própria após validação (registrar ruling).
- Tipos/nomes: `converterClasses`, `migrarConteudo`, `encontrarClassesDaisy` consistentes entre tasks.

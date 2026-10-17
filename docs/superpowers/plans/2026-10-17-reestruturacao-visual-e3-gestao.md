# Reestruturação visual — E3 Telas de gestão — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar as telas de gestão — Início do gestor (KPIs + abas), relatório da auditoria (abas), planos de ação, agenda, relatórios técnicos e check-ins — e modernizar os componentes compartilhados de lista/modal, levando o novo visual a todas as telas que os usam.

**Architecture:** Agregações do dashboard e utilitário de data local viram módulos puros testados. `FormModal`, `ConfirmDialog`, `CrudTable` e `CrudFiltros` mantêm a API e passam a usar tokens/primitivas da E1 (com portal para o `body`, evitando conflito com folhas vaul). O relatório mantém o modo PDF intacto e reorganiza só a visualização em abas. A busca global passa a encontrar auditorias.

**Tech Stack:** Next.js 15, React 18, Tailwind 3.4, shadcn/ui (Tabs, Button, Input, Skeleton), recharts, Vitest 2.

**Spec:** `docs/superpowers/specs/2026-10-17-reestruturacao-visual-web-design.md` (seções 5–6)

## Global Constraints

- Mesmas da E1/E2 (tokens, raio, sombras, tipografia, gutters, breakpoints, toque ≥44px, pt-BR sóbrio, sem `secondary`/`accent` em shadcn, sem classes com nomes DaisyUI em código novo).
- APIs públicas preservadas: `FormModal` (`open, onClose, title, children, footer, maxWidth, isDirty, closeOnBackdrop`), `ConfirmDialog` (`open, onClose, onConfirm, title, message, confirmLabel, cancelLabel, variant, loading`), `CrudTable`, `CrudFiltros` (incluindo `onLimpar` disparado ao montar).
- Confirmação de descarte no `FormModal` só após interação real (regra do AGENTS.md).
- Menu de ações do `CrudTable` não pode ser cortado por overflow (posição fixa + `getBoundingClientRect`).
- Relatório: modo PDF (`?pdf=true`) não muda.
- Datas "hoje" sempre no fuso local do navegador.
- Commits em pt-BR terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Usuário no Brasil depois das 21h — "hoje" não pode virar amanhã (agenda/tarefas atrasadas); testado em `dataLocalISO`.
2. Período sem auditorias finalizadas — aproveitamento médio "—" e rankings de unidade vazios, sem `NaN`; testado em `mediaAproveitamento`/`rankingUnidades`.
3. `FormModal` aberto de dentro de uma folha (vaul) ou com conteúdo longo no celular — precisa receber toques e rolar; coberto pelo portal no Task 2.
4. Filtros do `CrudFiltros` no celular — recolhidos atrás de "Filtros (n)", com o mesmo comportamento Pesquisar/Limpar; testado em `contarPreenchidos`.
5. Relatório sem não conformidades / sem resumo executivo — abas com estado vazio, nada quebrado; coberto no Task 5.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/web/src/lib/datas.ts` (novo) + teste | `dataLocalISO`, `formatarDataBr` |
| `apps/web/src/lib/dashboard/agregacoes.ts` (novo) + teste | Agregações do Início do gestor |
| `apps/web/src/components/ui/form-modal.tsx` | Portal + tokens; folha inferior no celular |
| `apps/web/src/components/ui/confirm-dialog.tsx` | Portal + tokens |
| `apps/web/src/components/ui/crud-table.tsx` | Tokens + skeleton |
| `apps/web/src/components/ui/crud-filtros.tsx` (+ `crud-filtros.test.ts`) | Tokens + recolher no celular |
| `apps/web/src/app/admin/dashboard/page.tsx` | `DashboardGestor` reescrito (KPIs + abas) |
| `apps/web/src/app/admin/auditoria/[id]/relatorio/page.tsx` | Visualização em abas |
| `apps/web/src/app/admin/{planos-acao,agenda,relatorios-tecnicos,checkins}/page.tsx` | Button/StatusChip/Input |
| `apps/web/src/components/inicio/inicio-auditor.tsx` | Usa `dataLocalISO` |
| `apps/web/src/components/layout/busca-global.tsx` + `navegacao.ts` | Busca de auditorias |

---

### Task 1: Datas locais (TDD)

**Files:**
- Create: `apps/web/src/lib/datas.ts`
- Test: `apps/web/src/lib/datas.test.ts`
- Modify: `apps/web/src/components/inicio/inicio-auditor.tsx`, `apps/web/src/app/admin/planos-acao/page.tsx`, `apps/web/src/app/admin/agenda/page.tsx`

**Interfaces:**
- Produces: `dataLocalISO(data?: Date): string` (yyyy-mm-dd no fuso local); `formatarDataBr(iso: string): string` (dd/mm/aaaa a partir de yyyy-mm-dd…).

- [ ] **Step 1: Testes**

```ts
import { describe, expect, it } from 'vitest';
import { dataLocalISO, formatarDataBr } from './datas';

describe('dataLocalISO', () => {
  it('usa o dia local, não o UTC', () => {
    const d = new Date(2026, 9, 17, 23, 30);
    expect(dataLocalISO(d)).toBe('2026-10-17');
  });
  it('preenche mês e dia com zero', () => {
    expect(dataLocalISO(new Date(2026, 0, 5, 8))).toBe('2026-01-05');
  });
});

describe('formatarDataBr', () => {
  it('converte yyyy-mm-dd e ignora horário', () => {
    expect(formatarDataBr('2026-10-07')).toBe('07/10/2026');
    expect(formatarDataBr('2026-10-07T03:00:00.000Z')).toBe('07/10/2026');
  });
});
```

Nota: o primeiro caso só detecta o bug quando o fuso do processo está atrás de UTC; rodar com `TZ=America/Sao_Paulo`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && TZ=America/Sao_Paulo npx vitest run src/lib/datas.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `datas.ts`**

```ts
/** Data no formato yyyy-mm-dd no fuso local do navegador (toISOString usaria UTC e viraria o dia após 21h no Brasil). */
export function dataLocalISO(data: Date = new Date()): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && TZ=America/Sao_Paulo npx vitest run src/lib/datas.test.ts`
Expected: PASS.

- [ ] **Step 5: Usar nas telas**

- `inicio-auditor.tsx`: trocar `const hoje = () => new Date().toISOString().slice(0, 10);` por `const hoje = () => dataLocalISO();` e `const dataBr = (d: string) => …` por `const dataBr = formatarDataBr;`, importando de `@/lib/datas`.
- `planos-acao/page.tsx`: em `estaAtrasada`, trocar `new Date().toISOString().slice(0, 10)` por `dataLocalISO()`; `formatarPrazo` passa a ser `formatarDataBr`.
- `agenda/page.tsx`: em `atrasada`, trocar `new Date().toISOString().slice(0, 10)` por `dataLocalISO()`; `formatarData` passa a ser `formatarDataBr`.

- [ ] **Step 6: Verificar e commitar**

Run: `cd apps/web && npx tsc --noEmit && TZ=America/Sao_Paulo npx vitest run`
Expected: sem erros; testes passam.

```bash
git add apps/web/src/lib/datas.ts apps/web/src/lib/datas.test.ts apps/web/src/components/inicio/inicio-auditor.tsx apps/web/src/app/admin/planos-acao/page.tsx apps/web/src/app/admin/agenda/page.tsx
git commit -m "Usar data local para hoje, atrasos e prazos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Componentes compartilhados de modal e lista

**Files:**
- Modify: `apps/web/src/components/ui/form-modal.tsx`
- Modify: `apps/web/src/components/ui/confirm-dialog.tsx`
- Modify: `apps/web/src/components/ui/crud-table.tsx`
- Modify: `apps/web/src/components/ui/crud-filtros.tsx`
- Test: `apps/web/src/components/ui/crud-filtros.test.ts`

**Interfaces:**
- Consumes: E1 (`Button`, `Input`, `Skeleton`, `cn`).
- Produces: mesmas APIs; `contarPreenchidos<T extends Record<string, string>>(valores: T, iniciais: T): number` exportado de `crud-filtros.tsx`.

- [ ] **Step 1: Teste de `contarPreenchidos`**

```ts
import { describe, expect, it } from 'vitest';
import { contarPreenchidos } from './crud-filtros';

describe('contarPreenchidos', () => {
  it('conta campos diferentes do valor inicial e não vazios', () => {
    const iniciais = { status: 'agendada', responsavelId: '', busca: '' };
    expect(contarPreenchidos(iniciais, iniciais)).toBe(0);
    expect(contarPreenchidos({ ...iniciais, responsavelId: 'u1' }, iniciais)).toBe(1);
    expect(contarPreenchidos({ ...iniciais, status: '', busca: 'x' }, iniciais)).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run src/components/ui/crud-filtros.test.ts`
Expected: FAIL — `contarPreenchidos is not a function` (ou import ausente).

- [ ] **Step 3: `crud-filtros.tsx` — helper, tokens e recolhimento no celular**

Adicionar acima do componente:

```tsx
export function contarPreenchidos<T extends Record<string, string>>(valores: T, iniciais: T): number {
  return Object.keys(valores).filter((k) => valores[k] && valores[k] !== iniciais[k]).length;
}
```

Adicionar estado `const [abertoMobile, setAbertoMobile] = useState(false);` e trocar o `return` e o `renderCampo` por:

```tsx
  const CLASSE_CAMPO = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';

  const renderCampo = (campo: CampoFiltro) => {
    const valor = (filtros[campo.key as keyof T] as string) || '';
    switch (campo.tipo) {
      case 'text':
        return (
          <input type="text" className={CLASSE_CAMPO} placeholder={campo.placeholder} value={valor}
            onChange={(e) => handleChange(campo.key, e.target.value)} onKeyDown={handleKeyDown} />
        );
      case 'select':
        return (
          <select className={CLASSE_CAMPO} value={valor} onChange={(e) => handleChange(campo.key, e.target.value)}>
            <option value="">{campo.placeholder || 'Todos'}</option>
            {campo.opcoes.map((op) => (<option key={op.value} value={op.value}>{op.label}</option>))}
          </select>
        );
      case 'date':
        return <input type="date" className={CLASSE_CAMPO} value={valor} onChange={(e) => handleChange(campo.key, e.target.value)} />;
    }
  };

  const preenchidos = contarPreenchidos(filtros as Record<string, string>, valoresIniciais as Record<string, string>);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      <button
        type="button"
        onClick={() => setAbertoMobile((v) => !v)}
        className="flex min-h-[48px] w-full items-center justify-between px-4 text-sm font-medium md:hidden"
        aria-expanded={abertoMobile}
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filtros{preenchidos > 0 && ` (${preenchidos})`}
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${abertoMobile ? 'rotate-180' : ''}`} />
      </button>
      <div className={`${abertoMobile ? 'block' : 'hidden'} space-y-3 border-t border-border p-4 md:block md:border-t-0`}>
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-2 xl:grid-cols-4">
          {campos.map((campo) => (
            <label key={campo.key} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">{campo.label}</span>
              {renderCampo(campo)}
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <Button variant={isMostrarLimpar ? 'ghost' : 'default'} className="h-10" onClick={isMostrarLimpar ? handleLimpar : handlePesquisar}>
            {isMostrarLimpar ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            {isMostrarLimpar ? 'Limpar' : 'Pesquisar'}
          </Button>
        </div>
      </div>
    </div>
  );
```

Imports: `import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';` e `import { Button } from '@/components/ui/shadcn/button';`.

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run src/components/ui/crud-filtros.test.ts`
Expected: PASS.

- [ ] **Step 5: `crud-table.tsx` — tokens e skeleton**

- Loading: substituir o bloco `if (loading) { … }` por:

```tsx
  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-sm">
        {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-10 w-full" />))}
      </div>
    );
  }
```

- Botão do menu: trocar `className="btn btn-ghost btn-xs btn-circle"` por `className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"`.
- Menu (portal): trocar classes por `fixed z-[100] flex min-w-[160px] flex-col rounded-md border border-border bg-popover py-1 shadow-lg`; itens: `flex min-h-[40px] w-full items-center gap-2 px-3 text-left text-sm transition-colors hover:bg-muted ${acao.className || 'text-foreground'}`.
- Contêiner: `rounded-lg border border-border bg-card shadow-sm overflow-hidden ${className}`.
- Tabela desktop: `<table className="w-full text-sm">`; `thead` com `className="border-b border-border bg-muted/50"`; `th` com `px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground ${col.className || ''}`; `tbody className="divide-y divide-border"`; `tr className="h-12 transition-colors hover:bg-muted/40"`; `td className={`px-4 ${col.className ?? ''}`}`.
- Cards mobile: `divide-y divide-border`; rótulos `text-xs text-muted-foreground`.
- Import: `import { Skeleton } from '@/components/ui/shadcn/skeleton';` e remover `Loader2` se não usado.

- [ ] **Step 6: `form-modal.tsx` — portal, tokens e folha no celular**

- Envolver o `AnimatePresence` em `createPortal(…, document.body)` (import `createPortal` de `react-dom`), protegido por montagem: `const [montado, setMontado] = useState(false); useEffect(() => setMontado(true), []);` e retornar o portal só se `montado`.
- Contêiner externo: `fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4`.
- Backdrop: `absolute inset-0 bg-foreground/50`.
- Caixa: `relative flex w-full ${MAX_WIDTH_MAP[maxWidth]} max-h-[92vh] flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-lg sm:max-h-[90vh] sm:rounded-lg`.
- Cabeçalho: `flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4`; título `truncate font-display text-lg font-semibold`; botão fechar `flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:h-9 sm:w-9`.
- Corpo: `flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-5` (manter `onChangeCapture`/`onInputCapture`).
- Rodapé: `flex shrink-0 justify-end gap-3 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4`.

- [ ] **Step 7: `confirm-dialog.tsx` — portal e tokens**

- Mesmo padrão de portal/montagem do Step 6, `z-[70]` (acima do `FormModal`).
- Mapa de variantes:

```tsx
  const variantStyles = {
    danger: { icon: 'text-destructive', bg: 'bg-destructive/10', button: 'bg-destructive text-destructive-foreground hover:bg-destructive/90' },
    warning: { icon: 'text-warning', bg: 'bg-warning/15', button: 'bg-warning text-white hover:bg-warning/90' },
    info: { icon: 'text-info', bg: 'bg-info/10', button: 'bg-info text-white hover:bg-info/90' },
  };
```

- Caixa: `relative w-full max-w-md rounded-lg border border-border bg-card shadow-lg`; cabeçalho `flex items-center gap-3 border-b border-border p-5`; título `font-display text-lg font-semibold`; mensagem `p-5 text-sm text-muted-foreground`; ações `flex justify-end gap-2 border-t border-border p-4`.
- Botões: cancelar `<Button variant="ghost" onClick={onClose} disabled={loading}>`; confirmar `<Button className={styles.button} onClick={handleConfirm} disabled={loading}>` (spinner `Loader2` + "Processando…" quando `loading`). Fechar (X) como botão `h-9 w-9` ghost.

- [ ] **Step 8: Verificar**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: sem erros; testes passam.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/ui/form-modal.tsx apps/web/src/components/ui/confirm-dialog.tsx apps/web/src/components/ui/crud-table.tsx apps/web/src/components/ui/crud-filtros.tsx apps/web/src/components/ui/crud-filtros.test.ts
git commit -m "Modernizar modal, confirmação, tabela e filtros compartilhados

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Agregações do Início do gestor (TDD)

**Files:**
- Create: `apps/web/src/lib/dashboard/agregacoes.ts`
- Test: `apps/web/src/lib/dashboard/agregacoes.test.ts`

**Interfaces:**
- Consumes: tipo `Auditoria`.
- Produces:
  - `interface FiltroDashboard { inicio: string; fim: string; templateId: string; unidadeId: string }`
  - `filtrarDashboard(lista: Auditoria[], f: FiltroDashboard): Auditoria[]`
  - `mediaAproveitamento(lista: Auditoria[]): number | null` (só finalizadas)
  - `avaliacoesPorMes(lista: Auditoria[]): { chave: string; mes: string; total: number }[]` (ordem cronológica, `mes` = `MM/AA`)
  - `rankingAvaliadores(lista: Auditoria[]): { id: string; nome: string; total: number }[]` (desc)
  - `rankingUnidades(lista: Auditoria[]): { id: string; nome: string; ultima: number; media: number; total: number }[]` (só finalizadas, desc por média)
  - `resumoPorChecklist(lista: Auditoria[]): { id: string; nome: string; total: number; finalizadas: number; media: number | null }[]` (desc por total)

- [ ] **Step 1: Testes**

```ts
import { describe, expect, it } from 'vitest';
import type { Auditoria } from '@/lib/api';
import {
  avaliacoesPorMes,
  filtrarDashboard,
  mediaAproveitamento,
  rankingAvaliadores,
  rankingUnidades,
  resumoPorChecklist,
} from './agregacoes';

const a = (p: { id: string; status?: string; data: string; nota?: number; unidade?: string; consultor?: string; template?: string }) =>
  ({
    id: p.id,
    status: p.status ?? 'finalizada',
    dataInicio: p.data,
    pontuacaoTotal: p.nota ?? 0,
    unidade: { id: p.unidade ?? 'u1', nome: `Unidade ${p.unidade ?? 'u1'}` },
    consultor: { id: p.consultor ?? 'c1', nome: `Pessoa ${p.consultor ?? 'c1'}` },
    template: { id: p.template ?? 't1', nome: `Checklist ${p.template ?? 't1'}` },
    itens: [],
  }) as unknown as Auditoria;

const lista = [
  a({ id: '1', data: '2026-09-10T12:00:00', nota: 80, unidade: 'u1', consultor: 'c1' }),
  a({ id: '2', data: '2026-10-02T12:00:00', nota: 60, unidade: 'u1', consultor: 'c2' }),
  a({ id: '3', data: '2026-10-05T12:00:00', nota: 90, unidade: 'u2', consultor: 'c1', template: 't2' }),
  a({ id: '4', data: '2026-10-06T12:00:00', status: 'em_andamento', unidade: 'u3', consultor: 'c1' }),
];

describe('filtrarDashboard', () => {
  it('filtra período, checklist e unidade', () => {
    const base = { inicio: '2026-10-01', fim: '2026-10-31', templateId: '', unidadeId: '' };
    expect(filtrarDashboard(lista, base).map((x) => x.id)).toEqual(['2', '3', '4']);
    expect(filtrarDashboard(lista, { ...base, templateId: 't2' }).map((x) => x.id)).toEqual(['3']);
    expect(filtrarDashboard(lista, { ...base, unidadeId: 'u1' }).map((x) => x.id)).toEqual(['2']);
  });
});

describe('mediaAproveitamento', () => {
  it('média só das finalizadas; null sem finalizadas', () => {
    expect(mediaAproveitamento(lista)).toBeCloseTo(76.67, 1);
    expect(mediaAproveitamento([lista[3]])).toBeNull();
  });
});

describe('avaliacoesPorMes', () => {
  it('agrupa por mês em ordem cronológica', () => {
    expect(avaliacoesPorMes(lista).map((m) => [m.mes, m.total])).toEqual([['09/26', 1], ['10/26', 3]]);
  });
});

describe('rankingAvaliadores', () => {
  it('ordena por quantidade', () => {
    expect(rankingAvaliadores(lista).map((r) => [r.nome, r.total])).toEqual([['Pessoa c1', 3], ['Pessoa c2', 1]]);
  });
});

describe('rankingUnidades', () => {
  it('usa só finalizadas, última nota cronológica e média', () => {
    const r = rankingUnidades(lista);
    expect(r.map((u) => u.id)).toEqual(['u2', 'u1']);
    expect(r[1]).toMatchObject({ ultima: 60, media: 70, total: 2 });
  });
  it('vazio sem finalizadas', () => {
    expect(rankingUnidades([lista[3]])).toEqual([]);
  });
});

describe('resumoPorChecklist', () => {
  it('conta total, finalizadas e média', () => {
    expect(resumoPorChecklist(lista)).toEqual([
      { id: 't1', nome: 'Checklist t1', total: 3, finalizadas: 2, media: 70 },
      { id: 't2', nome: 'Checklist t2', total: 1, finalizadas: 1, media: 90 },
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run src/lib/dashboard/agregacoes.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `agregacoes.ts`**

```ts
import type { Auditoria } from '@/lib/api';

export interface FiltroDashboard {
  inicio: string;
  fim: string;
  templateId: string;
  unidadeId: string;
}

const finalizadas = (lista: Auditoria[]) => lista.filter((a) => a.status === 'finalizada');
const nota = (a: Auditoria) => Number(a.pontuacaoTotal || 0);

export function filtrarDashboard(lista: Auditoria[], f: FiltroDashboard): Auditoria[] {
  const inicio = f.inicio ? new Date(`${f.inicio}T00:00:00`).getTime() : -Infinity;
  const fim = f.fim ? new Date(`${f.fim}T23:59:59`).getTime() : Infinity;
  return lista.filter((a) => {
    const t = new Date(a.dataInicio).getTime();
    if (t < inicio || t > fim) return false;
    if (f.templateId && a.template?.id !== f.templateId) return false;
    if (f.unidadeId && a.unidade?.id !== f.unidadeId) return false;
    return true;
  });
}

export function mediaAproveitamento(lista: Auditoria[]): number | null {
  const fin = finalizadas(lista);
  if (fin.length === 0) return null;
  return fin.reduce((s, a) => s + nota(a), 0) / fin.length;
}

export function avaliacoesPorMes(lista: Auditoria[]): { chave: string; mes: string; total: number }[] {
  const mapa = new Map<string, number>();
  lista.forEach((a) => {
    const d = new Date(a.dataInicio);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
  });
  return Array.from(mapa, ([chave, total]) => ({ chave, mes: `${chave.slice(5)}/${chave.slice(2, 4)}`, total })).sort((x, y) =>
    x.chave.localeCompare(y.chave),
  );
}

export function rankingAvaliadores(lista: Auditoria[]): { id: string; nome: string; total: number }[] {
  const mapa = new Map<string, { id: string; nome: string; total: number }>();
  lista.forEach((a) => {
    const id = a.consultor?.id ?? 'sem-avaliador';
    const atual = mapa.get(id) ?? { id, nome: a.consultor?.nome ?? 'Não informado', total: 0 };
    atual.total += 1;
    mapa.set(id, atual);
  });
  return Array.from(mapa.values()).sort((x, y) => y.total - x.total);
}

export function rankingUnidades(lista: Auditoria[]): { id: string; nome: string; ultima: number; media: number; total: number }[] {
  const mapa = new Map<string, { id: string; nome: string; notas: number[] }>();
  [...finalizadas(lista)]
    .sort((x, y) => new Date(x.dataInicio).getTime() - new Date(y.dataInicio).getTime())
    .forEach((a) => {
      const id = a.unidade?.id ?? 'sem-unidade';
      const atual = mapa.get(id) ?? { id, nome: a.unidade?.nome ?? 'Unidade', notas: [] };
      atual.notas.push(nota(a));
      mapa.set(id, atual);
    });
  return Array.from(mapa.values())
    .map((u) => ({
      id: u.id,
      nome: u.nome,
      ultima: u.notas[u.notas.length - 1],
      media: u.notas.reduce((s, n) => s + n, 0) / u.notas.length,
      total: u.notas.length,
    }))
    .sort((x, y) => y.media - x.media);
}

export function resumoPorChecklist(lista: Auditoria[]): { id: string; nome: string; total: number; finalizadas: number; media: number | null }[] {
  const mapa = new Map<string, { id: string; nome: string; total: number; finalizadas: number; soma: number }>();
  lista.forEach((a) => {
    const id = a.template?.id ?? 'sem-checklist';
    const atual = mapa.get(id) ?? { id, nome: a.template?.nome ?? 'Sem checklist', total: 0, finalizadas: 0, soma: 0 };
    atual.total += 1;
    if (a.status === 'finalizada') {
      atual.finalizadas += 1;
      atual.soma += nota(a);
    }
    mapa.set(id, atual);
  });
  return Array.from(mapa.values())
    .map(({ soma, ...c }) => ({ ...c, media: c.finalizadas ? soma / c.finalizadas : null }))
    .sort((x, y) => y.total - x.total);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run src/lib/dashboard/agregacoes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/dashboard
git commit -m "Adicionar agregações do Início do gestor com testes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Início do gestor com KPIs e abas

**Files:**
- Create: `apps/web/src/components/inicio/inicio-gestor.tsx`
- Modify: `apps/web/src/app/admin/dashboard/page.tsx` (substituir todo o arquivo)

**Interfaces:**
- Consumes: Task 1 (`dataLocalISO`, `formatarDataBr`), Task 3 (todas), E1 (`StatCard`, `StatusChip`, `EmptyState`, `Tabs*`, `Button`, `Input`, `Skeleton`), `auditoriaService.listar`, `planoAcaoService.resumo`, `agendaService.listar`, recharts.
- Produces: `InicioGestor()`; `page.tsx` exporta `DashboardPage` que escolhe `InicioAuditor` ou `InicioGestor`.

- [ ] **Step 1: `inicio-gestor.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { CalendarClock, ClipboardCheck, Clock, ListChecks, Printer, TrendingUp } from 'lucide-react';
import { EmptyState, StatCard, StatusChip } from '@/components';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/shadcn/tabs';
import { auditoriaService, type Auditoria } from '@/lib/api';
import { agendaService, type AgendaItem } from '@/lib/services/agenda.service';
import { planoAcaoService, type ResumoPlanoAcao } from '@/lib/services/plano-acao.service';
import { useAuthStore } from '@/lib/store';
import { dataLocalISO, formatarDataBr } from '@/lib/datas';
import {
  avaliacoesPorMes,
  filtrarDashboard,
  mediaAproveitamento,
  rankingAvaliadores,
  rankingUnidades,
  resumoPorChecklist,
  type FiltroDashboard,
} from '@/lib/dashboard/agregacoes';

const SELECT = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm';
const PRIMARY = 'hsl(175 100% 36%)';

function Painel({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-semibold">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(1).replace('.', ',')}%`);

export function InicioGestor() {
  const { usuario } = useAuthStore();
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [resumoPlano, setResumoPlano] = useState<ResumoPlanoAcao | null>(null);
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [filtro, setFiltro] = useState<FiltroDashboard>(() => {
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - 30);
    return { inicio: dataLocalISO(inicio), fim: dataLocalISO(), templateId: '', unidadeId: '' };
  });

  useEffect(() => {
    const carregar = async () => {
      try {
        const todas: Auditoria[] = [];
        for (let pagina = 1; pagina <= 10; pagina++) {
          const r = await auditoriaService.listar(pagina, 100);
          todas.push(...(r.items || []));
          if ((r.items || []).length < 100) break;
        }
        setAuditorias(todas);
      } catch {
        // erro tratado pelo interceptor
      } finally {
        setCarregando(false);
      }
    };
    void carregar();
    planoAcaoService.resumo().then(setResumoPlano).catch(() => undefined);
    agendaService.listar(1, 5, 'agendada').then((r) => setAgendas(r.items)).catch(() => undefined);
  }, []);

  const opcoes = useMemo(() => {
    const t = new Map<string, string>();
    const u = new Map<string, string>();
    auditorias.forEach((a) => {
      if (a.template) t.set(a.template.id, a.template.nome);
      if (a.unidade) u.set(a.unidade.id, a.unidade.nome);
    });
    return { templates: Array.from(t, ([id, nome]) => ({ id, nome })), unidades: Array.from(u, ([id, nome]) => ({ id, nome })) };
  }, [auditorias]);

  const filtradas = useMemo(() => filtrarDashboard(auditorias, filtro), [auditorias, filtro]);
  const media = mediaAproveitamento(filtradas);
  const porMes = avaliacoesPorMes(filtradas);
  const avaliadores = rankingAvaliadores(filtradas);
  const unidades = rankingUnidades(filtradas);
  const checklists = resumoPorChecklist(filtradas);
  const emAndamento = filtradas.filter((a) => a.status === 'em_andamento').length;
  const set = <K extends keyof FiltroDashboard>(k: K, v: string) => setFiltro((f) => ({ ...f, [k]: v }));
  const maxAvaliador = Math.max(1, ...avaliadores.map((r) => r.total));

  return (
    <div className="space-y-4 px-4 py-4 lg:px-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Olá, {usuario?.nome?.split(' ')[0] ?? 'gestor'}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="hidden h-10 w-10 md:inline-flex print:hidden" onClick={() => window.print()} aria-label="Imprimir">
          <Printer className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 shadow-sm lg:grid-cols-4 print:hidden">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">De</span>
          <Input type="date" value={filtro.inicio} onChange={(e) => set('inicio', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Até</span>
          <Input type="date" value={filtro.fim} onChange={(e) => set('fim', e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Checklist</span>
          <select className={SELECT} value={filtro.templateId} onChange={(e) => set('templateId', e.target.value)}>
            <option value="">Todos</option>
            {opcoes.templates.map((o) => (<option key={o.id} value={o.id}>{o.nome}</option>))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Unidade</span>
          <select className={SELECT} value={filtro.unidadeId} onChange={(e) => set('unidadeId', e.target.value)}>
            <option value="">Todas</option>
            {opcoes.unidades.map((o) => (<option key={o.id} value={o.id}>{o.nome}</option>))}
          </select>
        </label>
      </div>

      {carregando ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-20" />))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Avaliações no período" value={filtradas.length} icon={ClipboardCheck} color="primary" />
          <StatCard title="Aproveitamento médio" value={pct(media)} icon={TrendingUp} color="success" />
          <StatCard title="Em andamento" value={emAndamento} icon={Clock} color="warning" />
          <StatCard title="Tarefas atrasadas" value={resumoPlano?.atrasadas ?? '—'} icon={ListChecks} color="error" />
        </div>
      )}

      <Tabs defaultValue="geral">
        <TabsList className="w-full justify-start overflow-x-auto print:hidden">
          <TabsTrigger value="geral">Visão geral</TabsTrigger>
          <TabsTrigger value="checklists">Checklists</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          <TabsTrigger value="unidades">Unidades</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Painel titulo="Avaliações por mês">
              {porMes.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma avaliação no período.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={porMes}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="mes" fontSize={12} />
                      <YAxis allowDecimals={false} fontSize={12} />
                      <RTooltip />
                      <Bar dataKey="total" name="Avaliações" fill={PRIMARY} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Painel>
            <Painel titulo="Plano de ação por prazo" acao={<Link href="/admin/planos-acao" className="text-sm font-medium text-primary">Ver tarefas</Link>}>
              {!resumoPlano || resumoPlano.atrasadas + resumoPlano.proximos7Dias + resumoPlano.futuras + resumoPlano.concluidas === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma tarefa cadastrada.</p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={[
                        { nome: 'Atrasadas', total: resumoPlano.atrasadas, cor: 'hsl(0 84% 60%)' },
                        { nome: 'Próx. 7 dias', total: resumoPlano.proximos7Dias, cor: 'hsl(38 92% 50%)' },
                        { nome: 'Futuras', total: resumoPlano.futuras, cor: PRIMARY },
                        { nome: 'Concluídas', total: resumoPlano.concluidas, cor: 'hsl(160 84% 39%)' },
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="nome" fontSize={12} />
                      <YAxis allowDecimals={false} fontSize={12} />
                      <RTooltip />
                      <Bar dataKey="total" name="Tarefas" radius={[4, 4, 0, 0]}>
                        {['hsl(0 84% 60%)', 'hsl(38 92% 50%)', PRIMARY, 'hsl(160 84% 39%)'].map((c) => (<Cell key={c} fill={c} />))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Painel>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Painel titulo="Últimas avaliações" acao={<Link href="/admin/auditorias" className="text-sm font-medium text-primary">Ver todas</Link>}>
                {filtradas.length === 0 ? (
                  <EmptyState icon={ClipboardCheck} title="Nenhuma avaliação" description="Ajuste o período ou inicie uma auditoria." />
                ) : (
                  <ul className="divide-y divide-border">
                    {filtradas.slice(0, 8).map((a) => (
                      <li key={a.id}>
                        <Link
                          href={a.status === 'finalizada' ? `/admin/auditoria/${a.id}/relatorio` : `/admin/auditoria/${a.id}`}
                          className="flex min-h-[52px] items-center gap-3 py-2 hover:bg-muted/40"
                        >
                          <span className="w-16 shrink-0 text-xs text-muted-foreground">{formatarDataBr(dataLocalISO(new Date(a.dataInicio)))}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{a.unidade?.nome}</span>
                            <span className="block truncate text-xs text-muted-foreground">
                              {a.consultor?.nome}
                              {a.totalFotos !== undefined && ` · ${a.totalFotos} foto(s)`}
                            </span>
                          </span>
                          {a.status === 'finalizada' ? (
                            <span className="text-sm font-semibold">{pct(Number(a.pontuacaoTotal || 0))}</span>
                          ) : (
                            <StatusChip status={a.status} />
                          )}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Painel>
            </div>
            <Painel titulo="Próximas visitas" acao={<Link href="/admin/agenda" className="text-sm font-medium text-primary">Agenda</Link>}>
              {agendas.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">Nada agendado.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {agendas.map((g) => {
                    const atrasada = g.dataPrevista.slice(0, 10) < dataLocalISO();
                    return (
                      <li key={g.id} className="flex min-h-[48px] items-center gap-3 py-2 text-sm">
                        <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{g.unidade?.nome}</span>
                        <span className={atrasada ? 'font-semibold text-destructive' : 'text-muted-foreground'}>{formatarDataBr(g.dataPrevista)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Painel>
          </div>
        </TabsContent>

        <TabsContent value="checklists">
          <Painel titulo="Desempenho por checklist">
            {checklists.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Nenhuma avaliação no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-2 font-medium">Checklist</th>
                      <th className="px-2 py-2 text-right font-medium">Avaliações</th>
                      <th className="px-2 py-2 text-right font-medium">Finalizadas</th>
                      <th className="py-2 pl-2 text-right font-medium">Média</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {checklists.map((c) => (
                      <tr key={c.id} className="h-11">
                        <td className="pr-2">{c.nome}</td>
                        <td className="px-2 text-right">{c.total}</td>
                        <td className="px-2 text-right">{c.finalizadas}</td>
                        <td className="pl-2 text-right font-semibold">{pct(c.media)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Painel>
        </TabsContent>

        <TabsContent value="equipe">
          <Painel titulo="Avaliações por pessoa">
            {avaliadores.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">Nenhuma avaliação no período.</p>
            ) : (
              <ul className="space-y-3">
                {avaliadores.map((r, i) => (
                  <li key={r.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>
                        {i + 1}. {r.nome}
                      </span>
                      <span className="font-semibold">{r.total}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(r.total / maxAvaliador) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </TabsContent>

        <TabsContent value="unidades">
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { titulo: 'Melhor aproveitamento', lista: unidades.slice(0, 5) },
              { titulo: 'Pior aproveitamento', lista: [...unidades].reverse().slice(0, 5) },
            ].map((bloco) => (
              <Painel key={bloco.titulo} titulo={bloco.titulo}>
                {bloco.lista.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">Nenhuma auditoria finalizada no período.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="py-2 pr-2 font-medium">Unidade</th>
                        <th className="px-2 py-2 text-right font-medium">Última</th>
                        <th className="py-2 pl-2 text-right font-medium">Média</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {bloco.lista.map((u, i) => (
                        <tr key={u.id} className="h-11">
                          <td className="max-w-[12rem] truncate pr-2">
                            {i + 1}. {u.nome}
                          </td>
                          <td className="px-2 text-right">{pct(u.ultima)}</td>
                          <td className="pl-2 text-right font-semibold">{pct(u.media)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Painel>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Substituir `apps/web/src/app/admin/dashboard/page.tsx` por:**

```tsx
'use client';

import { AppLayout } from '@/components';
import { InicioAuditor } from '@/components/inicio/inicio-auditor';
import { InicioGestor } from '@/components/inicio/inicio-gestor';
import { PerfilUsuario, useAuthStore } from '@/lib/store';

export default function DashboardPage() {
  const { usuario } = useAuthStore();
  return <AppLayout>{usuario?.perfil === PerfilUsuario.AUDITOR ? <InicioAuditor /> : <InicioGestor />}</AppLayout>;
}
```

- [ ] **Step 3: Verificar e commitar**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: sem erros.

```bash
git add apps/web/src/components/inicio/inicio-gestor.tsx apps/web/src/app/admin/dashboard/page.tsx
git commit -m "Reorganizar Início do gestor em indicadores e abas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Relatório da auditoria em abas

**Files:**
- Modify: `apps/web/src/app/admin/auditoria/[id]/relatorio/page.tsx` (somente o `return` da visualização normal, a partir de `<PageHeader title="Relatório de Auditoria" />`; modo PDF intacto)

**Interfaces:**
- Consumes: variáveis existentes (`auditoria`, `metricasGerais`, `aproveitamentoSeguro`, `gruposMetricas`, `historicoEvolucao`, `resumoExecutivo`, `resumoDesatualizado`, `mostrarBotaoGerarResumo`, `gerandoResumo`, `gerarResumoExecutivo`, `handleGerarTarefas`, `handleBaixarPdf`, `baixandoPdf`, `getClassificacao`, `getRiscoLabel`, `setFotoModal`, `formatDate`, `id`); E1 (`StatCard`, `Tabs*`, `Button`, `EmptyState`).

- [ ] **Step 1: Cabeçalho**

Substituir `<PageHeader title="Relatório de Auditoria" />` e o bloco `{/* Cabeçalho */}` (o primeiro card, com Voltar/Gerar plano/Exportar e dados da unidade) por:

```tsx
      <PageHeader
        title={auditoria.unidade?.nome || 'Relatório'}
        subtitle={`${auditoria.unidade?.cliente?.nomeFantasia || auditoria.unidade?.cliente?.razaoSocial || ''} · ${formatDate(auditoria.dataInicio)}`}
        backHref="/admin/auditorias"
        action={
          <>
            <Button variant="outline" className="hidden sm:inline-flex" onClick={handleGerarTarefas}>
              <ListChecks className="h-4 w-4" />
              Gerar plano de ação
            </Button>
            <Button variant="outline" size="icon" className="h-11 w-11 sm:hidden" onClick={handleGerarTarefas} aria-label="Gerar plano de ação">
              <ListChecks className="h-4 w-4" />
            </Button>
            <Button onClick={handleBaixarPdf} disabled={baixandoPdf}>
              {baixandoPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="hidden sm:inline">Exportar PDF</span>
              <span className="sm:hidden">PDF</span>
            </Button>
          </>
        }
      />
      <div className="space-y-4 px-4 py-4 lg:px-8">
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>Auditor: {auditoria.consultor?.nome || 'Não informado'}</span>
          <span>Checklist: {auditoria.template?.nome}</span>
        </p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title={`Aproveitamento · ${getClassificacao(aproveitamentoSeguro)}`} value={`${aproveitamentoSeguro.toFixed(1).replace('.', ',')}%`} icon={TrendingUp} color="primary" />
          <StatCard title={`Pontos (de ${metricasGerais.pontosPossiveis})`} value={metricasGerais.pontosRealizados} icon={CheckCircle2} color="success" />
          <StatCard title="Não conformidades" value={metricasGerais.naoConformidades} icon={XCircle} color="error" />
          <StatCard title="Não aplicáveis" value={metricasGerais.naoAplicaveis} icon={MinusCircle} color="info" />
        </div>
```

(remover a `div` de abertura `<div className="px-4 py-4 lg:px-8 space-y-4">` original, substituída pela de cima).

- [ ] **Step 2: Abas**

Logo após os KPIs, abrir:

```tsx
        <Tabs defaultValue="resumo">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="nc">Não conformidades ({metricasGerais.naoConformidades})</TabsTrigger>
            <TabsTrigger value="itens">Itens</TabsTrigger>
            <TabsTrigger value="evolucao">Evolução</TabsTrigger>
          </TabsList>
```

E distribuir os blocos existentes, **movidos sem alteração de lógica**:

- `<TabsContent value="resumo" className="space-y-4">`: o card `{/* Métricas Gerais */}` **sem** os três `stat` iniciais (a `div className="grid grid-cols-1 sm:grid-cols-3 …"` com Aproveitamento/Pontos/NC sai, pois virou KPIs) e com o título trocado para "Desempenho por grupo"; em seguida o card `{/* Resumo Executivo */}`.
- `<TabsContent value="nc">`: novo conteúdo:

```tsx
            {gruposMetricas.every((g) => g.itens.every((i) => i.resposta !== RespostaItem.NAO_CONFORME)) ? (
              <EmptyState icon={CheckCircle2} title="Nenhuma não conformidade" description="Todos os itens avaliados estão conformes ou não se aplicam." />
            ) : (
              <div className="space-y-4">
                {gruposMetricas.map((grupo) => {
                  const ncs = grupo.itens.filter((i) => i.resposta === RespostaItem.NAO_CONFORME);
                  if (ncs.length === 0) return null;
                  return (
                    <section key={grupo.grupoId} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                      <h3 className="mb-3 font-display font-semibold">{grupo.nome}</h3>
                      <ul className="space-y-3">
                        {ncs.map((item) => (
                          <li key={item.id} className="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm">
                            <p className="font-medium">{item.templateItem?.pergunta}</p>
                            {item.observacao && <p className="mt-1 text-muted-foreground">Observação: {item.observacao}</p>}
                            {item.descricaoIa && <p className="mt-1 text-muted-foreground">Análise da imagem: {item.descricaoIa}</p>}
                            {item.fotos?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {item.fotos.map((foto) => (
                                  <button key={foto.id} type="button" onClick={() => setFotoModal({ url: foto.url, exif: foto.exif ?? undefined })} className="overflow-hidden rounded-md border border-border">
                                    <img src={foto.url} alt="Foto do item" className="h-16 w-16 object-cover" />
                                  </button>
                                ))}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
```

- `<TabsContent value="itens">`: o bloco `{/* Detalhamento por Grupo */}` inteiro.
- `<TabsContent value="evolucao">`: o card `{/* Histórico de evolução */}`.

Fechar `</Tabs>` e a `div` da página antes do `<FormModal>` da foto.

- [ ] **Step 3: Classes DaisyUI nos blocos movidos**

Nos blocos movidos, trocar: `card bg-base-100 shadow-sm border border-base-300` → `rounded-lg border border-border bg-card shadow-sm`; `card-body p-4 sm:p-6` → `p-4 sm:p-6`; `text-base-content/60` → `text-muted-foreground`; `alert alert-warning` → `flex items-center gap-2 rounded-md bg-warning/15 p-3 text-sm`; botão "Gerar Resumo" → `<Button onClick={gerarResumoExecutivo} disabled={gerandoResumo} className="w-full sm:w-auto">`.

- [ ] **Step 4: Imports**

Adicionar `StatCard`, `EmptyState` ao import de `@/components`; `import { Button } from '@/components/ui/shadcn/button';`; `import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/shadcn/tabs';`. Remover imports que ficarem sem uso (`ArrowLeft`, `FileText`, `Building2`, `User`, `Calendar`, `Clock`), conferindo com `npx tsc --noEmit --noUnusedLocals`.

- [ ] **Step 5: Verificar e commitar**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: sem erros.

```bash
git add "apps/web/src/app/admin/auditoria/[id]/relatorio/page.tsx"
git commit -m "Organizar relatório da auditoria em indicadores e abas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Planos de ação, agenda, relatórios técnicos e check-ins no novo visual

**Files:**
- Modify: `apps/web/src/app/admin/planos-acao/page.tsx`, `apps/web/src/app/admin/agenda/page.tsx`, `apps/web/src/app/admin/relatorios-tecnicos/page.tsx`, `apps/web/src/app/admin/checkins/page.tsx`

**Interfaces:**
- Consumes: E1 (`Button`, `Input`, `StatusChip`, `Skeleton`).

- [ ] **Step 1: Planos de ação**
  - Remover `BADGE_STATUS`; coluna Status: `render: (t) => <StatusChip status={estaAtrasada(t) ? 'atrasada' : t.status} label={estaAtrasada(t) ? 'Atrasada' : STATUS_TAREFA_LABELS[t.status]} />`.
  - Ação do cabeçalho: `<Button onClick={abrirNovo}><Plus className="h-4 w-4" />Nova tarefa</Button>`.
  - Rodapé do modal: `<Button variant="ghost" onClick={() => setModalAberto(false)}>Cancelar</Button>` e `<Button onClick={salvar} disabled={salvando}>{salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}</Button>` (import `Loader2`).
  - Campos do modal: `input input-bordered` → `<Input …/>`; `textarea textarea-bordered` → `<Textarea …/>`; `select select-bordered` → `className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm"`; rótulos `label-text` → `text-sm font-medium`; `form-control` → `flex flex-col gap-1.5`.
- [ ] **Step 2: Agenda** — mesmas trocas (remover `BADGE`; status com `StatusChip status={atrasada(a) ? 'atrasada' : a.status}`; botões e campos como no Step 1).
- [ ] **Step 3: Relatórios técnicos** — ação `<Button asChild><Link href="/admin/relatorios-tecnicos/novo"><Plus className="h-4 w-4" />Novo relatório</Link></Button>`; busca com `<Input className="h-11 pl-9" …/>`; trocar o dropdown de status por `select` (`h-11 rounded-md border border-input bg-card px-3 text-sm`) com Todos/Rascunho/Finalizado; loading com 4 `Skeleton h-24`; cards `rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/40`; status `<StatusChip status={relatorio.status === 'finalizado' ? 'finalizada' : 'rascunho'} label={relatorio.status === 'finalizado' ? 'Finalizado' : 'Rascunho'} />`; consultora como texto `text-xs text-muted-foreground`; remover `motion` se ficar sem uso.
- [ ] **Step 4: Check-ins** — status `<StatusChip status={c.status === 'aberto' ? 'em_andamento' : 'concluida'} label={c.status === 'aberto' ? 'Aberto' : 'Fechado'} />` e "Auto" como `<StatusChip status="neutro" label="Automático" />`; botão "Relatório de horas" como `<Button asChild>`; botão Fechar do modal como `<Button variant="ghost">`.
- [ ] **Step 5: Verificar e commitar**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: sem erros.

```bash
git add apps/web/src/app/admin/planos-acao/page.tsx apps/web/src/app/admin/agenda/page.tsx apps/web/src/app/admin/relatorios-tecnicos/page.tsx apps/web/src/app/admin/checkins/page.tsx
git commit -m "Aplicar novo visual em planos de ação, agenda, relatórios técnicos e check-ins

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Busca global encontra auditorias (TDD)

**Files:**
- Modify: `apps/web/src/components/layout/navegacao.ts` (+ teste em `navegacao.test.ts`)
- Modify: `apps/web/src/components/layout/busca-global.tsx`

**Interfaces:**
- Produces: `interface ResultadoBusca { id: string; titulo: string; detalhe: string; href: string; termos: string }`; `itensBuscaAuditorias(lista: Auditoria[]): ResultadoBusca[]`.

- [ ] **Step 1: Teste (append em `navegacao.test.ts`)**

```ts
describe('itensBuscaAuditorias', () => {
  it('monta título, detalhe, link e termos de busca', () => {
    const [r] = itensBuscaAuditorias([
      {
        id: 'a1',
        status: 'finalizada',
        dataInicio: '2026-10-07T12:00:00Z',
        unidade: { nome: 'Loja Centro', cliente: { nomeFantasia: 'Padaria São João' } },
        template: { nome: 'Boas Práticas' },
      } as never,
    ]);
    expect(r.href).toBe('/admin/auditoria/a1/relatorio');
    expect(r.titulo).toBe('Loja Centro');
    expect(r.detalhe).toContain('Boas Práticas');
    expect(filtroBusca(r.termos, 'sao joao')).toBe(1);
  });
  it('em andamento aponta para a execução', () => {
    const [r] = itensBuscaAuditorias([{ id: 'a2', status: 'em_andamento', dataInicio: '2026-10-07T12:00:00Z', unidade: { nome: 'X' } } as never]);
    expect(r.href).toBe('/admin/auditoria/a2');
  });
});
```

(adicionar `itensBuscaAuditorias` ao import do teste)

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run src/components/layout/navegacao.test.ts`
Expected: FAIL — `itensBuscaAuditorias is not a function`.

- [ ] **Step 3: Implementar em `navegacao.ts`**

```ts
import type { Auditoria } from '@/lib/api';

export interface ResultadoBusca {
  id: string;
  titulo: string;
  detalhe: string;
  href: string;
  termos: string;
}

export function itensBuscaAuditorias(lista: Auditoria[]): ResultadoBusca[] {
  return lista.map((a) => {
    const cliente = a.unidade?.cliente?.nomeFantasia || a.unidade?.cliente?.razaoSocial || '';
    const data = new Date(a.dataInicio).toLocaleDateString('pt-BR');
    return {
      id: a.id,
      titulo: a.unidade?.nome ?? 'Auditoria',
      detalhe: [cliente, a.template?.nome, data].filter(Boolean).join(' · '),
      href: a.status === 'finalizada' ? `/admin/auditoria/${a.id}/relatorio` : `/admin/auditoria/${a.id}`,
      termos: [a.unidade?.nome, cliente, a.template?.nome, data].filter(Boolean).join(' '),
    };
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run src/components/layout/navegacao.test.ts`
Expected: PASS.

- [ ] **Step 5: Usar na `BuscaGlobal`**

Adicionar estado `const [auditorias, setAuditorias] = useState<ResultadoBusca[] | null>(null);` e, quando `open` virar `true` pela primeira vez, carregar:

```tsx
  useEffect(() => {
    if (!open || auditorias !== null) return;
    auditoriaService
      .listar(1, 100)
      .then((r) => setAuditorias(itensBuscaAuditorias(r.items || [])))
      .catch(() => setAuditorias([]));
  }, [open, auditorias]);
```

(hooks antes do `if (!usuario) return null;`). Após o grupo "Conta", renderizar:

```tsx
        {auditorias && auditorias.length > 0 && (
          <CommandGroup heading="Auditorias">
            {auditorias.map((r) => (
              <CommandItem key={r.id} value={`${r.termos} ${r.id}`} onSelect={() => ir(r.href)}>
                <ClipboardCheck className="h-4 w-4" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{r.titulo}</span>
                  <span className="block truncate text-xs text-muted-foreground">{r.detalhe}</span>
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
```

Imports: `useEffect, useState` de `react`; `ClipboardCheck` de `lucide-react`; `auditoriaService` de `@/lib/api`; `itensBuscaAuditorias, type ResultadoBusca` de `./navegacao`. Trocar placeholders para "Buscar telas, unidades ou clientes…" (aqui e na `Topbar`).

- [ ] **Step 6: Verificar e commitar**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: sem erros.

```bash
git add apps/web/src/components/layout
git commit -m "Busca global passa a encontrar auditorias por unidade, cliente ou checklist

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Verificação local

- [ ] **Step 1:** `cd apps/web && npx next build` — sai 0. Reiniciar `npm run dev` (o build sobrescreve `.next`).
- [ ] **Step 2: Checklist manual (375px e 1440px, GESTOR e AUDITOR)**
  - Início do gestor: filtros, 4 KPIs, abas trocam sem recarregar, período sem finalizadas mostra "—", imprimir oculta filtros/abas.
  - Relatório: KPIs, abas Resumo/Não conformidades/Itens/Evolução; PDF continua gerando; "Gerar plano de ação" funciona.
  - Modais (`FormModal`) abrem como folha no celular e centralizados no desktop; descarte só pede confirmação após digitar; `ConfirmDialog` acima do modal.
  - Listas com `CrudTable`/`CrudFiltros` (planos, agenda, check-ins, clientes, checklists): filtros recolhidos no celular com contagem; menu "⋯" não cortado.
  - ⌘K encontra uma auditoria digitando o nome do cliente sem acento.
- [ ] **Step 3:** validar com o usuário e publicar.

---

## Self-review (feito)

- Cobertura (spec 6 + pendências): Início Gestor 4 KPIs + abas ✔ (T3–T4); relatório com abas ✔ (T5); planos/agenda/relatórios técnicos/check-ins ✔ (T6); busca de entidades no ⌘K ✔ (T7); "hoje" UTC (minor da E2) ✔ (T1); `FormModal` substituído visualmente com regras preservadas ✔ (T2). Adiado: atalho de check-in na barra superior (FAB mantido no desktop — registrar ruling); telas de cadastro (clientes, checklists, equipe) ficam para a E4, mas já herdam `CrudTable`/`CrudFiltros`/`FormModal` novos.
- Tipos: `FiltroDashboard`, `ResultadoBusca`, `contarPreenchidos`, `dataLocalISO` consistentes.

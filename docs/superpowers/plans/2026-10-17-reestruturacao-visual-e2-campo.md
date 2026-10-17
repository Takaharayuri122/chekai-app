# Reestruturação visual — E2 Telas de campo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestruturar as telas de campo — Início do auditor, lista de auditorias, execução da auditoria (lista por seções + painel do item + revisão antes de finalizar) e nova auditoria — sobre o shell e os componentes da E1.

**Architecture:** Regras de apresentação viram módulos puros testados (`lib/auditoria/execucao.ts`, `lib/auditoria/listagem.ts`). A execução mantém todos os handlers existentes (resposta, fotos com IA sequencial, observação, finalizar) e o modal de documentação; muda só a estrutura: lista de seções recolhíveis à esquerda (desktop) / tela cheia (mobile) e painel do item à direita (desktop) / folha inferior (mobile). Início troca por perfil: AUDITOR vê "o que fazer agora"; GESTOR/MASTER mantêm o dashboard atual (reorganizado na E3).

**Tech Stack:** Next.js 15, React 18, Tailwind 3.4, shadcn/ui (E1), vaul, lucide-react, Vitest 2.

**Spec:** `docs/superpowers/specs/2026-10-17-reestruturacao-visual-web-design.md` (seções 5 e 6)

## Global Constraints

- Mesmas da E1 (cores/tokens, raio, sombras, tipografia, gutters, breakpoints, toque ≥44px, pt-BR sóbrio, sem `secondary`/`accent` em shadcn, sem classes com nomes DaisyUI).
- Execução: comportamento preservado — respostas salvam na hora com estado otimista; fotos enviadas e analisadas pela IA **em sequência**; máx. 5 fotos por item; regras `fotoObrigatoria`/`observacaoObrigatoria` por opção; imagem não relevante exige observação; auditoria finalizada é somente leitura.
- Modais com cabeçalho/rodapé fixos e confirmação de descarte somente após interação real.
- FAB de check-in continua oculto em `/admin/auditoria*`.
- Commits em pt-BR terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. Item com resposta personalizada (opções do template) ou campo customizado (texto/número/data/seleção) — o status por cor deve refletir a pontuação da opção / "respondido", e os controles de resposta devem continuar funcionando no painel; testado em `statusItem`.
2. Template sem grupos (itens sem `grupo` e sem `secao`) — deve virar uma única seção "Perguntas" na ordem original; testado em `agruparPorSecao`.
3. Auditoria finalizada aberta para consulta — nenhum controle de edição ativo, sem barra de finalização; coberto no Task 4 (prop `somenteLeitura`).
4. Finalizar com obrigatórias pendentes — a revisão lista as pendentes e bloqueia "Finalizar"; tocar numa pendente abre o item; testado em `pendenciasObrigatorias` e coberto no Task 4.
5. Navegação anterior/próxima nas extremidades (primeiro/último item) — botões desabilitados, sem erro; testado em `vizinhos`.

---

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/api/src/modules/auditoria/auditoria.service.ts` | Incluir relação `itens.templateItem.grupo` no detalhe |
| `apps/web/src/lib/auditoria/execucao.ts` (novo) | Agrupar por seção, status do item, progresso, pendências, vizinhos, pontuação de opção |
| `apps/web/src/lib/auditoria/execucao.test.ts` (novo) | Testes |
| `apps/web/src/lib/auditoria/listagem.ts` (novo) | Filtro da lista de auditorias e busca por texto sem acento |
| `apps/web/src/lib/auditoria/listagem.test.ts` (novo) | Testes |
| `apps/web/src/components/auditoria/execucao/respostas-item.tsx` (novo) | Controles de resposta (padrão, personalizada, customizada) |
| `apps/web/src/components/auditoria/execucao/lista-secoes.tsx` (novo) | Seções recolhíveis + linhas com status |
| `apps/web/src/components/auditoria/execucao/painel-item.tsx` (novo) | Detalhe do item: pergunta, respostas, documentação, anterior/próxima |
| `apps/web/src/components/auditoria/execucao/revisao-final.tsx` (novo) | Revisão antes de finalizar |
| `apps/web/src/app/admin/auditoria/[id]/page.tsx` | Usa os componentes acima; mantém handlers e modal de documentação |
| `apps/web/src/components/inicio/inicio-auditor.tsx` (novo) | Início do auditor |
| `apps/web/src/app/admin/dashboard/page.tsx` | Troca por perfil |
| `apps/web/src/app/admin/auditorias/page.tsx` | Nova listagem (cards mobile, tabela desktop, filtros em folha no mobile) |
| `apps/web/src/app/admin/auditoria/nova/page.tsx` | Wizard com busca e visual novo |

---

### Task 1: Grupos no detalhe da auditoria (API)

**Files:**
- Modify: `apps/api/src/modules/auditoria/auditoria.service.ts:181-190`

**Interfaces:**
- Produces: `GET /auditorias/:id` retorna `itens[].templateItem.grupo` (`{ id, nome, ordem, ... } | null`), compatível com clientes atuais (campo adicional).

- [ ] **Step 1: Adicionar relação**

No `findOne` de `buscarAuditoriaPorId`, após `'itens.templateItem',` inserir `'itens.templateItem.grupo',`.

- [ ] **Step 2: Verificar**

Run: `cd apps/api && npx tsc --noEmit && npx jest 2>&1 | tail -5`
Expected: sem erros; suítes passam.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/auditoria/auditoria.service.ts
git commit -m "Incluir grupo do item no detalhe da auditoria

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Regras de apresentação da execução (TDD)

**Files:**
- Create: `apps/web/src/lib/auditoria/execucao.ts`
- Test: `apps/web/src/lib/auditoria/execucao.test.ts`

**Interfaces:**
- Consumes: tipos `AuditoriaItem`, `TemplateItem` de `@/lib/api`.
- Produces:
  - `type StatusItem = 'pendente' | 'conforme' | 'nao_conforme' | 'neutro' | 'respondido'`
  - `estaRespondido(item: AuditoriaItem): boolean`
  - `getPontuacaoParaOpcao(item: AuditoriaItem, opcao: string): number | null | undefined`
  - `statusItem(item: AuditoriaItem): StatusItem`
  - `interface SecaoExecucao { id: string; nome: string; itens: AuditoriaItem[]; respondidos: number }`
  - `agruparPorSecao(itens: AuditoriaItem[]): SecaoExecucao[]`
  - `progresso(itens: AuditoriaItem[]): { respondidos: number; total: number; percentual: number }`
  - `pendenciasObrigatorias(itens: AuditoriaItem[]): AuditoriaItem[]`
  - `naoConformidades(itens: AuditoriaItem[]): AuditoriaItem[]`
  - `vizinhos(sequencia: AuditoriaItem[], id: string): { anterior: AuditoriaItem | null; proximo: AuditoriaItem | null; posicao: number }`

- [ ] **Step 1: Escrever os testes**

```ts
import { describe, expect, it } from 'vitest';
import type { AuditoriaItem } from '@/lib/api';
import {
  agruparPorSecao,
  estaRespondido,
  naoConformidades,
  pendenciasObrigatorias,
  progresso,
  statusItem,
  vizinhos,
} from './execucao';

let seq = 0;
function item(parcial: {
  resposta?: string;
  ordem?: number;
  obrigatorio?: boolean;
  grupo?: { id: string; nome: string; ordem: number } | null;
  secao?: string;
  opcoes?: string[];
  configs?: { valor: string; pontuacao?: number | null }[];
  tipoCustom?: string;
}): AuditoriaItem {
  seq += 1;
  return {
    id: `i${seq}`,
    resposta: parcial.resposta ?? '',
    observacao: '',
    descricaoNaoConformidade: '',
    descricaoIa: '',
    complementoDescricao: '',
    planoAcaoSugerido: '',
    referenciaLegal: '',
    fotos: [],
    templateItem: {
      id: `t${seq}`,
      pergunta: `Pergunta ${seq}`,
      ordem: parcial.ordem ?? seq,
      obrigatorio: parcial.obrigatorio ?? false,
      usarRespostasPersonalizadas: Boolean(parcial.opcoes),
      opcoesResposta: parcial.opcoes,
      opcoesRespostaConfig: parcial.configs,
      tipoRespostaCustomizada: parcial.tipoCustom,
      grupo: parcial.grupo ?? undefined,
      grupoId: parcial.grupo?.id,
      secao: parcial.secao,
    },
  } as unknown as AuditoriaItem;
}

describe('estaRespondido / statusItem', () => {
  it('vazio e nao_avaliado são pendentes', () => {
    expect(estaRespondido(item({ resposta: '' }))).toBe(false);
    expect(statusItem(item({ resposta: 'nao_avaliado' }))).toBe('pendente');
  });
  it('respostas padrão', () => {
    expect(statusItem(item({ resposta: 'conforme' }))).toBe('conforme');
    expect(statusItem(item({ resposta: 'nao_conforme' }))).toBe('nao_conforme');
    expect(statusItem(item({ resposta: 'nao_aplicavel' }))).toBe('neutro');
  });
  it('opção personalizada usa a pontuação configurada', () => {
    const configs = [
      { valor: 'Bom', pontuacao: 2 },
      { valor: 'Regular', pontuacao: 0 },
      { valor: 'Ruim', pontuacao: -1 },
    ];
    const opcoes = ['Bom', 'Regular', 'Ruim'];
    expect(statusItem(item({ resposta: 'Bom', opcoes, configs }))).toBe('conforme');
    expect(statusItem(item({ resposta: 'Regular', opcoes, configs }))).toBe('neutro');
    expect(statusItem(item({ resposta: 'Ruim', opcoes, configs }))).toBe('nao_conforme');
  });
  it('campo customizado preenchido é respondido', () => {
    expect(statusItem(item({ resposta: '12', tipoCustom: 'numero' }))).toBe('respondido');
  });
});

describe('agruparPorSecao', () => {
  it('agrupa por grupo na ordem do grupo e dos itens', () => {
    const g1 = { id: 'g1', nome: 'Higiene', ordem: 2 };
    const g2 = { id: 'g2', nome: 'Estrutura', ordem: 1 };
    const itens = [
      item({ grupo: g1, ordem: 2, resposta: 'conforme' }),
      item({ grupo: g2, ordem: 5 }),
      item({ grupo: g1, ordem: 1 }),
    ];
    const secoes = agruparPorSecao(itens);
    expect(secoes.map((s) => s.nome)).toEqual(['Estrutura', 'Higiene']);
    expect(secoes[1].itens.map((i) => i.templateItem.ordem)).toEqual([1, 2]);
    expect(secoes[1].respondidos).toBe(1);
  });
  it('sem grupo usa secao e, sem secao, "Perguntas"', () => {
    const secoes = agruparPorSecao([item({ secao: 'Cozinha', ordem: 1 }), item({ ordem: 2 })]);
    expect(secoes.map((s) => s.nome)).toEqual(['Cozinha', 'Perguntas']);
  });
  it('template sem grupos vira uma seção única na ordem original', () => {
    const secoes = agruparPorSecao([item({ ordem: 3 }), item({ ordem: 1 })]);
    expect(secoes).toHaveLength(1);
    expect(secoes[0].itens.map((i) => i.templateItem.ordem)).toEqual([1, 3]);
  });
});

describe('progresso, pendências e não conformidades', () => {
  const itens = [
    item({ resposta: 'conforme', obrigatorio: true }),
    item({ resposta: '', obrigatorio: true }),
    item({ resposta: 'nao_conforme' }),
    item({ resposta: 'nao_avaliado' }),
  ];
  it('calcula progresso', () => {
    expect(progresso(itens)).toEqual({ respondidos: 2, total: 4, percentual: 50 });
    expect(progresso([])).toEqual({ respondidos: 0, total: 0, percentual: 0 });
  });
  it('lista obrigatórias pendentes', () => {
    expect(pendenciasObrigatorias(itens)).toEqual([itens[1]]);
  });
  it('lista não conformidades', () => {
    expect(naoConformidades(itens)).toEqual([itens[2]]);
  });
});

describe('vizinhos', () => {
  const sequencia = [item({}), item({}), item({})];
  it('meio tem anterior e próximo', () => {
    const v = vizinhos(sequencia, sequencia[1].id);
    expect(v.anterior?.id).toBe(sequencia[0].id);
    expect(v.proximo?.id).toBe(sequencia[2].id);
    expect(v.posicao).toBe(2);
  });
  it('extremidades retornam null', () => {
    expect(vizinhos(sequencia, sequencia[0].id).anterior).toBeNull();
    expect(vizinhos(sequencia, sequencia[2].id).proximo).toBeNull();
  });
  it('id inexistente', () => {
    expect(vizinhos(sequencia, 'x')).toEqual({ anterior: null, proximo: null, posicao: 0 });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run src/lib/auditoria/execucao.test.ts`
Expected: FAIL — `Failed to load url ./execucao`.

- [ ] **Step 3: Implementar `apps/web/src/lib/auditoria/execucao.ts`**

```ts
import type { AuditoriaItem } from '@/lib/api';

export type StatusItem = 'pendente' | 'conforme' | 'nao_conforme' | 'neutro' | 'respondido';

export interface SecaoExecucao {
  id: string;
  nome: string;
  itens: AuditoriaItem[];
  respondidos: number;
}

const OPCOES_PADRAO = ['conforme', 'nao_conforme', 'nao_aplicavel', 'nao_avaliado'];

export function estaRespondido(item: AuditoriaItem): boolean {
  const r = item.resposta;
  return Boolean(r && r.trim() !== '' && r !== 'nao_avaliado');
}

/** Mesma regra usada hoje na tela: config explícita ou base da primeira opção menos a posição. */
export function getPontuacaoParaOpcao(item: AuditoriaItem, opcao: string): number | null | undefined {
  const t = item.templateItem;
  const configs = t?.opcoesRespostaConfig ?? [];
  const opcoes = t?.usarRespostasPersonalizadas && t?.opcoesResposta?.length ? t.opcoesResposta : OPCOES_PADRAO;
  const config = configs.find((c) => c.valor === opcao);
  if (typeof config?.pontuacao === 'number') return config.pontuacao;
  if (config?.pontuacao === null) return null;
  const idx = opcoes.indexOf(opcao);
  if (idx < 0) return undefined;
  const primeira = configs.find((c) => c.valor === opcoes[0]);
  const base = typeof primeira?.pontuacao === 'number' ? primeira.pontuacao : 1;
  return base - idx;
}

export function statusItem(item: AuditoriaItem): StatusItem {
  if (!estaRespondido(item)) return 'pendente';
  const t = item.templateItem;
  if (t?.tipoRespostaCustomizada) return 'respondido';
  if (t?.usarRespostasPersonalizadas && t.opcoesResposta?.length) {
    const p = getPontuacaoParaOpcao(item, item.resposta);
    if (typeof p !== 'number' || p === 0) return 'neutro';
    return p > 0 ? 'conforme' : 'nao_conforme';
  }
  if (item.resposta === 'conforme') return 'conforme';
  if (item.resposta === 'nao_conforme') return 'nao_conforme';
  return 'neutro';
}

function porOrdem(a: AuditoriaItem, b: AuditoriaItem): number {
  return (a.templateItem?.ordem ?? 0) - (b.templateItem?.ordem ?? 0);
}

export function agruparPorSecao(itens: AuditoriaItem[]): SecaoExecucao[] {
  const mapa = new Map<string, { secao: SecaoExecucao; ordemGrupo: number; primeiraOrdem: number }>();
  for (const it of [...itens].sort(porOrdem)) {
    const grupo = it.templateItem?.grupo;
    const id = grupo?.id ?? (it.templateItem?.secao ? `secao:${it.templateItem.secao}` : 'sem-secao');
    const nome = grupo?.nome ?? it.templateItem?.secao ?? 'Perguntas';
    const ordemGrupo = grupo ? grupo.ordem : Number.MAX_SAFE_INTEGER;
    if (!mapa.has(id)) {
      mapa.set(id, { secao: { id, nome, itens: [], respondidos: 0 }, ordemGrupo, primeiraOrdem: it.templateItem?.ordem ?? 0 });
    }
    const entrada = mapa.get(id)!;
    entrada.secao.itens.push(it);
    if (estaRespondido(it)) entrada.secao.respondidos += 1;
  }
  return Array.from(mapa.values())
    .sort((a, b) => a.ordemGrupo - b.ordemGrupo || a.primeiraOrdem - b.primeiraOrdem)
    .map((e) => e.secao);
}

export function progresso(itens: AuditoriaItem[]): { respondidos: number; total: number; percentual: number } {
  const respondidos = itens.filter(estaRespondido).length;
  const total = itens.length;
  return { respondidos, total, percentual: total ? Math.round((respondidos / total) * 100) : 0 };
}

export function pendenciasObrigatorias(itens: AuditoriaItem[]): AuditoriaItem[] {
  return itens.filter((i) => i.templateItem?.obrigatorio && !estaRespondido(i));
}

export function naoConformidades(itens: AuditoriaItem[]): AuditoriaItem[] {
  return itens.filter((i) => statusItem(i) === 'nao_conforme');
}

export function vizinhos(
  sequencia: AuditoriaItem[],
  id: string,
): { anterior: AuditoriaItem | null; proximo: AuditoriaItem | null; posicao: number } {
  const idx = sequencia.findIndex((i) => i.id === id);
  if (idx < 0) return { anterior: null, proximo: null, posicao: 0 };
  return { anterior: sequencia[idx - 1] ?? null, proximo: sequencia[idx + 1] ?? null, posicao: idx + 1 };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run src/lib/auditoria/execucao.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/auditoria/execucao.ts apps/web/src/lib/auditoria/execucao.test.ts
git commit -m "Adicionar regras de apresentação da execução da auditoria com testes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Componentes da execução

**Files:**
- Create: `apps/web/src/components/auditoria/execucao/respostas-item.tsx`
- Create: `apps/web/src/components/auditoria/execucao/lista-secoes.tsx`
- Create: `apps/web/src/components/auditoria/execucao/painel-item.tsx`
- Create: `apps/web/src/components/auditoria/execucao/revisao-final.tsx`

**Interfaces:**
- Consumes: Task 2 (todas as funções), E1 (`Button`, `ResponsiveDialog`, `Textarea`, `Input`, `cn`), `renderEmoji` de `@/lib/emoji`, `TipoRespostaCustomizada` de `@/lib/api`.
- Produces:
  - `RespostasItem({ item, valorCustomizado, somenteLeitura, onResponder, onAlterarCustomizado, onConfirmarCustomizado })`
    - `onResponder(valor: string): void`; `onAlterarCustomizado(valor: string): void` (digitação); `onConfirmarCustomizado(valor: string): void` (blur/seleção)
  - `ListaSecoes({ secoes, selecionadoId, destacados, onSelecionar })` — `destacados: Set<string>` (obrigatórias pendentes marcadas)
  - `PainelItem({ item, numero, total, anterior, proximo, somenteLeitura, respostas, onNavegar, onDocumentar })` — `respostas: React.ReactNode`, `onNavegar(id: string)`, `onDocumentar()`
  - `RevisaoFinal({ open, onOpenChange, pendentes, naoConformes, observacoes, onObservacoes, erro, finalizando, onIrParaItem, onFinalizar })`

- [ ] **Step 1: `respostas-item.tsx`**

```tsx
'use client';

import { CheckCircle2, MinusCircle, XCircle } from 'lucide-react';
import { TipoRespostaCustomizada, type AuditoriaItem } from '@/lib/api';
import { renderEmoji } from '@/lib/emoji';
import { cn } from '@/lib/cn';
import { getPontuacaoParaOpcao } from '@/lib/auditoria/execucao';
import { Input } from '@/components/ui/shadcn/input';
import { Textarea } from '@/components/ui/shadcn/textarea';

interface RespostasItemProps {
  item: AuditoriaItem;
  valorCustomizado: string;
  somenteLeitura: boolean;
  onResponder: (valor: string) => void;
  onAlterarCustomizado: (valor: string) => void;
  onConfirmarCustomizado: (valor: string) => void;
}

function classeSelecionada(pontuacao: number | null | undefined): string {
  if (typeof pontuacao !== 'number' || pontuacao === 0) return 'border-warning bg-warning/15 text-[hsl(32_95%_34%)]';
  return pontuacao > 0 ? 'border-success bg-success/12 text-[hsl(160_84%_28%)]' : 'border-destructive bg-destructive/12 text-[hsl(0_72%_45%)]';
}

const BOTAO = 'flex min-h-[48px] items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

export function RespostasItem({ item, valorCustomizado, somenteLeitura, onResponder, onAlterarCustomizado, onConfirmarCustomizado }: RespostasItemProps) {
  const t = item.templateItem;
  const valor = valorCustomizado === 'nao_avaliado' ? '' : valorCustomizado;

  if (t.tipoRespostaCustomizada === TipoRespostaCustomizada.TEXTO) {
    return (
      <Textarea
        rows={3}
        placeholder="Digite sua resposta…"
        value={valor}
        disabled={somenteLeitura}
        onChange={(e) => onAlterarCustomizado(e.target.value)}
        onBlur={(e) => onConfirmarCustomizado(e.target.value)}
      />
    );
  }
  if (t.tipoRespostaCustomizada === TipoRespostaCustomizada.NUMERO) {
    return (
      <Input
        type="number"
        inputMode="decimal"
        placeholder="Digite um número…"
        value={Number.isNaN(Number(valor)) ? '' : valor}
        disabled={somenteLeitura}
        onChange={(e) => onAlterarCustomizado(e.target.value)}
        onBlur={(e) => onConfirmarCustomizado(e.target.value)}
      />
    );
  }
  if (t.tipoRespostaCustomizada === TipoRespostaCustomizada.DATA) {
    return (
      <Input
        type="date"
        value={/^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : ''}
        disabled={somenteLeitura}
        onChange={(e) => onConfirmarCustomizado(e.target.value)}
      />
    );
  }
  if (t.tipoRespostaCustomizada === TipoRespostaCustomizada.SELECT) {
    const opcoes = t.opcoesResposta ?? [];
    return (
      <select
        className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm"
        value={opcoes.includes(valor) ? valor : ''}
        disabled={somenteLeitura}
        onChange={(e) => onConfirmarCustomizado(e.target.value)}
      >
        <option value="">Selecione uma opção</option>
        {opcoes.map((o) => (
          <option key={o} value={o}>
            {renderEmoji(o)}
          </option>
        ))}
      </select>
    );
  }

  if (t.usarRespostasPersonalizadas && t.opcoesResposta?.length) {
    return (
      <div className={cn('grid gap-2', t.opcoesResposta.length <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3')}>
        {t.opcoesResposta.map((opcao) => {
          const selecionada = item.resposta === opcao;
          return (
            <button
              key={opcao}
              type="button"
              disabled={somenteLeitura}
              onClick={() => onResponder(opcao)}
              className={cn(BOTAO, selecionada ? classeSelecionada(getPontuacaoParaOpcao(item, opcao)) : 'border-border bg-card hover:bg-muted')}
            >
              <span className="truncate">{renderEmoji(opcao)}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const padrao = [
    { valor: 'conforme', rotulo: 'Conforme', icone: CheckCircle2, cor: 'border-success bg-success/12 text-[hsl(160_84%_28%)]' },
    { valor: 'nao_conforme', rotulo: 'Não conforme', icone: XCircle, cor: 'border-destructive bg-destructive/12 text-[hsl(0_72%_45%)]' },
    { valor: 'nao_aplicavel', rotulo: 'N/A', icone: MinusCircle, cor: 'border-muted-foreground/40 bg-muted text-foreground' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {padrao.map(({ valor: v, rotulo, icone: Icone, cor }) => (
        <button
          key={v}
          type="button"
          disabled={somenteLeitura}
          onClick={() => onResponder(v)}
          className={cn(BOTAO, 'flex-col gap-1 sm:flex-row sm:gap-2', item.resposta === v ? cor : 'border-border bg-card hover:bg-muted')}
        >
          <Icone className="h-5 w-5" />
          <span className="text-xs sm:text-sm">{rotulo}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: `lista-secoes.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { Camera, ChevronDown, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/cn';
import { statusItem, type SecaoExecucao, type StatusItem } from '@/lib/auditoria/execucao';

const COR_STATUS: Record<StatusItem, string> = {
  pendente: 'border-2 border-muted-foreground/40 bg-transparent',
  conforme: 'bg-success',
  nao_conforme: 'bg-destructive',
  neutro: 'bg-muted-foreground/50',
  respondido: 'bg-info',
};

const ROTULO_STATUS: Record<StatusItem, string> = {
  pendente: 'Pendente',
  conforme: 'Conforme',
  nao_conforme: 'Não conforme',
  neutro: 'Não aplicável ou neutro',
  respondido: 'Respondido',
};

interface ListaSecoesProps {
  secoes: SecaoExecucao[];
  selecionadoId: string | null;
  destacados: Set<string>;
  onSelecionar: (id: string) => void;
}

export function ListaSecoes({ secoes, selecionadoId, destacados, onSelecionar }: ListaSecoesProps) {
  const [fechadas, setFechadas] = useState<Set<string>>(
    () => new Set(secoes.filter((s) => s.respondidos === s.itens.length && s.itens.length > 0).map((s) => s.id)),
  );
  let numero = 0;

  const alternar = (id: string) =>
    setFechadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  return (
    <div className="space-y-3">
      {secoes.map((secao) => {
        const aberta = !fechadas.has(secao.id);
        return (
          <section key={secao.id} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <button
              type="button"
              onClick={() => alternar(secao.id)}
              aria-expanded={aberta}
              className="flex min-h-[48px] w-full items-center justify-between gap-3 px-4 text-left"
            >
              <span className="font-semibold">{secao.nome}</span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                {secao.respondidos}/{secao.itens.length}
                <ChevronDown className={cn('h-4 w-4 transition-transform', aberta && 'rotate-180')} />
              </span>
            </button>
            {!aberta && secao.itens.forEach(() => (numero += 1))}
            {aberta && (
              <ul className="divide-y divide-border border-t border-border">
                {secao.itens.map((it) => {
                  numero += 1;
                  const status = statusItem(it);
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => onSelecionar(it.id)}
                        className={cn(
                          'flex min-h-[52px] w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/60',
                          selecionadoId === it.id && 'bg-primary/5',
                          destacados.has(it.id) && 'bg-destructive/5',
                        )}
                      >
                        <span className={cn('mt-1 h-3 w-3 shrink-0 rounded-full', COR_STATUS[status])} title={ROTULO_STATUS[status]} />
                        <span className="w-6 shrink-0 text-xs text-muted-foreground">{numero}</span>
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 text-sm">
                            {it.templateItem.pergunta}
                            {it.templateItem.obrigatorio && <span className="text-destructive"> *</span>}
                          </span>
                          {destacados.has(it.id) && <span className="text-xs font-medium text-destructive">Obrigatória pendente</span>}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
                          {it.fotos?.length > 0 && (
                            <span className="flex items-center gap-0.5 text-xs">
                              <Camera className="h-3.5 w-3.5" />
                              {it.fotos.length}
                            </span>
                          )}
                          {it.observacao && <MessageSquare className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

Nota: a linha `{!aberta && secao.itens.forEach(() => (numero += 1))}` mantém a numeração contínua quando a seção está fechada (retorna `undefined`, nada é renderizado).

- [ ] **Step 3: `painel-item.tsx`**

```tsx
'use client';

import { Camera, ChevronLeft, ChevronRight, MessageSquare, Sparkles } from 'lucide-react';
import type { AuditoriaItem } from '@/lib/api';
import { Button } from '@/components/ui/shadcn/button';

interface PainelItemProps {
  item: AuditoriaItem;
  numero: number;
  total: number;
  anterior: AuditoriaItem | null;
  proximo: AuditoriaItem | null;
  somenteLeitura: boolean;
  respostas: React.ReactNode;
  onNavegar: (id: string) => void;
  onDocumentar: () => void;
}

export function PainelItem({ item, numero, total, anterior, proximo, somenteLeitura, respostas, onNavegar, onDocumentar }: PainelItemProps) {
  const t = item.templateItem;
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Pergunta {numero} de {total}
            {t.obrigatorio && <span className="text-destructive"> · obrigatória</span>}
          </p>
          <h2 className="font-display text-lg font-semibold leading-snug">{t.pergunta}</h2>
          {t.legislacaoReferencia && <p className="text-xs text-info">{t.legislacaoReferencia}</p>}
        </div>

        {respostas}

        <div className="rounded-lg border border-border">
          <button
            type="button"
            onClick={onDocumentar}
            className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 text-left hover:bg-muted/60"
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              <Camera className="h-4 w-4 text-primary" />
              {somenteLeitura ? 'Ver fotos e observação' : 'Fotos e observação'}
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {item.fotos?.length > 0 && `${item.fotos.length} foto(s)`}
              {item.observacao && <MessageSquare className="h-3.5 w-3.5" />}
              {item.descricaoIa && <Sparkles className="h-3.5 w-3.5 text-primary" />}
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
          {(item.observacao || item.descricaoIa) && (
            <details className="border-t border-border px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-muted-foreground">Detalhes registrados</summary>
              <div className="mt-2 space-y-2">
                {item.descricaoIa && (
                  <p>
                    <span className="font-medium">Análise da imagem: </span>
                    {item.descricaoIa}
                  </p>
                )}
                {item.observacao && (
                  <p>
                    <span className="font-medium">Observação: </span>
                    {item.observacao}
                  </p>
                )}
                {item.referenciaLegal && <p className="text-info">{item.referenciaLegal}</p>}
              </div>
            </details>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
        <Button variant="outline" className="h-11 flex-1" disabled={!anterior} onClick={() => anterior && onNavegar(anterior.id)}>
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>
        <Button className="h-11 flex-1" disabled={!proximo} onClick={() => proximo && onNavegar(proximo.id)}>
          Próxima
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `revisao-final.tsx`**

```tsx
'use client';

import { AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import type { AuditoriaItem } from '@/lib/api';
import { Button } from '@/components/ui/shadcn/button';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { ResponsiveDialog } from '@/components/ui/responsive-dialog';

interface RevisaoFinalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendentes: AuditoriaItem[];
  naoConformes: AuditoriaItem[];
  observacoes: string;
  onObservacoes: (valor: string) => void;
  erro: string;
  finalizando: boolean;
  onIrParaItem: (id: string) => void;
  onFinalizar: () => void;
}

export function RevisaoFinal({ open, onOpenChange, pendentes, naoConformes, observacoes, onObservacoes, erro, finalizando, onIrParaItem, onFinalizar }: RevisaoFinalProps) {
  const bloqueado = pendentes.length > 0;
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Revisar e finalizar"
      description="Confira as pendências antes de encerrar a auditoria."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button onClick={onFinalizar} disabled={bloqueado || finalizando}>
            {finalizando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Finalizar auditoria
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {bloqueado ? (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
              <AlertCircle className="h-4 w-4" />
              {pendentes.length} pergunta(s) obrigatória(s) sem resposta
            </p>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {pendentes.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onIrParaItem(p.id)} className="min-h-[48px] w-full px-3 py-2 text-left text-sm hover:bg-muted">
                    {p.templateItem.pergunta}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm font-medium text-[hsl(160_84%_28%)]">
            <CheckCircle2 className="h-4 w-4" />
            Todas as perguntas obrigatórias foram respondidas.
          </p>
        )}

        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <XCircle className="h-4 w-4 text-destructive" />
            {naoConformes.length} não conformidade(s)
          </p>
          {naoConformes.length > 0 && (
            <ul className="max-h-40 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {naoConformes.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => onIrParaItem(n.id)} className="min-h-[44px] w-full px-3 py-2 text-left text-sm hover:bg-muted">
                    {n.templateItem.pergunta}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="observacoes-gerais" className="text-sm font-medium">
            Observações gerais (opcional)
          </label>
          <Textarea id="observacoes-gerais" rows={4} value={observacoes} onChange={(e) => onObservacoes(e.target.value)} placeholder="Observações gerais…" />
        </div>

        {erro && <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>}
      </div>
    </ResponsiveDialog>
  );
}
```

- [ ] **Step 5: Verificar tipos**

Run: `cd apps/web && npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/auditoria/execucao
git commit -m "Adicionar componentes de seções, painel do item, respostas e revisão final

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Nova estrutura da tela de execução

**Files:**
- Modify: `apps/web/src/app/admin/auditoria/[id]/page.tsx`

**Interfaces:**
- Consumes: Task 2 e Task 3; `Drawer*` (E1) e `useMediaQuery` (E1).

- [ ] **Step 1: Imports e estado**

Adicionar imports:

```tsx
import { useMediaQuery } from '@/hooks/use-media-query';
import { Button } from '@/components/ui/shadcn/button';
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/shadcn/drawer';
import { ListaSecoes } from '@/components/auditoria/execucao/lista-secoes';
import { PainelItem } from '@/components/auditoria/execucao/painel-item';
import { RespostasItem } from '@/components/auditoria/execucao/respostas-item';
import { RevisaoFinal } from '@/components/auditoria/execucao/revisao-final';
import {
  agruparPorSecao,
  naoConformidades,
  pendenciasObrigatorias,
  progresso as calcularProgresso,
  vizinhos,
} from '@/lib/auditoria/execucao';
```

Remover estado/refs não usados: `expandedItem`, `itemRefs`, `scrollRealizado`, o `useEffect` de "Scroll automático até o último item respondido" e as funções `getProgresso`, `getObrigatoriasStatus`, `getPontuacaoParaOpcao`, `getClassePorPontuacao`, `getRespostaStyle`. Remover os `console.log` de `getOpcaoConfig`.

Adicionar estado:

```tsx
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [painelMobileAberto, setPainelMobileAberto] = useState(false);
```

Após `carregarAuditoria` resolver, no desktop selecionar o primeiro item pendente (ou o primeiro item). Adicionar efeito:

```tsx
  useEffect(() => {
    if (!auditoria || selecionadoId) return;
    const sequencia = agruparPorSecao(auditoria.itens).flatMap((s) => s.itens);
    const primeiroPendente = sequencia.find((i) => !i.resposta || i.resposta === 'nao_avaliado');
    setSelecionadoId((primeiroPendente ?? sequencia[0])?.id ?? null);
  }, [auditoria, selecionadoId]);
```

- [ ] **Step 2: Derivados antes do `return` principal** (substituem `progresso`/`obrigatoriasStatus`)

```tsx
  const somenteLeitura = auditoria.status === 'finalizada';
  const secoes = agruparPorSecao(auditoria.itens);
  const sequencia = secoes.flatMap((s) => s.itens);
  const resumo = calcularProgresso(auditoria.itens);
  const pendentes = pendenciasObrigatorias(auditoria.itens);
  const selecionado = sequencia.find((i) => i.id === selecionadoId) ?? null;
  const nav = selecionado ? vizinhos(sequencia, selecionado.id) : null;

  const selecionar = (itemId: string) => {
    setSelecionadoId(itemId);
    if (!desktop) setPainelMobileAberto(true);
  };

  const painel = selecionado && nav && (
    <PainelItem
      item={selecionado}
      numero={nav.posicao}
      total={sequencia.length}
      anterior={nav.anterior}
      proximo={nav.proximo}
      somenteLeitura={somenteLeitura}
      onNavegar={setSelecionadoId}
      onDocumentar={() => openPhotoModal(selecionado)}
      respostas={
        <RespostasItem
          item={selecionado}
          valorCustomizado={respostasCustomizadas[selecionado.id] ?? selecionado.resposta ?? ''}
          somenteLeitura={somenteLeitura}
          onResponder={(valor) => handleResposta(selecionado.id, valor)}
          onAlterarCustomizado={(valor) => setRespostasCustomizadas((prev) => ({ ...prev, [selecionado.id]: valor }))}
          onConfirmarCustomizado={(valor) => {
            if (valor !== (selecionado.resposta || '')) handleRespostaCustomizada(selecionado.id, valor);
          }}
        />
      }
    />
  );
```

- [ ] **Step 3: Substituir o JSX de "Progress" + "Items" (do comentário `{/* Progress */}` até o fechamento da `div` de itens, antes de `{/* Hidden file input */}`) por:**

```tsx
      <div className="sticky top-[calc(3.5rem+81px)] z-10 border-b border-border bg-card px-4 py-2 md:top-[calc(3.5rem+85px)] lg:px-8">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {resumo.respondidos}/{resumo.total} respondidas
          </span>
          <span className="font-semibold text-foreground">{resumo.percentual}%</span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${resumo.percentual}%` }} />
        </div>
      </div>

      <div className={`px-4 py-4 lg:px-8 ${somenteLeitura ? 'pb-8' : 'pb-40 md:pb-28'}`}>
        <div className="lg:grid lg:grid-cols-[minmax(320px,420px)_1fr] lg:gap-6">
          <ListaSecoes secoes={secoes} selecionadoId={selecionadoId} destacados={itensObrigatoriosNaoAvaliados} onSelecionar={selecionar} />
          {desktop && (
            <div className="sticky top-[calc(3.5rem+130px)] hidden max-h-[calc(100vh-14rem)] rounded-lg border border-border bg-card p-6 shadow-sm lg:block">
              {painel}
            </div>
          )}
        </div>
      </div>

      {!desktop && (
        <Drawer open={painelMobileAberto && Boolean(selecionado)} onOpenChange={setPainelMobileAberto}>
          <DrawerContent className="max-h-[92vh] px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <DrawerTitle className="sr-only">Pergunta da auditoria</DrawerTitle>
            <div className="h-[75vh] pt-2">{painel}</div>
          </DrawerContent>
        </Drawer>
      )}
```

Ruling previsto: os offsets `81px`/`85px` são a altura do `PageHeader` com voltar + subtítulo (mobile/desktop), mesma medida usada no fix da E1.

- [ ] **Step 4: Substituir o bloco "Botão flutuante Encerrar" e o segundo `FormModal` ("Encerrar Auditoria") por:**

```tsx
      {!somenteLeitura && (
        <div className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-6 md:left-auto md:right-8 md:px-0">
          <Button
            className="h-12 w-full shadow-lg md:w-auto md:px-6"
            variant={pendentes.length ? 'outline' : 'default'}
            onClick={() => {
              setItensObrigatoriosNaoAvaliados(new Set(pendentes.map((p) => p.id)));
              setShowFinalModal(true);
            }}
          >
            <CheckCircle className="h-5 w-5" />
            Revisar e finalizar
            {pendentes.length > 0 && <span className="ml-1 rounded-full bg-destructive px-2 text-xs text-white">{pendentes.length}</span>}
          </Button>
        </div>
      )}

      <RevisaoFinal
        open={showFinalModal}
        onOpenChange={(aberto) => {
          setShowFinalModal(aberto);
          if (!aberto) setErroFinalizar('');
        }}
        pendentes={pendentes}
        naoConformes={naoConformidades(auditoria.itens)}
        observacoes={observacoesGerais}
        onObservacoes={setObservacoesGerais}
        erro={erroFinalizar}
        finalizando={finalizando}
        onIrParaItem={(itemId) => {
          setShowFinalModal(false);
          selecionar(itemId);
        }}
        onFinalizar={handleFinalizar}
      />
```

- [ ] **Step 5: Ajustar `PageHeader`**

Trocar `backHref="/admin/dashboard"` por `backHref="/admin/auditorias"`. Na `action`, trocar `text-base-content/70` por `text-muted-foreground` e `text-success` por `text-[hsl(160_84%_28%)]`.

- [ ] **Step 6: Remover imports não usados**

Run: `cd apps/web && npx tsc --noEmit && npx next lint --file src/app/admin/auditoria/[id]/page.tsx`
Expected: sem erros de tipo; remover qualquer import apontado como não usado (`ChevronDown`, `ChevronUp`, `FileText`, `Edit3`, `AnimatePresence`, `motion`, `AlertTriangle`, `XCircle`, `MinusCircle`, `TipoRespostaCustomizada`, `renderEmoji` se não usados).

- [ ] **Step 7: Rodar testes**

Run: `cd apps/web && npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/admin/auditoria/[id]/page.tsx
git commit -m "Reestruturar execução da auditoria em seções com painel do item e revisão final

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Filtro da lista de auditorias e busca por texto (TDD)

**Files:**
- Create: `apps/web/src/lib/auditoria/listagem.ts`
- Test: `apps/web/src/lib/auditoria/listagem.test.ts`

**Interfaces:**
- Consumes: `normalizar` de `@/components/layout/navegacao`; tipo `Auditoria`.
- Produces:
  - `interface FiltrosAuditoria { status: 'todos' | 'em_andamento' | 'finalizada'; busca: string; de: string; ate: string; templateId: string; unidadeId: string; avaliadorId: string }`
  - `FILTROS_AUDITORIA_VAZIOS: FiltrosAuditoria`
  - `contarFiltrosAtivos(f: FiltrosAuditoria): number` (não conta `busca`)
  - `filtrarAuditorias(lista: Auditoria[], f: FiltrosAuditoria): Auditoria[]`
  - `contemTexto(alvo: string | undefined | null, termo: string): boolean`

- [ ] **Step 1: Testes**

```ts
import { describe, expect, it } from 'vitest';
import type { Auditoria } from '@/lib/api';
import { FILTROS_AUDITORIA_VAZIOS, contarFiltrosAtivos, contemTexto, filtrarAuditorias } from './listagem';

const aud = (p: Partial<{ id: string; status: string; dataInicio: string; unidade: string; cliente: string; template: string; consultor: string }>) =>
  ({
    id: p.id ?? 'a',
    status: p.status ?? 'em_andamento',
    dataInicio: p.dataInicio ?? '2026-10-10T12:00:00Z',
    unidade: { id: `u-${p.unidade ?? 'x'}`, nome: p.unidade ?? 'Loja Centro', cliente: { nomeFantasia: p.cliente ?? 'Padaria São João' } },
    template: { id: `t-${p.template ?? 'x'}`, nome: p.template ?? 'Boas Práticas' },
    consultor: { id: `c-${p.consultor ?? 'x'}`, nome: p.consultor ?? 'Ana' },
    itens: [],
  }) as unknown as Auditoria;

describe('contemTexto', () => {
  it('ignora acentos e maiúsculas', () => {
    expect(contemTexto('Padaria São João', 'sao joao')).toBe(true);
    expect(contemTexto(undefined, 'x')).toBe(false);
    expect(contemTexto('qualquer', '  ')).toBe(true);
  });
});

describe('filtrarAuditorias', () => {
  const lista = [
    aud({ id: '1', status: 'finalizada', cliente: 'Padaria São João', dataInicio: '2026-10-01T12:00:00Z' }),
    aud({ id: '2', status: 'em_andamento', unidade: 'Shopping', dataInicio: '2026-10-15T12:00:00Z', consultor: 'Bia' }),
  ];
  it('sem filtros retorna tudo', () => {
    expect(filtrarAuditorias(lista, FILTROS_AUDITORIA_VAZIOS)).toHaveLength(2);
  });
  it('filtra por status, busca, período e avaliador', () => {
    expect(filtrarAuditorias(lista, { ...FILTROS_AUDITORIA_VAZIOS, status: 'finalizada' }).map((a) => a.id)).toEqual(['1']);
    expect(filtrarAuditorias(lista, { ...FILTROS_AUDITORIA_VAZIOS, busca: 'shopping' }).map((a) => a.id)).toEqual(['2']);
    expect(filtrarAuditorias(lista, { ...FILTROS_AUDITORIA_VAZIOS, de: '2026-10-10' }).map((a) => a.id)).toEqual(['2']);
    expect(filtrarAuditorias(lista, { ...FILTROS_AUDITORIA_VAZIOS, ate: '2026-10-10' }).map((a) => a.id)).toEqual(['1']);
    expect(filtrarAuditorias(lista, { ...FILTROS_AUDITORIA_VAZIOS, avaliadorId: 'c-Bia' }).map((a) => a.id)).toEqual(['2']);
  });
});

describe('contarFiltrosAtivos', () => {
  it('conta filtros exceto busca', () => {
    expect(contarFiltrosAtivos(FILTROS_AUDITORIA_VAZIOS)).toBe(0);
    expect(contarFiltrosAtivos({ ...FILTROS_AUDITORIA_VAZIOS, busca: 'x', status: 'finalizada', de: '2026-01-01' })).toBe(2);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd apps/web && npx vitest run src/lib/auditoria/listagem.test.ts`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar `listagem.ts`**

```ts
import type { Auditoria } from '@/lib/api';
import { normalizar } from '@/components/layout/navegacao';

export interface FiltrosAuditoria {
  status: 'todos' | 'em_andamento' | 'finalizada';
  busca: string;
  de: string;
  ate: string;
  templateId: string;
  unidadeId: string;
  avaliadorId: string;
}

export const FILTROS_AUDITORIA_VAZIOS: FiltrosAuditoria = {
  status: 'todos',
  busca: '',
  de: '',
  ate: '',
  templateId: '',
  unidadeId: '',
  avaliadorId: '',
};

export function contemTexto(alvo: string | undefined | null, termo: string): boolean {
  const t = normalizar(termo);
  if (!t) return true;
  return normalizar(alvo ?? '').includes(t);
}

export function contarFiltrosAtivos(f: FiltrosAuditoria): number {
  return [f.status !== 'todos', f.de, f.ate, f.templateId, f.unidadeId, f.avaliadorId].filter(Boolean).length;
}

export function filtrarAuditorias(lista: Auditoria[], f: FiltrosAuditoria): Auditoria[] {
  const inicio = f.de ? new Date(`${f.de}T00:00:00`).getTime() : null;
  const fim = f.ate ? new Date(`${f.ate}T23:59:59`).getTime() : null;
  return lista.filter((a) => {
    const t = new Date(a.dataInicio).getTime();
    if (inicio !== null && t < inicio) return false;
    if (fim !== null && t > fim) return false;
    if (f.status !== 'todos' && a.status !== f.status) return false;
    if (f.templateId && a.template?.id !== f.templateId) return false;
    if (f.unidadeId && a.unidade?.id !== f.unidadeId) return false;
    if (f.avaliadorId && a.consultor?.id !== f.avaliadorId) return false;
    const cliente = a.unidade?.cliente?.nomeFantasia || a.unidade?.cliente?.razaoSocial;
    return contemTexto(a.unidade?.nome, f.busca) || contemTexto(cliente, f.busca) || contemTexto(a.template?.nome, f.busca);
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd apps/web && npx vitest run src/lib/auditoria/listagem.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/auditoria/listagem.ts apps/web/src/lib/auditoria/listagem.test.ts
git commit -m "Adicionar filtro da lista de auditorias com busca sem acento e testes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Nova lista de auditorias

**Files:**
- Modify (reescrever): `apps/web/src/app/admin/auditorias/page.tsx`

**Interfaces:**
- Consumes: Task 5; E1 (`PageHeader`, `EmptyState`, `StatusChip`, `ResponsiveDialog`, `Button`, `Input`, `Skeleton`, `DropdownMenu*`); `ConfirmDialog`; `auditoriaService` (`listar`, `reabrir`, `remover`).

- [ ] **Step 1: Reescrever a página**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardCheck, MoreHorizontal, Plus, RotateCcw, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { AppLayout, ConfirmDialog, EmptyState, PageHeader, ResponsiveDialog, StatusChip } from '@/components';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/shadcn/dropdown-menu';
import { auditoriaService, type Auditoria } from '@/lib/api';
import { toastService } from '@/lib/toast';
import { useAuthStore, PerfilUsuario } from '@/lib/store';
import { FILTROS_AUDITORIA_VAZIOS, contarFiltrosAtivos, filtrarAuditorias, type FiltrosAuditoria } from '@/lib/auditoria/listagem';

const POR_PAGINA = 20;
const SELECT = 'h-10 w-full rounded-md border border-input bg-card px-3 text-sm';

const hrefAuditoria = (a: Auditoria) => (a.status === 'finalizada' ? `/admin/auditoria/${a.id}/relatorio` : `/admin/auditoria/${a.id}`);
const nomeCliente = (a: Auditoria) => a.unidade?.cliente?.nomeFantasia || a.unidade?.cliente?.razaoSocial || '';
const dataCurta = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
const nota = (a: Auditoria) => (a.status === 'finalizada' && a.pontuacaoTotal !== undefined ? `${Number(a.pontuacaoTotal).toFixed(0)}%` : '—');

export default function AuditoriasPage() {
  const router = useRouter();
  const { usuario } = useAuthStore();
  const podeRemover = usuario?.perfil === PerfilUsuario.MASTER || usuario?.perfil === PerfilUsuario.GESTOR;
  const [auditorias, setAuditorias] = useState<Auditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState<FiltrosAuditoria>(FILTROS_AUDITORIA_VAZIOS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [limite, setLimite] = useState(POR_PAGINA);
  const [reabrirId, setReabrirId] = useState<string | null>(null);
  const [removerId, setRemoverId] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);

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
      setLoading(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const opcoes = useMemo(() => {
    const m = { templates: new Map<string, string>(), unidades: new Map<string, string>(), avaliadores: new Map<string, string>() };
    auditorias.forEach((a) => {
      if (a.template) m.templates.set(a.template.id, a.template.nome);
      if (a.unidade) m.unidades.set(a.unidade.id, a.unidade.nome);
      if (a.consultor) m.avaliadores.set(a.consultor.id, a.consultor.nome);
    });
    const lista = (x: Map<string, string>) => Array.from(x, ([id, nome]) => ({ id, nome }));
    return { templates: lista(m.templates), unidades: lista(m.unidades), avaliadores: lista(m.avaliadores) };
  }, [auditorias]);

  const filtradas = useMemo(() => filtrarAuditorias(auditorias, filtros), [auditorias, filtros]);
  const visiveis = filtradas.slice(0, limite);
  const ativos = contarFiltrosAtivos(filtros);
  const set = <K extends keyof FiltrosAuditoria>(k: K, v: FiltrosAuditoria[K]) => {
    setFiltros((f) => ({ ...f, [k]: v }));
    setLimite(POR_PAGINA);
  };

  const executar = async (acao: () => Promise<unknown>, msg: string, fechar: () => void) => {
    setProcessando(true);
    try {
      await acao();
      toastService.success(msg);
      fechar();
      await carregar();
    } catch {
      // erro tratado pelo interceptor
    } finally {
      setProcessando(false);
    }
  };

  const camposFiltro = (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <select aria-label="Status" className={SELECT} value={filtros.status} onChange={(e) => set('status', e.target.value as FiltrosAuditoria['status'])}>
        <option value="todos">Todos os status</option>
        <option value="em_andamento">Em andamento</option>
        <option value="finalizada">Finalizadas</option>
      </select>
      <Input type="date" aria-label="Data inicial" value={filtros.de} onChange={(e) => set('de', e.target.value)} />
      <Input type="date" aria-label="Data final" value={filtros.ate} onChange={(e) => set('ate', e.target.value)} />
      <select aria-label="Checklist" className={SELECT} value={filtros.templateId} onChange={(e) => set('templateId', e.target.value)}>
        <option value="">Todos os checklists</option>
        {opcoes.templates.map((o) => (<option key={o.id} value={o.id}>{o.nome}</option>))}
      </select>
      <select aria-label="Unidade" className={SELECT} value={filtros.unidadeId} onChange={(e) => set('unidadeId', e.target.value)}>
        <option value="">Todas as unidades</option>
        {opcoes.unidades.map((o) => (<option key={o.id} value={o.id}>{o.nome}</option>))}
      </select>
      <select aria-label="Avaliador" className={SELECT} value={filtros.avaliadorId} onChange={(e) => set('avaliadorId', e.target.value)}>
        <option value="">Todos os avaliadores</option>
        {opcoes.avaliadores.map((o) => (<option key={o.id} value={o.id}>{o.nome}</option>))}
      </select>
    </div>
  );

  const menuAcoes = (a: Auditoria) =>
    (a.status === 'finalizada' || podeRemover) && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10" aria-label="Ações" onClick={(e) => e.stopPropagation()}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {a.status === 'finalizada' && (
            <DropdownMenuItem onClick={() => setReabrirId(a.id)}>
              <RotateCcw className="h-4 w-4" />
              Reabrir
            </DropdownMenuItem>
          )}
          {podeRemover && (
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setRemoverId(a.id)}>
              <Trash2 className="h-4 w-4" />
              Remover
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );

  return (
    <AppLayout>
      <PageHeader
        title="Auditorias"
        subtitle={loading ? 'Carregando…' : `${filtradas.length} de ${auditorias.length} avaliações`}
        action={
          <Button asChild className="hidden md:inline-flex">
            <Link href="/admin/auditoria/nova">
              <Plus className="h-4 w-4" />
              Nova auditoria
            </Link>
          </Button>
        }
      />

      <div className="space-y-4 px-4 py-4 lg:px-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="h-11 pl-9" placeholder="Buscar por cliente, unidade ou checklist" value={filtros.busca} onChange={(e) => set('busca', e.target.value)} />
          </div>
          <Button variant="outline" className="h-11 lg:hidden" onClick={() => setFiltrosAbertos(true)}>
            <SlidersHorizontal className="h-4 w-4" />
            Filtros{ativos > 0 && ` (${ativos})`}
          </Button>
        </div>
        <div className="hidden lg:block">{camposFiltro}</div>
        {ativos > 0 && (
          <button type="button" className="text-sm font-medium text-primary" onClick={() => setFiltros({ ...FILTROS_AUDITORIA_VAZIOS, busca: filtros.busca })}>
            Limpar filtros
          </button>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (<Skeleton key={i} className="h-16 w-full" />))}
          </div>
        ) : filtradas.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Nenhuma auditoria encontrada"
            description={ativos || filtros.busca ? 'Ajuste a busca ou os filtros.' : 'Inicie sua primeira auditoria.'}
            actionLabel={ativos || filtros.busca ? undefined : 'Nova auditoria'}
            actionHref="/admin/auditoria/nova"
          />
        ) : (
          <>
            <ul className="space-y-2 lg:hidden">
              {visiveis.map((a) => (
                <li key={a.id}>
                  <Link href={hrefAuditoria(a)} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 shadow-sm active:bg-muted">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{a.unidade?.nome}</p>
                        <StatusChip status={a.status} />
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {nomeCliente(a)} · {a.template?.nome}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dataCurta(a.dataInicio)} · {a.consultor?.nome} · nota {nota(a)}
                      </p>
                    </div>
                    {menuAcoes(a)}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-sm lg:block">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Unidade</th>
                    <th className="px-4 py-3 font-medium">Checklist</th>
                    <th className="px-4 py-3 font-medium">Avaliador</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Nota</th>
                    <th className="w-12 px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visiveis.map((a) => (
                    <tr key={a.id} className="h-12 cursor-pointer hover:bg-muted/50" onClick={() => router.push(hrefAuditoria(a))}>
                      <td className="px-4">{dataCurta(a.dataInicio)}</td>
                      <td className="px-4">
                        <p className="font-medium">{a.unidade?.nome}</p>
                        <p className="text-xs text-muted-foreground">{nomeCliente(a)}</p>
                      </td>
                      <td className="px-4">{a.template?.nome}</td>
                      <td className="px-4">{a.consultor?.nome}</td>
                      <td className="px-4"><StatusChip status={a.status} /></td>
                      <td className="px-4 text-right font-semibold">{nota(a)}</td>
                      <td className="px-2" onClick={(e) => e.stopPropagation()}>{menuAcoes(a)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtradas.length > limite && (
              <div className="flex justify-center">
                <Button variant="outline" onClick={() => setLimite((l) => l + POR_PAGINA)}>
                  Carregar mais
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <ResponsiveDialog
        open={filtrosAbertos}
        onOpenChange={setFiltrosAbertos}
        title="Filtros"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFiltros({ ...FILTROS_AUDITORIA_VAZIOS, busca: filtros.busca })}>Limpar</Button>
            <Button onClick={() => setFiltrosAbertos(false)}>Ver {filtradas.length} resultado(s)</Button>
          </>
        }
      >
        {camposFiltro}
      </ResponsiveDialog>

      <ConfirmDialog
        open={reabrirId !== null}
        onClose={() => setReabrirId(null)}
        onConfirm={() => executar(() => auditoriaService.reabrir(reabrirId!), 'Auditoria reaberta.', () => setReabrirId(null))}
        title="Reabrir auditoria"
        message="A auditoria volta para em andamento e poderá ser editada. Deseja continuar?"
        confirmLabel="Reabrir"
        variant="warning"
        loading={processando}
      />
      <ConfirmDialog
        open={removerId !== null}
        onClose={() => setRemoverId(null)}
        onConfirm={() => executar(() => auditoriaService.remover(removerId!), 'Auditoria removida.', () => setRemoverId(null))}
        title="Remover auditoria"
        message="Esta ação não pode ser desfeita. Deseja remover a auditoria?"
        confirmLabel="Remover"
        loading={processando}
      />
    </AppLayout>
  );
}
```

Nota: no card mobile, o menu "⋯" fica dentro do `Link`; `onClick={(e) => e.stopPropagation()}` no gatilho e no conteúdo evita navegar. Se o clique ainda navegar na verificação manual, adicionar `e.preventDefault()` junto.

- [ ] **Step 2: Verificar**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: sem erros; testes passam.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/admin/auditorias/page.tsx
git commit -m "Redesenhar lista de auditorias com cards no celular, tabela no desktop e filtros em folha

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Início do auditor

**Files:**
- Create: `apps/web/src/components/inicio/inicio-auditor.tsx`
- Modify: `apps/web/src/app/admin/dashboard/page.tsx`

**Interfaces:**
- Consumes: `auditoriaService.listar`, `agendaService.listar(1, 50, 'agendada')`, `planoAcaoService.listar(1, 50)`, E1 (`Button`, `Skeleton`, `StatusChip`), `progresso` (Task 2) não é usado aqui (lista não traz respostas completas).
- Produces: `InicioAuditor()`; o dashboard renderiza `InicioAuditor` quando `usuario.perfil === AUDITOR`.

- [ ] **Step 1: `inicio-auditor.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, ChevronRight, ClipboardCheck, ListChecks, Plus } from 'lucide-react';
import { auditoriaService, type Auditoria } from '@/lib/api';
import { agendaService, type AgendaItem } from '@/lib/services/agenda.service';
import { planoAcaoService, type TarefaPlanoAcao } from '@/lib/services/plano-acao.service';
import { useAuthStore } from '@/lib/store';
import { Button } from '@/components/ui/shadcn/button';
import { Skeleton } from '@/components/ui/shadcn/skeleton';

const hoje = () => new Date().toISOString().slice(0, 10);
const dataBr = (d: string) => d.slice(0, 10).split('-').reverse().join('/');

function Bloco({ titulo, icone: Icone, href, children }: { titulo: string; icone: typeof ClipboardCheck; href: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between px-4 pt-4">
        <h2 className="flex items-center gap-2 font-display text-base font-semibold">
          <Icone className="h-4 w-4 text-primary" />
          {titulo}
        </h2>
        <Link href={href} className="text-sm font-medium text-primary">Ver tudo</Link>
      </div>
      <div className="p-2">{children}</div>
    </section>
  );
}

function Linha({ href, titulo, detalhe, destaque }: { href: string; titulo: string; detalhe: string; destaque?: boolean }) {
  return (
    <Link href={href} className="flex min-h-[52px] items-center gap-3 rounded-md px-2 py-2 hover:bg-muted">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{titulo}</p>
        <p className={destaque ? 'text-xs font-medium text-destructive' : 'text-xs text-muted-foreground'}>{detalhe}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

const Vazio = ({ texto }: { texto: string }) => <p className="px-2 py-4 text-sm text-muted-foreground">{texto}</p>;

export function InicioAuditor() {
  const { usuario } = useAuthStore();
  const [carregando, setCarregando] = useState(true);
  const [emAndamento, setEmAndamento] = useState<Auditoria[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [tarefas, setTarefas] = useState<TarefaPlanoAcao[]>([]);

  useEffect(() => {
    Promise.allSettled([auditoriaService.listar(1, 50), agendaService.listar(1, 50, 'agendada'), planoAcaoService.listar(1, 50)])
      .then(([a, g, t]) => {
        if (a.status === 'fulfilled') setEmAndamento((a.value.items || []).filter((x) => x.status === 'em_andamento').slice(0, 3));
        if (g.status === 'fulfilled') setAgenda(g.value.items.filter((x) => x.dataPrevista.slice(0, 10) <= hoje()).slice(0, 5));
        if (t.status === 'fulfilled')
          setTarefas(
            t.value.items
              .filter((x) => (x.status === 'pendente' || x.status === 'em_andamento') && x.prazo.slice(0, 10) < hoje())
              .slice(0, 5),
          );
      })
      .finally(() => setCarregando(false));
  }, []);

  return (
    <div className="space-y-4 px-4 py-4 lg:px-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Olá, {usuario?.nome?.split(' ')[0] ?? 'auditor'}</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <Button asChild size="lg" className="h-14 w-full text-base">
        <Link href="/admin/auditoria/nova">
          <Plus className="h-5 w-5" />
          Nova auditoria
        </Link>
      </Button>

      {carregando ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Bloco titulo="Continuar auditoria" icone={ClipboardCheck} href="/admin/auditorias">
            {emAndamento.length === 0 ? (
              <Vazio texto="Nenhuma auditoria em andamento." />
            ) : (
              emAndamento.map((a) => (
                <Linha key={a.id} href={`/admin/auditoria/${a.id}`} titulo={a.unidade?.nome ?? 'Unidade'} detalhe={`${a.template?.nome ?? ''} · iniciada em ${dataBr(a.dataInicio)}`} />
              ))
            )}
          </Bloco>
          <Bloco titulo="Hoje na agenda" icone={CalendarClock} href="/admin/agenda">
            {agenda.length === 0 ? (
              <Vazio texto="Nenhuma visita para hoje." />
            ) : (
              agenda.map((g) => {
                const atrasada = g.dataPrevista.slice(0, 10) < hoje();
                return (
                  <Linha key={g.id} href="/admin/auditoria/nova" titulo={g.unidade?.nome ?? 'Unidade'} detalhe={`${g.template?.nome ?? ''} · ${atrasada ? `atrasada desde ${dataBr(g.dataPrevista)}` : 'hoje'}`} destaque={atrasada} />
                );
              })
            )}
          </Bloco>
          <Bloco titulo="Tarefas atrasadas" icone={ListChecks} href="/admin/planos-acao">
            {tarefas.length === 0 ? (
              <Vazio texto="Nenhuma tarefa atrasada." />
            ) : (
              tarefas.map((t) => (
                <Linha key={t.id} href="/admin/planos-acao" titulo={t.titulo} detalhe={`Prazo ${dataBr(t.prazo)}`} destaque />
              ))
            )}
          </Bloco>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Troca por perfil no dashboard**

Em `apps/web/src/app/admin/dashboard/page.tsx`:
- Importar `import { InicioAuditor } from '@/components/inicio/inicio-auditor';` e `PerfilUsuario` de `@/lib/store`.
- Renomear o componente atual `DashboardPage` para `DashboardGestor` (sem `export default`).
- Adicionar ao final:

```tsx
export default function DashboardPage() {
  const { usuario } = useAuthStore();
  if (usuario?.perfil === PerfilUsuario.AUDITOR) {
    return (
      <AppLayout>
        <InicioAuditor />
      </AppLayout>
    );
  }
  return <DashboardGestor />;
}
```

- [ ] **Step 3: Verificar**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/inicio apps/web/src/app/admin/dashboard/page.tsx
git commit -m "Adicionar Início do auditor focado no que fazer agora

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Nova auditoria com busca e visual novo

**Files:**
- Modify: `apps/web/src/app/admin/auditoria/nova/page.tsx` (JSX de etapas; lógica de carga, localização e `handleIniciarAuditoria` mantida)

**Interfaces:**
- Consumes: `contemTexto` (Task 5), E1 (`Button`, `Input`, `PageHeader`, `EmptyState`).

- [ ] **Step 1: Estado de busca**

Adicionar `const [busca, setBusca] = useState('');` e limpar a busca a cada troca de etapa (em cada `setStep(n)` chamar também `setBusca('')`).

- [ ] **Step 2: Indicador de etapas**

Substituir `<ul className="steps steps-horizontal w-full mb-8">…</ul>` por:

```tsx
        <ol className="mb-6 flex items-center gap-2" aria-label="Etapas">
          {['Cliente', 'Unidade', 'Checklist', 'Confirmar'].map((rotulo, i) => {
            const n = i + 1;
            return (
              <li key={rotulo} className="flex flex-1 flex-col gap-1">
                <span className={`h-1.5 rounded-full ${step >= n ? 'bg-primary' : 'bg-muted'}`} />
                <span className={`text-xs ${step === n ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{rotulo}</span>
              </li>
            );
          })}
        </ol>
```

- [ ] **Step 3: Campo de busca nas etapas 1, 2 e 3**

No topo do conteúdo de cada uma das etapas 1–3 inserir:

```tsx
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-11 pl-9" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)} />
                </div>
```

E filtrar as listas: `clientes.filter((c) => contemTexto(c.nomeFantasia || c.razaoSocial, busca))`, `clienteSelecionado.unidades.filter((u) => contemTexto(u.nome, busca))`, `templates.filter((t) => contemTexto(t.nome, busca))`.

- [ ] **Step 4: Cards de opção**

Em cada item clicável das listas (cliente, unidade, checklist), trocar as classes `card bg-base-100 shadow-sm border border-base-300 …` / `card-body p-4 …` por um único `button` com:

```tsx
className="flex min-h-[64px] w-full items-center gap-4 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 active:bg-muted"
```

e os blocos vazios/resumo por `rounded-lg border border-border bg-card p-4 shadow-sm`. Botões `btn btn-primary`/`btn btn-ghost` viram `<Button>`/`<Button variant="ghost">` com `className="h-12"` nos de avançar/iniciar.

- [ ] **Step 5: Imports**

Adicionar `Search` ao import de `lucide-react`, `import { Button } from '@/components/ui/shadcn/button';`, `import { Input } from '@/components/ui/shadcn/input';`, `import { contemTexto } from '@/lib/auditoria/listagem';`.

- [ ] **Step 6: Verificar**

Run: `cd apps/web && npx tsc --noEmit && npx vitest run`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/admin/auditoria/nova/page.tsx
git commit -m "Redesenhar nova auditoria com busca e etapas no novo visual

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Verificação local

- [ ] **Step 1: Build**

Run: `cd apps/web && npx next build`
Expected: sai 0.

- [ ] **Step 2: Servidores locais rodando** (API `npm run dev` em `apps/api`, web `npm run dev` em `apps/web`).

- [ ] **Step 3: Checklist manual (375px e 1440px, AUDITOR e GESTOR)**
- Início do auditor mostra os 3 blocos e o botão grande; gestor continua vendo o dashboard.
- Lista: busca "sao joao" encontra "São João"; filtros abrem em folha no celular com contagem; tabela no desktop; "⋯" não navega; reabrir/remover pedem confirmação.
- Execução: seções com contagem; template sem grupos vira "Perguntas"; tocar item abre folha (mobile) / painel à direita (desktop); responder muda a cor da bolinha na hora; "Fotos e observação" abre o modal atual e o upload segue sequencial; Anterior/Próxima desabilitam nas pontas; "Revisar e finalizar" lista obrigatórias pendentes e bloqueia; tocar pendente abre o item; auditoria finalizada não mostra controles nem a barra.
- Nova auditoria: busca em cliente/unidade/checklist; etapas visíveis.

- [ ] **Step 4: Validar com o usuário e publicar** (merge na master + push após o "ok").

---

## Self-review (feito)

- Cobertura (spec 6): Início Auditor ✔ (T7), lista com cards/tabela/filtros em folha/carregar mais ✔ (T6), execução em seções + painel/folha + IA recolhida em "Detalhes registrados" + revisão final ✔ (T3–T4), nova auditoria ✔ (T8), estados de carregamento/vazio ✔ (T6/T7). Pendências herdadas da E1: botão "Encerrar" ignorando sidebar ✔ resolvido (T4 substitui por barra à direita no desktop). Adiado para E3: busca de entidades no ⌘K, atalho de check-in na barra superior (o FAB continua no Início).
- Desvio da spec: Task 1 altera a API (relação adicional, retrocompatível) — necessário para agrupar por seção; registrar como ruling.
- Tipos: `StatusItem`, `SecaoExecucao`, `vizinhos`, `progresso`, `FiltrosAuditoria`, `contemTexto` consistentes entre tasks.

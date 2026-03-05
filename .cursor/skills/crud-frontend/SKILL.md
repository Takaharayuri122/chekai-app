---
name: crud-frontend
description: Padroniza a criação de páginas CRUD no frontend Next.js com DaisyUI. Usa os componentes CrudFiltros e CrudTable para filtros com Pesquisar/Limpar e tabela flat com menu hamburger. Use quando o usuário pedir para criar uma página de listagem, CRUD, tela administrativa, ou qualquer tela que envolva filtros e listagem de registros.
---

# CRUD Frontend - Padrão de Implementação

## Estado Inicial

O `CrudFiltros` dispara automaticamente `onLimpar` ao montar, carregando os **primeiros 20 registros** com a ordenação padrão do banco. Não é necessário `useEffect` na página.

O fluxo completo é:

1. **Componente monta** → `CrudFiltros` chama `onLimpar()` automaticamente → exibe os primeiros registros
2. **Usuário preenche filtros** → clica "Pesquisar" → carrega dados filtrados → botão vira "Limpar"
3. **Usuário clica "Limpar"** → reseta filtros → recarrega os primeiros registros

```tsx
const carregarDados = async (filtros?: FiltrosType) => {
  setLoading(true);
  try {
    const response = await service.listar(filtros);
    setDados(response.items);
  } catch { /* interceptor */ } finally {
    setLoading(false);
  }
};
```

## Estrutura Obrigatória

```
AppLayout
├── PageHeader (título + subtítulo + ação)
├── Container (px-4 py-4 lg:px-8 space-y-4)
│   ├── CrudFiltros (filtros + Pesquisar/Limpar)
│   ├── CrudTable (loading + empty + tabela + ações)
│   └── Paginação (se aplicável)
└── Modais (criação, edição, ConfirmDialog)
```

## 1. PageHeader

```tsx
<PageHeader
  title="Nome do Recurso"
  subtitle="Descrição breve da seção"
  action={
    <button className="btn btn-primary gap-2" onClick={handleNovo}>
      <Plus className="w-4 h-4" />
      Novo Registro
    </button>
  }
/>
```

## 2. CrudFiltros

Componente de `@/components` que encapsula toda a lógica de filtros.

### Props

| Prop | Tipo | Descrição |
|------|------|-----------|
| `campos` | `CampoFiltro[]` | Definição dos campos de filtro |
| `valoresIniciais` | `T` | Objeto com valores iniciais dos filtros |
| `onPesquisar` | `(filtros: T) => void` | Callback ao clicar "Pesquisar" |
| `onLimpar` | `() => void` | Callback ao clicar "Limpar" |

### Tipos de campo suportados

| Tipo | Uso |
|------|-----|
| `text` | Input de texto com `placeholder` opcional |
| `select` | Select com `opcoes: { value, label }[]` |
| `date` | Input de data |

### Comportamento automático

- Estado gerenciado internamente (filtros, isPesquisado, isDirty)
- Toggle Pesquisar/Limpar automático
- Enter em campos de texto dispara pesquisa
- Alterar campo após pesquisar volta para "Pesquisar"

### Uso

```tsx
<CrudFiltros
  campos={[
    { key: 'nome', label: 'Nome', tipo: 'text', placeholder: 'Buscar por nome...' },
    {
      key: 'categoria',
      label: 'Categoria',
      tipo: 'select',
      opcoes: [
        { value: 'eletronicos', label: 'Eletrônicos' },
        { value: 'vestuario', label: 'Vestuário' },
      ],
    },
    { key: 'dataInicio', label: 'Data Início', tipo: 'date' },
    { key: 'dataFim', label: 'Data Fim', tipo: 'date' },
  ]}
  valoresIniciais={{ nome: '', categoria: '', dataInicio: '', dataFim: '' }}
  onPesquisar={(filtros) => carregarDados(filtros)}
  onLimpar={() => carregarDados()}
/>
```

## 3. CrudTable

Componente de `@/components` com layout responsivo: **tabela no desktop** e **cards no mobile**.

### Layout responsivo (automático)

| Breakpoint | Layout | Descrição |
|------------|--------|-----------|
| `< lg` (mobile) | Cards empilhados | Primeira coluna = cabeçalho, demais = pares label/valor |
| `≥ lg` (desktop) | Tabela flat | Tabela tradicional com headers e menu hamburger |

A troca é automática via Tailwind (`hidden lg:block` / `lg:hidden`). Nenhuma alteração é necessária nas páginas existentes.

### Props

| Prop | Tipo | Descrição |
|------|------|-----------|
| `colunas` | `ColunaTabela<T>[]` | Definição das colunas |
| `dados` | `T[]` | Array de itens a exibir |
| `acoes` | `AcaoTabela<T>[]` | Ações do menu hamburger |
| `keyExtractor` | `(item: T) => string` | Extrai a chave única do item |
| `loading` | `boolean` | Exibe spinner de carregamento |
| `emptyState` | `object` | Config do EmptyState quando vazio |
| `className` | `string` | Classes CSS adicionais |

### Estilo visual — Desktop (tabela)

- **Card wrapper** — `bg-base-100 shadow-sm border border-base-300 overflow-hidden` (mesmo padrão do filtro)
- **Sem zebra** — fundo uniforme branco
- **Divisórias sutis** — `divide-y divide-base-200` entre linhas
- **Header leve** — uppercase, tracking-wide, cor suave, borda inferior
- **Hover** — `hover:bg-base-200/30 transition-colors`
- **Bordas arredondadas** — herdadas do card com `overflow-hidden`

### Estilo visual — Mobile (cards)

- **Card wrapper** — mesmo container do desktop, sem scroll horizontal
- **Divisórias** — `divide-y divide-base-200` entre itens
- **Cabeçalho** — primeira coluna renderizada com destaque + botão de ações à direita
- **Dados secundários** — `flex flex-wrap` com pares `Label: valor`
- **Ações** — mesmo menu hamburger (⋮) posicionado no canto superior direito do card

### Definindo colunas

Cada coluna recebe uma `render` function para máxima flexibilidade.

**Importante para mobile:** a **primeira coluna** sempre será o cabeçalho do card. Coloque a informação principal (nome, título) na primeira posição.

| Prop da coluna | Tipo | Descrição |
|----------------|------|-----------|
| `label` | `string` | Texto do header (desktop) e label (mobile) |
| `render` | `(item: T) => ReactNode` | Renderiza o conteúdo |
| `className` | `string?` | Classes CSS adicionais |
| `mobileOculta` | `boolean?` | Se `true`, oculta no mobile (continua visível no desktop) |

```tsx
const colunas: ColunaTabela<Produto>[] = [
  {
    label: 'Nome',
    render: (p) => <span className="font-medium text-base-content">{p.nome}</span>,
  },
  {
    label: 'E-mail',
    render: (p) => <span className="text-sm text-base-content/70">{p.email}</span>,
  },
  {
    label: 'Preço',
    render: (p) => (
      <span className="text-sm text-base-content/70 tabular-nums">
        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.preco)}
      </span>
    ),
  },
  {
    label: 'Status',
    render: (p) => (
      <span className={`badge badge-sm ${p.ativo ? 'badge-success' : 'badge-error'}`}>
        {p.ativo ? 'Ativo' : 'Inativo'}
      </span>
    ),
  },
  {
    label: 'Observação',
    render: (p) => <span className="text-sm text-base-content/70">{p.obs}</span>,
    mobileOculta: true, // visível só no desktop
  },
];
```

### Classes recomendadas por tipo de dado

| Tipo de dado | Classes |
|-------------|---------|
| Nome/título (principal) | `font-medium text-base-content` |
| Texto secundário | `text-sm text-base-content/70` |
| E-mail/URL | `text-sm text-base-content/70` |
| Badge/status | `badge badge-sm` + variante |
| Data | `text-sm text-base-content/70 tabular-nums` |
| Valor monetário | `text-sm text-base-content/70 tabular-nums` |

### Definindo ações

```tsx
const acoes: AcaoTabela<Produto>[] = [
  { label: 'Visualizar', icon: Eye, onClick: handleVisualizar },
  { label: 'Editar', icon: Edit, onClick: handleEditar },
  {
    label: 'Remover',
    icon: Trash2,
    onClick: (p) => setShowDeleteConfirm(p.id),
    className: 'text-error',
  },
];
```

### Menu hamburger (comportamento interno)

- Popup vertical com `[ícone Nome]` em cada linha
- Sombra sutil (`shadow-md`) para profundidade
- Abre abaixo do botão, alinhado à direita
- Click fora fecha automaticamente
- `isVisivel` permite esconder ações condicionalmente por item

### Ícones padrão por ação

| Ação | Ícone | Classe |
|------|-------|--------|
| Visualizar | `Eye` | — |
| Editar | `Edit` | — |
| Remover | `Trash2` | `text-error` |
| Ativar/Inativar | `Power` / `PowerOff` | `text-warning` |
| Duplicar | `Copy` | — |

### Uso completo

```tsx
<CrudTable
  colunas={colunas}
  dados={produtos}
  acoes={acoes}
  keyExtractor={(p) => p.id}
  loading={loading}
  emptyState={{
    icon: Package,
    title: 'Nenhum produto encontrado',
    description: 'Ajuste os filtros ou crie um novo produto.',
    actionLabel: 'Novo Produto',
    actionOnClick: () => setShowModal(true),
  }}
/>
```

## 4. Confirmação de Remoção

Sempre usar `ConfirmDialog` de `@/components`:

```tsx
<ConfirmDialog
  open={showDeleteConfirm !== null}
  onClose={() => setShowDeleteConfirm(null)}
  onConfirm={handleDeleteConfirm}
  title="Remover Registro"
  message="Tem certeza que deseja remover este registro? Esta ação não pode ser desfeita."
  confirmLabel="Remover"
  cancelLabel="Cancelar"
  variant="danger"
  loading={isDeleting}
/>
```

## 5. Imports Padrão

```tsx
'use client';

import { useState } from 'react';
import { Plus, Edit, Trash2, Eye, Package } from 'lucide-react';
import {
  AppLayout, PageHeader, ConfirmDialog,
  CrudFiltros, CrudTable,
  type ColunaTabela, type AcaoTabela,
} from '@/components';
import { toastService } from '@/lib/toast';
```

## 6. Paginação (opcional)

```tsx
{totalPages > 1 && (
  <div className="flex justify-center">
    <div className="join">
      <button className="join-item btn btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
        «
      </button>
      <button className="join-item btn btn-sm btn-disabled">
        Página {page} de {totalPages}
      </button>
      <button className="join-item btn btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
        »
      </button>
    </div>
  </div>
)}
```

## Checklist de Implementação

```
- [ ] page.tsx com 'use client'
- [ ] Import: AppLayout, PageHeader, ConfirmDialog, CrudFiltros, CrudTable
- [ ] AppLayout envolvendo tudo
- [ ] PageHeader com title, subtitle e action (botão Novo)
- [ ] CrudFiltros com campos, valoresIniciais, onPesquisar, onLimpar (carga inicial automática)
- [ ] CrudTable com colunas, dados, acoes, keyExtractor, loading, emptyState
- [ ] ConfirmDialog para remoções
- [ ] Modal de criação/edição (se aplicável)
```

Para exemplos completos, consulte [exemplos.md](exemplos.md).

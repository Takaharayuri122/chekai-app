# Exemplos Completos - CRUD Frontend

## Exemplo: Página de Produtos (CRUD completo)

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Plus, Edit, Trash2, Eye, Package } from 'lucide-react';
import {
  AppLayout,
  PageHeader,
  ConfirmDialog,
  CrudFiltros,
  CrudTable,
  type ColunaTabela,
  type AcaoTabela,
} from '@/components';
import { toastService } from '@/lib/toast';

interface Produto {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  ativo: boolean;
}

interface FiltrosProduto {
  nome: string;
  categoria: string;
  ativo: string;
}

const FILTROS_INICIAIS: FiltrosProduto = {
  nome: '',
  categoria: '',
  ativo: '',
};

const colunas: ColunaTabela<Produto>[] = [
  {
    label: 'Nome',
    render: (p) => <span className="font-medium text-base-content">{p.nome}</span>,
  },
  {
    label: 'Categoria',
    render: (p) => <span className="text-sm text-base-content/70">{p.categoria}</span>,
  },
  {
    label: 'Preço',
    render: (p) => (
      <span className="text-sm text-base-content/70 tabular-nums">
        {new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }).format(p.preco)}
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
];

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduto, setEditingProduto] = useState<Produto | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const carregarProdutos = async (filtros?: FiltrosProduto) => {
    setLoading(true);
    try {
      // const response = await produtoService.listar(filtros);
      // setProdutos(response.items);
    } catch {
      // Erro tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { carregarProdutos(); }, []);

  const handleEditar = (produto: Produto) => {
    setEditingProduto(produto);
    setShowModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!showDeleteConfirm) return;
    try {
      setIsDeleting(true);
      // await produtoService.remover(showDeleteConfirm);
      toastService.success('Produto removido com sucesso!');
      await carregarProdutos();
      setShowDeleteConfirm(null);
    } catch {
      // Erro tratado pelo interceptor
    } finally {
      setIsDeleting(false);
    }
  };

  const acoes: AcaoTabela<Produto>[] = [
    { label: 'Visualizar', icon: Eye, onClick: () => {} },
    { label: 'Editar', icon: Edit, onClick: handleEditar },
    {
      label: 'Remover',
      icon: Trash2,
      onClick: (p) => setShowDeleteConfirm(p.id),
      className: 'text-error',
    },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Produtos"
        subtitle="Gerencie os produtos do sistema"
        action={
          <button
            className="btn btn-primary gap-2"
            onClick={() => setShowModal(true)}
          >
            <Plus className="w-4 h-4" />
            Novo Produto
          </button>
        }
      />

      <div className="px-4 py-4 lg:px-8 space-y-4">
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
            {
              key: 'ativo',
              label: 'Status',
              tipo: 'select',
              opcoes: [
                { value: 'true', label: 'Ativo' },
                { value: 'false', label: 'Inativo' },
              ],
            },
          ]}
          valoresIniciais={FILTROS_INICIAIS}
          onPesquisar={(filtros) => carregarProdutos(filtros)}
          onLimpar={() => carregarProdutos()}
        />

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
      </div>

      <ConfirmDialog
        open={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Remover Produto"
        message="Tem certeza que deseja remover este produto? Esta ação não pode ser desfeita."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="danger"
        loading={isDeleting}
      />
    </AppLayout>
  );
}
```

## Exemplo: Ações condicionais com `isVisivel`

```tsx
const acoes: AcaoTabela<Usuario>[] = [
  { label: 'Editar', icon: Edit, onClick: handleEditar },
  {
    label: 'Remover',
    icon: Trash2,
    onClick: (u) => setShowDeleteConfirm(u.id),
    className: 'text-error',
    isVisivel: (u) => u.perfil !== 'MASTER',
  },
  {
    label: 'Inativar',
    icon: PowerOff,
    onClick: handleInativar,
    className: 'text-warning',
    isVisivel: (u) => u.ativo,
  },
  {
    label: 'Ativar',
    icon: Power,
    onClick: handleAtivar,
    className: 'text-success',
    isVisivel: (u) => !u.ativo,
  },
];
```

## Exemplo: Filtros com datas

```tsx
<CrudFiltros
  campos={[
    { key: 'auditor', label: 'Auditor', tipo: 'select', opcoes: auditoresOpcoes },
    { key: 'cliente', label: 'Cliente', tipo: 'select', opcoes: clientesOpcoes },
    { key: 'dataInicio', label: 'Data Início', tipo: 'date' },
    { key: 'dataFim', label: 'Data Fim', tipo: 'date' },
  ]}
  valoresIniciais={{ auditor: '', cliente: '', dataInicio: '', dataFim: '' }}
  onPesquisar={carregarCheckins}
  onLimpar={() => carregarCheckins()}
/>
```

## Exemplo: Coluna com avatar + nome

```tsx
const colunas: ColunaTabela<Usuario>[] = [
  {
    label: 'Usuário',
    render: (u) => (
      <div className="flex items-center gap-3">
        <div className="avatar placeholder">
          <div className="bg-primary text-primary-content rounded-full w-10">
            <span className="text-sm">{u.nome.charAt(0)}</span>
          </div>
        </div>
        <div>
          <div className="font-medium text-base-content">{u.nome}</div>
          <div className="text-xs text-base-content/50">{u.email}</div>
        </div>
      </div>
    ),
  },
  {
    label: 'Perfil',
    render: (u) => <span className="badge badge-outline badge-sm">{u.perfil}</span>,
  },
  {
    label: 'Status',
    render: (u) => (
      <span className={`badge badge-sm ${u.ativo ? 'badge-success' : 'badge-error'}`}>
        {u.ativo ? 'Ativo' : 'Inativo'}
      </span>
    ),
  },
];
```

## Exemplo: Paginação com CrudTable

```tsx
const [page, setPage] = useState(1);
const [totalPages, setTotalPages] = useState(1);

const carregarDados = async (filtros?: Filtros) => {
  setLoading(true);
  const response = await service.listar({ ...filtros, page });
  setDados(response.items);
  setTotalPages(response.totalPages);
  setLoading(false);
};

useEffect(() => { carregarDados(); }, []);

// No JSX:
<CrudTable ... />

{totalPages > 1 && (
  <div className="flex justify-center">
    <div className="join">
      <button
        className="join-item btn btn-sm"
        disabled={page <= 1}
        onClick={() => setPage(p => p - 1)}
      >
        «
      </button>
      <button className="join-item btn btn-sm btn-disabled">
        Página {page} de {totalPages}
      </button>
      <button
        className="join-item btn btn-sm"
        disabled={page >= totalPages}
        onClick={() => setPage(p => p + 1)}
      >
        »
      </button>
    </div>
  </div>
)}
```

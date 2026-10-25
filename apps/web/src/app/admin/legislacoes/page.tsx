'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Scale, ExternalLink, RefreshCw, Power, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import {
  AppLayout,
  PageHeader,
  CrudFiltros,
  CrudTable,
  StatusChip,
  ConfirmDialog,
} from '@/components';
import type { AcaoTabela, ColunaTabela } from '@/components';
import { Button } from '@/components/ui/shadcn/button';
import { SemPermissaoLegislacoes } from '@/components/legislacao/sem-permissao';
import { legislacaoService, Legislacao, FiltrosLegislacoes, StatusLeitura } from '@/lib/api';
import { nomeCurtoLegislacao } from '@/lib/legislacao/nome-legislacao';
import {
  OPCOES_STATUS_LEITURA,
  rotuloSituacao,
  rotuloStatusLeitura,
  statusChipLeitura,
} from '@/lib/legislacao/leitura';
import { toastService } from '@/lib/toast';

const FILTROS_INICIAIS = { busca: '', statusLeitura: '' };
type FiltrosForm = typeof FILTROS_INICIAIS;

const TEXTO_RELER = 'Os dados lidos e os trechos serão substituídos pelo conteúdo atual da página.';

function mensagemDoErro(error: unknown, padrao: string): string {
  const data = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data;
  const mensagem = Array.isArray(data?.message) ? data?.message.join(', ') : data?.message;
  return mensagem || padrao;
}

/**
 * Listagem de legislações (padrão crud-frontend: CrudFiltros + CrudTable).
 */
export default function LegislacoesPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [legislacoes, setLegislacoes] = useState<Legislacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [semPermissao, setSemPermissao] = useState(false);
  const [filtrosAtuais, setFiltrosAtuais] = useState<FiltrosLegislacoes>({});
  const [remover, setRemover] = useState<Legislacao | null>(null);
  const [reler, setReler] = useState<Legislacao | null>(null);
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async (filtros: FiltrosLegislacoes = {}) => {
    try {
      setLoading(true);
      setFiltrosAtuais(filtros);
      setLegislacoes(await legislacaoService.listar(filtros));
    } catch (error) {
      if ((error as { response?: { status?: number } })?.response?.status === 403) {
        setSemPermissao(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  const handlePesquisar = useCallback(
    (f: FiltrosForm) =>
      carregar({
        busca: f.busca.trim() || undefined,
        statusLeitura: (f.statusLeitura as StatusLeitura) || undefined,
      }),
    [carregar],
  );
  const handleLimpar = useCallback(() => carregar(), [carregar]);

  const confirmarRemocao = async () => {
    if (!remover) return;
    setProcessando(true);
    try {
      await legislacaoService.remover(remover.id);
      toastService.success('Legislação removida.');
      setRemover(null);
      await carregar(filtrosAtuais);
    } catch (error) {
      // 409: a API explica que há vínculos; o interceptor não exibe esse caso
      toastService.error(mensagemDoErro(error, 'Não foi possível remover a legislação.'));
      setRemover(null);
    } finally {
      setProcessando(false);
    }
  };

  const confirmarReleitura = async () => {
    if (!reler) return;
    setProcessando(true);
    try {
      await legislacaoService.lerNovamente(reler.id);
      toastService.success('Leitura iniciada.');
      setReler(null);
      await carregar(filtrosAtuais);
    } catch (error) {
      toastService.error(mensagemDoErro(error, 'Não foi possível iniciar a leitura.'));
      setReler(null);
    } finally {
      setProcessando(false);
    }
  };

  const alternarAtivo = async (leg: Legislacao) => {
    try {
      await legislacaoService.alterarAtivo(leg.id, !leg.ativo);
      toastService.success(leg.ativo ? 'Legislação desativada.' : 'Legislação ativada.');
      await carregar(filtrosAtuais);
    } catch (error) {
      toastService.error(mensagemDoErro(error, 'Não foi possível alterar a legislação.'));
    }
  };

  const colunas: ColunaTabela<Legislacao>[] = [
    {
      label: 'Nome',
      render: (l) => (
        <Link href={`/admin/legislacoes/${l.id}`} className="font-medium hover:underline">
          {nomeCurtoLegislacao(l)}
          {!l.ativo && <span className="ml-2 text-xs font-normal text-muted-foreground">(inativa)</span>}
        </Link>
      ),
    },
    {
      label: 'Título',
      className: 'max-w-[320px]',
      render: (l) => <span className="line-clamp-2 text-muted-foreground">{l.titulo}</span>,
    },
    {
      label: 'Situação',
      render: (l) => {
        const rotulo = rotuloSituacao(l.situacao);
        if (!rotulo) return <span className="text-muted-foreground">—</span>;
        return l.situacao === 'revogada' ? (
          <StatusChip status="nao_conforme" label={rotulo} />
        ) : (
          <span>{rotulo}</span>
        );
      },
    },
    {
      label: 'Leitura',
      render: (l) => (
        <StatusChip status={statusChipLeitura(l.statusLeitura)} label={rotuloStatusLeitura(l.statusLeitura)} />
      ),
    },
    {
      label: 'Trechos',
      render: (l) => <span>{l.totalTrechos ?? 0}</span>,
    },
  ];

  const acoes: AcaoTabela<Legislacao>[] = [
    { label: 'Abrir', icon: ExternalLink, onClick: (l) => router.push(`/admin/legislacoes/${l.id}`) },
    {
      label: 'Ler novamente',
      icon: RefreshCw,
      onClick: (l) => setReler(l),
      isVisivel: (l) => l.statusLeitura !== 'lendo' && l.statusLeitura !== 'pendente',
    },
    { label: 'Desativar', icon: Power, onClick: alternarAtivo, isVisivel: (l) => l.ativo },
    { label: 'Ativar', icon: Power, onClick: alternarAtivo, isVisivel: (l) => !l.ativo },
    { label: 'Remover', icon: Trash2, className: 'text-destructive', onClick: (l) => setRemover(l) },
  ];

  return (
    <AppLayout>
      <PageHeader
        title="Legislações"
        subtitle="Base de consulta para checklists e relatórios"
        action={
          !semPermissao && (
            <Button asChild>
              <Link href="/admin/legislacoes/nova">
                <Plus className="h-4 w-4" />
                Nova
              </Link>
            </Button>
          )
        }
      />

      {semPermissao ? (
        <SemPermissaoLegislacoes />
      ) : (
        <div className="space-y-4 px-4 py-4 lg:px-8">
          <CrudFiltros
            campos={[
              { key: 'busca', label: 'Busca', tipo: 'text', placeholder: 'Buscar por nome ou título...' },
              {
                key: 'statusLeitura',
                label: 'Leitura',
                tipo: 'select',
                placeholder: 'Todas',
                opcoes: OPCOES_STATUS_LEITURA,
              },
            ]}
            valoresIniciais={FILTROS_INICIAIS}
            onPesquisar={handlePesquisar}
            onLimpar={handleLimpar}
          />

          <CrudTable
            colunas={colunas}
            dados={legislacoes}
            acoes={acoes}
            keyExtractor={(l) => l.id}
            loading={loading}
            emptyState={{
              icon: Scale,
              title: 'Nenhuma legislação encontrada',
              description: 'Cadastre uma legislação pelo botão "Nova".',
            }}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!remover}
        onClose={() => setRemover(null)}
        onConfirm={confirmarRemocao}
        title="Remover legislação"
        message={`Deseja remover "${remover ? nomeCurtoLegislacao(remover) : ''}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Remover"
        loading={processando}
      />
      <ConfirmDialog
        open={!!reler}
        onClose={() => setReler(null)}
        onConfirm={confirmarReleitura}
        title="Ler novamente"
        message={TEXTO_RELER}
        confirmLabel="Ler novamente"
        variant="warning"
        loading={processando}
      />
    </AppLayout>
  );
}

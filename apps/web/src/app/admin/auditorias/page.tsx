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

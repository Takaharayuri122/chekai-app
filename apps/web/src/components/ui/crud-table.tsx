'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, type LucideIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/shadcn/skeleton';
import { EmptyState } from './empty-state';

export interface ColunaTabela<T> {
  label: string;
  render: (item: T) => ReactNode;
  className?: string;
  /** Oculta esta coluna nos cards mobile (a coluna continua visível na tabela desktop). */
  mobileOculta?: boolean;
}

export interface AcaoTabela<T> {
  label: string;
  icon: LucideIcon;
  onClick: (item: T) => void;
  className?: string;
  isVisivel?: (item: T) => boolean;
}

export interface CrudTableProps<T> {
  colunas: ColunaTabela<T>[];
  dados: T[];
  acoes?: AcaoTabela<T>[];
  keyExtractor: (item: T) => string;
  loading?: boolean;
  emptyState?: {
    icon: LucideIcon;
    title: string;
    description: string;
    actionLabel?: string;
    actionHref?: string;
    actionOnClick?: () => void;
  };
  className?: string;
}

/**
 * Tabela padrão para páginas CRUD.
 *
 * - **Desktop (lg+):** tabela flat com headers leves e menu hamburger.
 * - **Mobile (< lg):** lista de cards — primeira coluna como cabeçalho,
 *   demais como pares label/valor, com menu de ações no canto superior direito.
 */
export function CrudTable<T>({
  colunas,
  dados,
  acoes = [],
  keyExtractor,
  loading = false,
  emptyState,
  className = '',
}: CrudTableProps<T>) {
  const [menuAbertoId, setMenuAbertoId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const fecharMenu = useCallback(() => {
    setMenuAbertoId(null);
    setMenuPos(null);
  }, []);

  const abrirMenu = useCallback((id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    if (menuAbertoId === id) {
      fecharMenu();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuAltura = acoes.length * 40 + 8;
    const espacoAbaixo = window.innerHeight - rect.bottom;
    const top = espacoAbaixo < menuAltura
      ? rect.top - menuAltura
      : rect.bottom + 4;
    setMenuPos({ top, right: window.innerWidth - rect.right });
    setMenuAbertoId(id);
  }, [menuAbertoId, fecharMenu, acoes.length]);

  useEffect(() => {
    const handleClickFora = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        fecharMenu();
      }
    };
    document.addEventListener('mousedown', handleClickFora);
    return () => document.removeEventListener('mousedown', handleClickFora);
  }, [fecharMenu]);

  if (loading) {
    return (
      <div className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-sm">
        {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-10 w-full" />))}
      </div>
    );
  }

  if (dados.length === 0 && emptyState) {
    return <EmptyState {...emptyState} />;
  }

  if (dados.length === 0) return null;

  const hasAcoes = acoes.length > 0;
  const colunasSecundarias = colunas.slice(1).filter((c) => !c.mobileOculta);

  const renderMenuDropdown = (item: T, id: string) => {
    const acoesVisiveis = acoes.filter((a) => !a.isVisivel || a.isVisivel(item));
    if (acoesVisiveis.length === 0) return null;
    return (
      <>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={(e) => abrirMenu(id, e)}
          aria-label="Ações"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {menuAbertoId === id && menuPos && createPortal(
          <div
            ref={menuRef}
            onMouseDown={(e) => e.stopPropagation()}
            className="fixed z-[100] flex min-w-[160px] flex-col rounded-md border border-border bg-popover py-1 shadow-lg"
            style={{ top: menuPos.top, right: menuPos.right }}
          >
            {acoesVisiveis.map((acao, aIdx) => {
              const Icon = acao.icon;
              return (
                <button
                  key={aIdx}
                  className={`flex min-h-[40px] w-full items-center gap-2 px-3 text-left text-sm transition-colors hover:bg-muted ${acao.className || 'text-foreground'}`}
                  onClick={() => { acao.onClick(item); fecharMenu(); }}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {acao.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
      </>
    );
  };

  return (
    <div className={`overflow-hidden rounded-lg border border-border bg-card shadow-sm ${className}`}>
      {/* Desktop: tabela */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {colunas.map((col, idx) => (
                <th
                  key={idx}
                  className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground ${col.className || ''}`}
                >
                  {col.label}
                </th>
              ))}
              {hasAcoes && (
                <th className="w-16 px-2 py-3" />
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {dados.map((item) => {
              const id = keyExtractor(item);
              return (
                <tr key={id} className="h-12 transition-colors hover:bg-muted/40">
                  {colunas.map((col, idx) => (
                    <td key={idx} className={`px-4 ${col.className ?? ''}`}>
                      {col.render(item)}
                    </td>
                  ))}
                  {hasAcoes && (
                    <td className="px-2 text-right">
                      {renderMenuDropdown(item, id)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="divide-y divide-border lg:hidden">
        {dados.map((item) => {
          const id = keyExtractor(item);
          return (
            <div key={id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {colunas[0].render(item)}
                </div>
                {hasAcoes && (
                  <div className="shrink-0">
                    {renderMenuDropdown(item, id)}
                  </div>
                )}
              </div>
              {colunasSecundarias.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-1">
                  {colunasSecundarias.map((col, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-sm">
                      <span className="text-xs text-muted-foreground">{col.label}:</span>
                      {col.render(item)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

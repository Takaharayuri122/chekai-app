'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, MoreVertical, type LucideIcon } from 'lucide-react';
import { EmptyState } from './empty-state';

export interface ColunaTabela<T> {
  label: string;
  render: (item: T) => ReactNode;
  className?: string;
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
 * Card com fundo branco, bordas arredondadas, headers leves e divisórias sutis.
 * Inclui menu de ações hamburger com tooltip no desktop e labels no mobile.
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
  const menuRef = useRef<HTMLDivElement>(null);

  const fecharMenu = useCallback(() => setMenuAbertoId(null), []);

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
      <div className="card bg-base-100 shadow-sm border border-base-300">
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (dados.length === 0 && emptyState) {
    return <EmptyState {...emptyState} />;
  }

  if (dados.length === 0) return null;

  const hasAcoes = acoes.length > 0;

  return (
    <div className={`card bg-base-100 shadow-sm border border-base-300 overflow-hidden ${className}`}>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr className="border-b border-base-200">
              {colunas.map((col, idx) => (
                <th
                  key={idx}
                  className={`text-xs font-medium uppercase tracking-wide text-base-content/50 ${col.className || ''}`}
                >
                  {col.label}
                </th>
              ))}
              {hasAcoes && (
                <th className="text-xs font-medium uppercase tracking-wide text-base-content/50 text-right w-16" />
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-base-200">
            {dados.map((item) => {
              const id = keyExtractor(item);
              const acoesVisiveis = acoes.filter((a) => !a.isVisivel || a.isVisivel(item));
              return (
                <tr key={id} className="hover:bg-base-200/30 transition-colors">
                  {colunas.map((col, idx) => (
                    <td key={idx} className={col.className}>
                      {col.render(item)}
                    </td>
                  ))}
                  {hasAcoes && (
                    <td className="text-right">
                      {acoesVisiveis.length > 0 && (
                        <div
                          className="relative inline-flex"
                          ref={menuAbertoId === id ? menuRef : undefined}
                        >
                          <button
                            className="btn btn-ghost btn-xs btn-circle"
                            onClick={() => setMenuAbertoId(menuAbertoId === id ? null : id)}
                            aria-label="Ações"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          {menuAbertoId === id && (
                            <div
                              className="absolute right-full top-0 mr-1 z-[100]
                                flex flex-col bg-base-100 border border-base-300
                                rounded-lg shadow-md min-w-[140px] py-1"
                            >
                              {acoesVisiveis.map((acao, aIdx) => {
                                const Icon = acao.icon;
                                return (
                                  <button
                                    key={aIdx}
                                    className={`flex items-center gap-2 px-3 py-2 text-sm
                                      hover:bg-base-200/50 transition-colors w-full text-left
                                      ${acao.className || 'text-base-content'}`}
                                    onClick={() => { acao.onClick(item); fecharMenu(); }}
                                  >
                                    <Icon className="w-4 h-4 shrink-0" />
                                    {acao.label}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

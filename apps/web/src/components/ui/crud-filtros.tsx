'use client';

import { useEffect, useState, useCallback } from 'react';
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';

interface OpcaoSelect {
  value: string;
  label: string;
}

interface CampoFiltroBase {
  key: string;
  label: string;
  placeholder?: string;
}

interface CampoFiltroText extends CampoFiltroBase {
  tipo: 'text';
}

interface CampoFiltroSelect extends CampoFiltroBase {
  tipo: 'select';
  opcoes: OpcaoSelect[];
}

interface CampoFiltroDate extends CampoFiltroBase {
  tipo: 'date';
}

export type CampoFiltro = CampoFiltroText | CampoFiltroSelect | CampoFiltroDate;

export interface CrudFiltrosProps<T extends { [K in keyof T]: string }> {
  campos: CampoFiltro[];
  valoresIniciais: T;
  onPesquisar: (filtros: T) => void;
  onLimpar: () => void;
}

export function contarPreenchidos<T extends Record<string, string>>(valores: T, iniciais: T): number {
  return Object.keys(valores).filter((k) => valores[k] && valores[k] !== iniciais[k]).length;
}

/**
 * Componente de filtros padrão para páginas CRUD.
 *
 * Ao montar, dispara automaticamente `onLimpar` para carregar os primeiros registros.
 * - Pesquisar: dispara `onPesquisar` com os valores atuais
 * - Limpar: reseta os filtros e dispara `onLimpar`
 * - Alterar um campo após pesquisar volta o botão para "Pesquisar"
 * - Enter em campos de texto dispara a pesquisa
 */
export function CrudFiltros<T extends { [K in keyof T]: string }>({
  campos,
  valoresIniciais,
  onPesquisar,
  onLimpar,
}: CrudFiltrosProps<T>) {
  const [filtros, setFiltros] = useState<T>(valoresIniciais);
  const [isPesquisado, setIsPesquisado] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [abertoMobile, setAbertoMobile] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { onLimpar(); }, []);

  const isMostrarLimpar = isPesquisado && !isDirty;

  const handleChange = useCallback((key: string, valor: string) => {
    setFiltros(prev => ({ ...prev, [key]: valor }));
    setIsDirty(prev => {
      if (isPesquisado && !prev) return true;
      return prev;
    });
  }, [isPesquisado]);

  const handlePesquisar = useCallback(() => {
    onPesquisar(filtros);
    setIsPesquisado(true);
    setIsDirty(false);
  }, [filtros, onPesquisar]);

  const handleLimpar = useCallback(() => {
    setFiltros(valoresIniciais);
    setIsPesquisado(false);
    setIsDirty(false);
    onLimpar();
  }, [valoresIniciais, onLimpar]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isMostrarLimpar) return;
      handlePesquisar();
    }
  }, [isMostrarLimpar, handlePesquisar]);

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
}

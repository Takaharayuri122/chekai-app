'use client';

import { useEffect, useState, useCallback } from 'react';
import { Search, X } from 'lucide-react';

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

  const renderCampo = (campo: CampoFiltro) => {
    const valor = (filtros[campo.key as keyof T] as string) || '';
    switch (campo.tipo) {
      case 'text':
        return (
          <input
            type="text"
            className="input input-bordered"
            placeholder={campo.placeholder}
            value={valor}
            onChange={(e) => handleChange(campo.key, e.target.value)}
            onKeyDown={handleKeyDown}
          />
        );
      case 'select':
        return (
          <select
            className="select select-bordered"
            value={valor}
            onChange={(e) => handleChange(campo.key, e.target.value)}
          >
            <option value="">{campo.placeholder || 'Todos'}</option>
            {campo.opcoes.map((op) => (
              <option key={op.value} value={op.value}>{op.label}</option>
            ))}
          </select>
        );
      case 'date':
        return (
          <input
            type="date"
            className="input input-bordered"
            value={valor}
            onChange={(e) => handleChange(campo.key, e.target.value)}
          />
        );
    }
  };

  return (
    <div className="card bg-base-100 shadow-sm border border-base-300">
      <div className="card-body p-4 gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 items-end">
          {campos.map((campo) => (
            <label key={campo.key} className="form-control w-full">
              <div className="label pb-1">
                <span className="label-text text-xs">{campo.label}</span>
              </div>
              {renderCampo(campo)}
            </label>
          ))}
        </div>
        <div className="flex justify-end">
          <button
            className={`btn ${isMostrarLimpar ? 'btn-ghost' : 'btn-primary'} gap-2`}
            onClick={isMostrarLimpar ? handleLimpar : handlePesquisar}
          >
            {isMostrarLimpar ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
            {isMostrarLimpar ? 'Limpar' : 'Pesquisar'}
          </button>
        </div>
      </div>
    </div>
  );
}

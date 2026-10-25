/**
 * Cache compartilhado das opções de legislação (stale-while-revalidate): quem abre o seletor
 * vê a última lista na hora enquanto ela é recarregada; as telas de gestão limpam o cache
 * depois de mudar uma legislação.
 */
export interface EstadoOpcoes<T> {
  /** Última lista carregada; null enquanto nunca carregou (ou depois de limpar). */
  opcoes: T[] | null;
  carregando: boolean;
  /** A última tentativa de carga falhou. */
  erro: boolean;
}

export interface CacheOpcoes<T> {
  obter(): EstadoOpcoes<T>;
  assinar(ouvinte: () => void): () => void;
  /** Busca de novo (reaproveita a busca em andamento). */
  recarregar(): Promise<void>;
  /** Carrega só se ainda não há lista nem busca em andamento. */
  garantir(): Promise<void>;
  /** Esquece a lista; resultados de buscas já em andamento são descartados. */
  resetar(): void;
}

export function criarCacheOpcoes<T>(buscar: () => Promise<T[]>): CacheOpcoes<T> {
  let estado: EstadoOpcoes<T> = { opcoes: null, carregando: false, erro: false };
  let emAndamento: Promise<void> | null = null;
  let geracao = 0;
  const ouvintes = new Set<() => void>();

  const definir = (parcial: Partial<EstadoOpcoes<T>>) => {
    estado = { ...estado, ...parcial };
    ouvintes.forEach((ouvinte) => ouvinte());
  };

  const recarregar = (): Promise<void> => {
    if (emAndamento) return emAndamento;
    const minha = geracao;
    definir({ carregando: true });
    const busca = buscar()
      .then((lista) => {
        if (minha === geracao) definir({ opcoes: lista, erro: false });
      })
      .catch(() => {
        if (minha === geracao) definir({ erro: true });
      })
      .finally(() => {
        if (minha === geracao) {
          emAndamento = null;
          definir({ carregando: false });
        }
      });
    emAndamento = busca;
    return busca;
  };

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    recarregar,
    garantir: () => (estado.opcoes === null && !emAndamento ? recarregar() : emAndamento ?? Promise.resolve()),
    resetar() {
      geracao += 1;
      emAndamento = null;
      definir({ opcoes: null, carregando: false, erro: false });
    },
  };
}

'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { legislacaoService, type LegislacaoOpcao } from '@/lib/api';
import { criarCacheOpcoes } from './cache-opcoes';

const cache = criarCacheOpcoes<LegislacaoOpcao>(() => legislacaoService.opcoes());

/** Limpa o cache de opções; chamar depois de criar, editar, ativar, desativar, remover ou reler. */
export function resetarOpcoesLegislacao(): void {
  cache.resetar();
}

/**
 * Opções de legislação para o seletor, compartilhadas entre os componentes.
 * `recarregar` busca de novo mantendo a lista atual na tela enquanto isso.
 */
export function useOpcoesLegislacao(): {
  opcoes: LegislacaoOpcao[];
  carregando: boolean;
  erro: boolean;
  recarregar: () => Promise<void>;
} {
  const estado = useSyncExternalStore(cache.assinar, cache.obter, cache.obter);

  useEffect(() => {
    void cache.garantir();
  }, [estado.opcoes]);

  return {
    opcoes: estado.opcoes ?? [],
    carregando: estado.carregando || (estado.opcoes === null && !estado.erro),
    erro: estado.erro,
    recarregar: cache.recarregar,
  };
}

'use client';

import { useEffect, useState } from 'react';
import { legislacaoService, type LegislacaoOpcao } from '@/lib/api';

let promessaCompartilhada: Promise<LegislacaoOpcao[]> | null = null;

function carregarOpcoes(): Promise<LegislacaoOpcao[]> {
  if (!promessaCompartilhada) {
    promessaCompartilhada = legislacaoService.opcoes().catch((erro) => {
      // Falha não fica em cache: a próxima abertura tenta de novo.
      promessaCompartilhada = null;
      throw erro;
    });
  }
  return promessaCompartilhada;
}

/** Limpa o cache de opções (usado em testes). */
export function resetarOpcoesLegislacao(): void {
  promessaCompartilhada = null;
}

/** Opções de legislação para o seletor; busca uma vez e compartilha entre os componentes. */
export function useOpcoesLegislacao(): { opcoes: LegislacaoOpcao[]; carregando: boolean } {
  const [opcoes, setOpcoes] = useState<LegislacaoOpcao[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    carregarOpcoes()
      .then((lista) => ativo && setOpcoes(lista))
      .catch(() => undefined)
      .finally(() => ativo && setCarregando(false));
    return () => {
      ativo = false;
    };
  }, []);

  return { opcoes, carregando };
}

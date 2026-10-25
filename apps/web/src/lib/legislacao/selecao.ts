import type { LegislacaoOpcao } from '@/lib/api';

/** Marca ou desmarca um id preservando a ordem em que as legislações foram escolhidas. */
export function alternarSelecao(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Filtra por nome e título, ignorando acentos e maiúsculas; todas as palavras da busca precisam aparecer. */
export function filtrarOpcoes(opcoes: LegislacaoOpcao[], busca: string): LegislacaoOpcao[] {
  const termos = normalizar(busca).split(/\s+/).filter(Boolean);
  if (termos.length === 0) return opcoes;
  return opcoes.filter((o) => {
    const alvo = normalizar(`${o.nome} ${o.titulo}`);
    return termos.every((t) => alvo.includes(t));
  });
}

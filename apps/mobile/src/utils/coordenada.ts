/** Coordenada vinda da API (número, texto decimal ou null) → número, mantendo a ausência como null. */
export function lerCoordenada(valor: number | string | null | undefined): number | null {
  if (valor == null || valor === '') return null;
  const numero = Number(valor);
  return Number.isNaN(numero) ? null : numero;
}

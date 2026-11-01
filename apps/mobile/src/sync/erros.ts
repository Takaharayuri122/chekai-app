import { ApiError } from '../api/client';

/** Erro 4xx que não se resolve repetindo (exceto sessão expirada, tempo esgotado e excesso de pedidos). */
export function ehFalhaDefinitiva(e: unknown): boolean {
  if (!(e instanceof ApiError)) return false;
  const s = e.status;
  return s >= 400 && s <= 499 && s !== 401 && s !== 408 && s !== 429;
}

export function ehSessaoExpirada(e: unknown): boolean {
  return e instanceof ApiError && e.status === 401;
}

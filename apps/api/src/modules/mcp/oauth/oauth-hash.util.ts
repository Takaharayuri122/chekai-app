import { createHash, timingSafeEqual } from 'crypto';

export function hashSegredo(valor: string): string {
  return createHash('sha256').update(valor, 'utf8').digest('hex');
}

export function pkceS256(verifier: string): string {
  return createHash('sha256').update(verifier, 'utf8').digest('base64url');
}

export function iguaisConstante(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

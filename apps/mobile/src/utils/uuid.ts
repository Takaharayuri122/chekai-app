import * as Crypto from 'expo-crypto';

export function gerarUUID(): string {
  return Crypto.randomUUID();
}

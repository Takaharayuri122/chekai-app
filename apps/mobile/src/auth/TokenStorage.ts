import * as SecureStore from 'expo-secure-store';
import type { Usuario } from '@meta-app/shared';

const KEYS = {
  ACCESS_TOKEN: 'auth_token',
  USER: 'auth_user',
} as const;

export const TokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
  },

  async setAccessToken(token: string): Promise<void> {
    await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, token);
  },

  async getUser(): Promise<Usuario | null> {
    const raw = await SecureStore.getItemAsync(KEYS.USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Usuario;
    } catch {
      return null;
    }
  },

  async setUser(user: Usuario): Promise<void> {
    await SecureStore.setItemAsync(KEYS.USER, JSON.stringify(user));
  },

  async clear(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
      SecureStore.deleteItemAsync(KEYS.USER),
    ]);
  },
};

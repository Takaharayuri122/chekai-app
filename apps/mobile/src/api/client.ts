// apps/mobile/src/api/client.ts
import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Adiciona token JWT em todas as requisições
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normaliza respostas da API (formato: { data: { ... } })
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string | string[] }>) => {
    const data = error.response?.data;
    let message = 'Erro inesperado. Tente novamente.';

    if (data?.message) {
      message = Array.isArray(data.message) ? data.message[0] : data.message;
    }

    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      message = 'Tempo de conexão expirado.';
    } else if (!error.response) {
      message = 'Sem conexão com o servidor.';
    }

    return Promise.reject(new Error(message));
  }
);

// Helper para desembrulhar o wrapper { data: T }
export async function apiGet<T>(url: string): Promise<T> {
  const response = await apiClient.get<{ data: T }>(url);
  return response.data.data;
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  const response = await apiClient.post<{ data: T }>(url, body);
  return response.data.data;
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  const response = await apiClient.put<{ data: T }>(url, body);
  return response.data.data;
}

export async function apiDelete(url: string): Promise<void> {
  await apiClient.delete(url);
}

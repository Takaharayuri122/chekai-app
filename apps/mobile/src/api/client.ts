import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const REQUEST_TIMEOUT_MS = 15000;

async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function extrairMensagemErro(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const m = (payload as { message?: string | string[] }).message;
    if (Array.isArray(m)) {
      return m[0] ?? 'Erro inesperado. Tente novamente.';
    }
    if (typeof m === 'string') {
      return m;
    }
  }
  return 'Erro inesperado. Tente novamente.';
}

async function requestJson<T>(method: string, path: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  const inicio = Date.now();
  console.log(`[API] ${method} ${url}`);
  try {
    const headers = await buildHeaders();
    const hasAuth = !!headers.Authorization;
    console.log(`[API] Auth: ${hasAuth ? 'Bearer ***' : 'sem token'}`);
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const elapsed = Date.now() - inicio;
    const text = await response.text();
    console.log(`[API] ${method} ${path} → ${response.status} (${elapsed}ms, ${text.length} bytes)`);
    const json = text ? (JSON.parse(text) as { data?: T; message?: string | string[] }) : {};
    if (!response.ok) {
      console.error(`[API] Erro ${response.status}: ${text.substring(0, 300)}`);
      throw new Error(extrairMensagemErro(json));
    }
    if (json.data === undefined) {
      console.error(`[API] Resposta sem campo 'data': ${text.substring(0, 300)}`);
      throw new Error('Resposta inválida do servidor.');
    }
    return json.data;
  } catch (err) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - inicio;
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        console.error(`[API] Timeout ${method} ${path} (${elapsed}ms)`);
        throw new Error('Tempo de conexão expirado.');
      }
      const msg = err.message;
      if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) {
        console.error(`[API] Sem rede: ${method} ${path} (${elapsed}ms)`);
        throw new Error('Sem conexão com o servidor.');
      }
      throw err;
    }
    console.error(`[API] Erro desconhecido: ${method} ${path}`, err);
    throw new Error('Sem conexão com o servidor.');
  }
}

async function requestVoid(method: string, path: string, body?: unknown): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const url = `${API_URL}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const headers = await buildHeaders();
    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const text = await response.text();
    if (!response.ok) {
      const json = text ? JSON.parse(text) : {};
      throw new Error(extrairMensagemErro(json));
    }
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error('Tempo de conexão expirado.');
      }
      const msg = err.message;
      if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) {
        throw new Error('Sem conexão com o servidor.');
      }
      throw err;
    }
    throw new Error('Sem conexão com o servidor.');
  }
}

export async function apiGet<T>(url: string): Promise<T> {
  return requestJson<T>('GET', url);
}

export async function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return requestJson<T>('POST', url, body);
}

export async function apiPut<T>(url: string, body?: unknown): Promise<T> {
  return requestJson<T>('PUT', url, body);
}

export async function apiDelete(url: string): Promise<void> {
  return requestVoid('DELETE', url);
}

import { getOfflineDbIfAvailable } from './db';

const TTL_MS = 24 * 60 * 60 * 1000;

export async function salvarTemplate(id: string, data: unknown): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.cache_templates.put({
    id,
    data,
    cachedAt: Date.now(),
  });
}

export async function obterTemplate(id: string): Promise<unknown | null> {
  const db = getOfflineDbIfAvailable();
  if (!db) return null;
  const row = await db.cache_templates.get(id);
  if (!row || Date.now() - row.cachedAt > TTL_MS) return null;
  return row.data;
}

export async function salvarListaUnidades(data: unknown): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.cache_unidades.put({
    id: 'list',
    data,
    cachedAt: Date.now(),
  });
}

export async function obterListaUnidades(): Promise<unknown | null> {
  const db = getOfflineDbIfAvailable();
  if (!db) return null;
  const row = await db.cache_unidades.get('list');
  if (!row || Date.now() - row.cachedAt > TTL_MS) return null;
  return row.data;
}

const CACHE_KEY_UNIDADES_CLIENTE = (clienteId: string) => `unidades-${clienteId}`;

export async function salvarUnidadesPorCliente(clienteId: string, data: unknown): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.cache_unidades.put({
    id: CACHE_KEY_UNIDADES_CLIENTE(clienteId),
    data,
    cachedAt: Date.now(),
  });
}

export async function obterUnidadesPorCliente(clienteId: string): Promise<unknown | null> {
  const db = getOfflineDbIfAvailable();
  if (!db) return null;
  const row = await db.cache_unidades.get(CACHE_KEY_UNIDADES_CLIENTE(clienteId));
  if (!row || Date.now() - row.cachedAt > TTL_MS) return null;
  return row.data;
}

export async function salvarListaAuditorias(data: unknown): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.cache_auditorias.put({
    id: 'list',
    data,
    cachedAt: Date.now(),
  });
}

export async function obterListaAuditorias(): Promise<unknown | null> {
  const db = getOfflineDbIfAvailable();
  if (!db) return null;
  const row = await db.cache_auditorias.get('list');
  if (!row || Date.now() - row.cachedAt > TTL_MS) return null;
  return row.data;
}

export async function salvarClientes(data: unknown): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.cache_unidades.put({
    id: 'clientes',
    data,
    cachedAt: Date.now(),
  });
}

export async function obterClientes(): Promise<unknown | null> {
  const db = getOfflineDbIfAvailable();
  if (!db) return null;
  const row = await db.cache_unidades.get('clientes');
  if (!row || Date.now() - row.cachedAt > TTL_MS) return null;
  return row.data;
}

export async function salvarListaTemplates(data: unknown): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.cache_templates.put({
    id: 'list',
    data,
    cachedAt: Date.now(),
  });
}

export async function obterListaTemplates(): Promise<unknown | null> {
  const db = getOfflineDbIfAvailable();
  if (!db) return null;
  const row = await db.cache_templates.get('list');
  if (!row || Date.now() - row.cachedAt > TTL_MS) return null;
  return row.data;
}

const CACHE_KEY_TEMPLATES_TIPO = (tipo: string) => `tipo-${tipo}`;

export async function salvarListaTemplatesPorTipo(tipo: string, data: unknown): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.cache_templates.put({
    id: CACHE_KEY_TEMPLATES_TIPO(tipo),
    data,
    cachedAt: Date.now(),
  });
}

export async function obterListaTemplatesPorTipo(tipo: string): Promise<unknown | null> {
  const db = getOfflineDbIfAvailable();
  if (!db) return null;
  const row = await db.cache_templates.get(CACHE_KEY_TEMPLATES_TIPO(tipo));
  if (!row || Date.now() - row.cachedAt > TTL_MS) return null;
  return row.data;
}

export async function salvarAuditoria(id: string, data: unknown): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.cache_auditorias.put({
    id,
    data,
    cachedAt: Date.now(),
  });
}

export async function obterAuditoria(id: string): Promise<unknown | null> {
  const db = getOfflineDbIfAvailable();
  if (!db) return null;
  const row = await db.cache_auditorias.get(id);
  if (!row) return null;
  return row.data;
}

export async function removerAuditoriaCache(id: string): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.cache_auditorias.delete(id);
}

export async function substituirIdAuditoriaNoCache(
  tempId: string,
  serverId: string,
  data: unknown
): Promise<void> {
  const db = getOfflineDbIfAvailable();
  if (!db) return;
  await db.cache_auditorias.delete(tempId);
  await db.cache_auditorias.put({
    id: serverId,
    data,
    cachedAt: Date.now(),
  });
}

import {
  checklistService,
  clienteService,
  type ChecklistTemplate,
  type Cliente,
  type Unidade,
  type PaginatedResult,
  type TipoAtividade,
} from '../api';
import { useOfflineStore } from '../store-offline';
import * as cache from './cache';

function isOnline(): boolean {
  if (typeof window === 'undefined') return true;
  return useOfflineStore.getState().isOnline;
}

export async function listarTemplates(
  page = 1,
  limit = 10
): Promise<PaginatedResult<ChecklistTemplate>> {
  if (isOnline()) {
    const result = await checklistService.listarTemplates(page, limit);
    await cache.salvarListaTemplates(result);
    if (result.items?.length) {
      for (const t of result.items) {
        await cache.salvarTemplate(t.id, t);
      }
    }
    return result;
  }
  const cached = await cache.obterListaTemplates();
  if (cached && typeof cached === 'object' && 'items' in cached) {
    return cached as PaginatedResult<ChecklistTemplate>;
  }
  return { items: [], total: 0, page: 1, limit, totalPages: 0 };
}

export async function listarTemplatesPorTipo(tipo: TipoAtividade): Promise<ChecklistTemplate[]> {
  if (isOnline()) {
    const result = await checklistService.listarTemplatesPorTipo(tipo);
    await cache.salvarListaTemplatesPorTipo(tipo, result);
    if (result?.length) {
      for (const t of result) {
        await cache.salvarTemplate(t.id, t);
      }
    }
    return result;
  }
  const cached = await cache.obterListaTemplatesPorTipo(tipo);
  if (Array.isArray(cached)) return cached as ChecklistTemplate[];
  return [];
}

export async function buscarTemplatePorId(id: string): Promise<ChecklistTemplate | null> {
  if (isOnline()) {
    const result = await checklistService.buscarTemplatePorId(id);
    await cache.salvarTemplate(id, result);
    return result;
  }
  const cached = await cache.obterTemplate(id);
  return (cached as ChecklistTemplate) ?? null;
}

export async function listarClientes(): Promise<PaginatedResult<Cliente>> {
  if (isOnline()) {
    const result = await clienteService.listar();
    await cache.salvarClientes(result);
    return result;
  }
  const cached = await cache.obterClientes();
  if (cached && typeof cached === 'object' && 'items' in cached) {
    return cached as PaginatedResult<Cliente>;
  }
  return { items: [], total: 0, page: 1, limit: 10, totalPages: 0 };
}

export async function listarUnidadesPorCliente(clienteId: string): Promise<Unidade[]> {
  if (isOnline()) {
    const result = await clienteService.listarUnidades(clienteId);
    await cache.salvarUnidadesPorCliente(clienteId, result);
    return result;
  }
  const cached = await cache.obterUnidadesPorCliente(clienteId);
  if (Array.isArray(cached)) return cached as Unidade[];
  return [];
}

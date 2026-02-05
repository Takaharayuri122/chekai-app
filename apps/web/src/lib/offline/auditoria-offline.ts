import type {
  Auditoria,
  AuditoriaItem,
  ChecklistTemplate,
  Unidade,
  Cliente,
} from '../api';
import { auditoriaService } from '../api';
import { useOfflineStore } from '../store-offline';
import { ehIdLocal, gerarIdLocal } from './types';
import * as cache from './cache';
import * as queue from './queue';

function isOnline(): boolean {
  return useOfflineStore.getState().isOnline;
}

export async function listarAuditorias(
  page: number,
  limit: number
): Promise<{ items: Auditoria[] }> {
  if (isOnline()) {
    const result = await auditoriaService.listar(page, limit);
    await cache.salvarListaAuditorias(result);
    return result;
  }
  const cached = await cache.obterListaAuditorias();
  if (cached && typeof cached === 'object' && 'items' in cached) {
    return cached as { items: Auditoria[] };
  }
  return { items: [] };
}

export async function iniciarAuditoria(
  unidadeId: string,
  templateId: string,
  latitude?: number,
  longitude?: number
): Promise<Auditoria> {
  if (isOnline()) {
    return auditoriaService.iniciar(unidadeId, templateId, latitude, longitude);
  }
  const template = await cache.obterTemplate(templateId) as ChecklistTemplate | null;
  if (!template || !template.itens) {
    throw new Error('Template não encontrado no cache. Abra o app com internet para carregar os dados.');
  }
  let unidade: Unidade & { cliente?: Cliente } = {
    id: unidadeId,
    nome: '',
    endereco: '',
    cidade: '',
    estado: '',
    ativo: true,
  };
  const clientesData = await cache.obterClientes();
  if (clientesData && typeof clientesData === 'object' && 'items' in clientesData) {
    const items = (clientesData as { items: (Cliente & { unidades?: Unidade[] })[] }).items;
    for (const c of items) {
      const found = c.unidades?.find((u) => u.id === unidadeId);
      if (found) {
        unidade = { ...found, cliente: c as Cliente };
        break;
      }
    }
  }
  if (!unidade.nome) {
    const unidadesData = await cache.obterListaUnidades();
    if (unidadesData && Array.isArray(unidadesData)) {
      const found = (unidadesData as Unidade[]).find((u) => u.id === unidadeId);
      if (found) unidade = found as Unidade & { cliente?: Cliente };
    }
  }
  const tempId = gerarIdLocal();
  const itensAtivos = template.itens.filter((i) => i.ativo);
  const itens: AuditoriaItem[] = itensAtivos.map((ti) => ({
    id: ti.id,
    resposta: 'nao_avaliado',
    observacao: '',
    descricaoNaoConformidade: '',
    descricaoIa: '',
    complementoDescricao: '',
    planoAcaoSugerido: '',
    referenciaLegal: '',
    templateItem: ti,
    fotos: [],
  }));
  const auditoria: Auditoria = {
    id: tempId,
    status: 'em_andamento',
    dataInicio: new Date().toISOString(),
    unidade: unidade as Unidade & { cliente: Cliente },
    template,
    pontuacaoTotal: 0,
    itens,
  };
  await cache.salvarAuditoria(tempId, auditoria);
  await queue.enfileirar(
    'criar_auditoria',
    { unidadeId, templateId, latitude, longitude },
    tempId
  );
  return auditoria;
}

export async function buscarAuditoriaPorId(id: string): Promise<Auditoria> {
  if (isOnline()) {
    const data = await auditoriaService.buscarPorId(id);
    await cache.salvarAuditoria(id, data);
    return data;
  }
  const cached = await cache.obterAuditoria(id);
  if (cached) return cached as Auditoria;
  throw new Error('Auditoria não encontrada no cache. Conecte-se para carregar.');
}

export async function responderItemAuditoria(
  auditoriaId: string,
  itemId: string,
  resposta: string,
  dados?: {
    observacao?: string;
    descricaoNaoConformidade?: string;
    descricaoIa?: string;
    complementoDescricao?: string;
    planoAcaoSugerido?: string;
    referenciaLegal?: string;
  }
): Promise<AuditoriaItem> {
  const templateItemId = itemId;
  if (isOnline()) {
    return auditoriaService.responderItem(
      auditoriaId,
      itemId,
      resposta,
      dados
    );
  }
  await queue.enfileirar(
    'responder_item',
    {
      templateItemId,
      resposta,
      observacao: dados?.observacao,
      descricaoNaoConformidade: dados?.descricaoNaoConformidade,
      descricaoIa: dados?.descricaoIa,
      complementoDescricao: dados?.complementoDescricao,
      planoAcaoSugerido: dados?.planoAcaoSugerido,
      referenciaLegal: dados?.referenciaLegal,
    },
    auditoriaId
  );
  const auditoriaData = await cache.obterAuditoria(auditoriaId) as Auditoria | null;
  if (auditoriaData?.itens) {
    const item = auditoriaData.itens.find((i) => i.id === templateItemId || i.templateItem?.id === templateItemId);
    if (item) {
      const updated = {
        ...item,
        resposta,
        observacao: dados?.observacao ?? item.observacao,
        descricaoNaoConformidade: dados?.descricaoNaoConformidade ?? item.descricaoNaoConformidade,
        descricaoIa: dados?.descricaoIa ?? item.descricaoIa,
        complementoDescricao: dados?.complementoDescricao ?? item.complementoDescricao,
        planoAcaoSugerido: dados?.planoAcaoSugerido ?? item.planoAcaoSugerido,
        referenciaLegal: dados?.referenciaLegal ?? item.referenciaLegal,
      };
      const newItens = auditoriaData.itens.map((i) =>
        (i.id === templateItemId || i.templateItem?.id === templateItemId) ? updated : i
      );
      await cache.salvarAuditoria(auditoriaId, { ...auditoriaData, itens: newItens });
      return updated;
    }
  }
  return {} as AuditoriaItem;
}

export async function adicionarFotoAuditoria(
  auditoriaId: string,
  itemId: string,
  file: File,
  dados?: { latitude?: number; longitude?: number }
): Promise<{ id: string; url: string }> {
  const templateItemId = itemId;
  if (isOnline()) {
    return auditoriaService.adicionarFoto(auditoriaId, itemId, file, dados);
  }
  const blobId = crypto.randomUUID();
  await queue.salvarBlobFoto(blobId, file);
  await queue.enfileirar(
    'adicionar_foto',
    {
      templateItemId,
      blobId,
      latitude: dados?.latitude,
      longitude: dados?.longitude,
    },
    auditoriaId
  );
  const auditoriaData = await cache.obterAuditoria(auditoriaId) as Auditoria | null;
  const previewUrl = URL.createObjectURL(file);
  const localFotoId = `local-${blobId}`;
  if (auditoriaData?.itens) {
    const newItens = auditoriaData.itens.map((i) => {
      if (i.id !== templateItemId && i.templateItem?.id !== templateItemId) return i;
      return {
        ...i,
        fotos: [...(i.fotos || []), { id: localFotoId, url: previewUrl }],
      };
    });
    await cache.salvarAuditoria(auditoriaId, { ...auditoriaData, itens: newItens });
  }
  return { id: localFotoId, url: previewUrl };
}

export async function finalizarAuditoria(
  id: string,
  observacoesGerais?: string
): Promise<Auditoria> {
  if (isOnline()) {
    return auditoriaService.finalizar(id, observacoesGerais);
  }
  await queue.enfileirar(
    'finalizar_auditoria',
    { observacoesGerais },
    id
  );
  const auditoriaData = await cache.obterAuditoria(id) as Auditoria | null;
  if (auditoriaData) {
    const updated = { ...auditoriaData, status: 'finalizada' as const };
    await cache.salvarAuditoria(id, updated);
    return updated;
  }
  return {} as Auditoria;
}

export async function listarHistoricoUnidade(unidadeId: string): Promise<Auditoria['id'][]> {
  if (isOnline()) {
    const list = await auditoriaService.listarHistoricoUnidade(unidadeId);
    return list.map((a) => a.id);
  }
  return [];
}

export { ehIdLocal, gerarIdLocal } from './types';

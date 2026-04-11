import { getDatabase } from '../db/client';
import { AuditoriaRepo } from '../db/repositories/auditoria.repo';
import { AuditoriaItemRepo } from '../db/repositories/auditoria-item.repo';
import { FotoRepo } from '../db/repositories/foto.repo';
import {
  createAuditoria, submitItem, uploadFoto, finalizarAuditoria,
} from '../api/auditoria.api';

const auditoriaRepo = new AuditoriaRepo();
const itemRepo = new AuditoriaItemRepo();
const fotoRepo = new FotoRepo();

export type PushEtapa = 'criando' | 'itens' | 'fotos' | 'finalizando' | 'concluido';
export type PushProgressCallback = (etapa: PushEtapa, detalhe?: string) => void;

export async function pushAuditoria(
  localId: string,
  onProgress?: PushProgressCallback,
): Promise<void> {
  const inicio = Date.now();
  const auditoria = auditoriaRepo.findById(localId);
  if (!auditoria) throw new Error(`Auditoria ${localId} não encontrada.`);
  console.log(`[pushAuditoria] Iniciando push — local=${localId}, cliente=${auditoria.clienteNome}`);

  onProgress?.('criando');
  const { id: remoteId, itens: remoteItens } = await createAuditoria({
    localId: auditoria.localId,
    clienteId: auditoria.clienteId,
    unidadeId: auditoria.unidadeId,
    templateId: auditoria.templateId!,
    dataInicio: auditoria.dataInicio!,
  });
  console.log(`[pushAuditoria] Criada no servidor — remoteId=${remoteId}, ${remoteItens.length} itens remotos`);

  const remoteItemMap = new Map(remoteItens.map(i => [i.templateItemId, i.id]));

  onProgress?.('itens');
  const itens = itemRepo.findByAuditoria(localId);
  let itensEnviados = 0;
  let fotosSucesso = 0;
  let fotosErro = 0;

  for (const item of itens) {
    const remoteItemId = remoteItemMap.get(item.templateItemId);
    if (!remoteItemId) {
      console.warn(`[pushAuditoria] Item ${item.id} sem mapeamento remoto (templateItemId=${item.templateItemId})`);
      continue;
    }
    await submitItem(remoteId, remoteItemId, {
      localId: item.id,
      templateItemId: item.templateItemId,
      resposta: item.resposta,
      observacao: item.observacao ?? undefined,
      descricaoNaoConformidade: item.descricaoNaoConformidade ?? undefined,
      planoAcaoFinal: item.planoAcaoFinal ?? undefined,
      pontuacao: item.pontuacao,
    });
    itensEnviados++;

    onProgress?.('fotos', `${itensEnviados}/${itens.length} itens`);
    const fotos = fotoRepo.findByItem(item.id);
    for (const foto of fotos) {
      if (!foto.filePath) continue;
      try {
        const { id: fotoRemoteId, url } = await uploadFoto(remoteId, remoteItemId, foto.filePath);
        fotoRepo.markSynced(foto.id, fotoRemoteId, url);
        fotosSucesso++;
      } catch (e) {
        fotosErro++;
        console.warn(`[pushAuditoria] Falha upload foto ${foto.id}:`, e);
      }
    }
  }
  console.log(`[pushAuditoria] Itens: ${itensEnviados}/${itens.length}, Fotos: ${fotosSucesso} ok / ${fotosErro} erro`);

  onProgress?.('finalizando');
  const resumo = await finalizarAuditoria(remoteId, {
    dataFim: auditoria.dataFim ?? new Date().toISOString(),
    assinaturaNome: auditoria.assinaturaNome ?? undefined,
  });

  auditoriaRepo.markSynced(localId, remoteId);
  auditoriaRepo.updateAfterFinalize(localId, {
    analiseIa: resumo.analiseIa ?? undefined,
    pdfUrl: resumo.pdfUrl ?? undefined,
    resumoExecutivo: resumo.resumoExecutivo ?? undefined,
  });

  onProgress?.('concluido');
  console.log(`[pushAuditoria] Concluído em ${Date.now() - inicio}ms — remoteId=${remoteId}`);
}

export async function pushPending(): Promise<void> {
  const db = getDatabase();
  const items = db.getAllSync<{ id: string; payload: string; retries: number }>(
    `SELECT id, payload, retries FROM sync_queue WHERE entity = 'auditoria' ORDER BY created_at`
  );
  console.log(`[pushPending] ${items.length} item(s) na fila`);

  for (const item of items) {
    try {
      const { localId } = JSON.parse(item.payload) as { localId: string };
      await pushAuditoria(localId);
      db.runSync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
      console.log(`[pushPending] Sucesso: ${localId}`);
    } catch (e) {
      db.runSync(
        'UPDATE sync_queue SET retries = retries + 1 WHERE id = ?',
        [item.id]
      );
      console.error(`[pushPending] Erro ao enviar item ${item.id}:`, e);
    }
  }
}

export function enqueuePush(localId: string): void {
  const db = getDatabase();
  db.runSync(
    `INSERT INTO sync_queue (id, entity, operation, payload, retries, created_at)
     VALUES (?, 'auditoria', 'push', ?, 0, datetime('now'))`,
    [crypto.randomUUID(), JSON.stringify({ localId })]
  );
  console.log(`[enqueuePush] Auditoria ${localId} adicionada à fila`);
}

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

export async function pushAuditoria(localId: string): Promise<void> {
  const auditoria = auditoriaRepo.findById(localId);
  if (!auditoria) throw new Error(`Auditoria ${localId} não encontrada.`);

  // 1. Create on backend
  const { id: remoteId } = await createAuditoria({
    localId: auditoria.localId,
    clienteId: auditoria.clienteId,
    unidadeId: auditoria.unidadeId,
    templateId: auditoria.templateId!,
    dataInicio: auditoria.dataInicio!,
  });

  // 2. Submit items
  const itens = itemRepo.findByAuditoria(localId);
  for (const item of itens) {
    await submitItem(remoteId, {
      localId: item.id,
      templateItemId: item.templateItemId,
      resposta: item.resposta,
      observacao: item.observacao ?? undefined,
      descricaoNaoConformidade: item.descricaoNaoConformidade ?? undefined,
      planoAcaoFinal: item.planoAcaoFinal ?? undefined,
      pontuacao: item.pontuacao,
    });

    // 3. Upload fotos for this item
    const fotos = fotoRepo.findByItem(item.id);
    for (const foto of fotos) {
      if (!foto.filePath) continue;
      try {
        const { id: fotoRemoteId, url } = await uploadFoto(remoteId, item.id, foto.filePath);
        fotoRepo.markSynced(foto.id, fotoRemoteId, url);
      } catch {
        fotoRepo.markSynced(foto.id, '', ''); // mark as attempted; URL empty signals error
      }
    }
  }

  // 4. Finalize
  const resumo = await finalizarAuditoria(remoteId, {
    dataFim: new Date().toISOString(),
  });

  // 5. Mark synced
  auditoriaRepo.markSynced(localId, remoteId);
  auditoriaRepo.updateAfterFinalize(localId, {
    analiseIa: resumo.analiseIa ?? undefined,
    pdfUrl: resumo.pdfUrl ?? undefined,
    resumoExecutivo: resumo.resumoExecutivo ?? undefined,
  });
}

export async function pushPending(): Promise<void> {
  const db = getDatabase();
  const items = db.getAllSync<{ id: string; payload: string; retries: number }>(
    `SELECT id, payload, retries FROM sync_queue WHERE entity = 'auditoria' ORDER BY created_at`
  );

  for (const item of items) {
    try {
      const { localId } = JSON.parse(item.payload) as { localId: string };
      await pushAuditoria(localId);
      db.runSync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
    } catch {
      db.runSync(
        'UPDATE sync_queue SET retries = retries + 1 WHERE id = ?',
        [item.id]
      );
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
}

import { getDatabase } from '../db/client';
import { AuditoriaRepo } from '../db/repositories/auditoria.repo';
import { AuditoriaItemRepo } from '../db/repositories/auditoria-item.repo';
import { FotoRepo } from '../db/repositories/foto.repo';
import { RelatorioTecnicoRepo } from '../db/repositories/relatorio-tecnico.repo';
import { RelatorioFotoRepo } from '../db/repositories/relatorio-foto.repo';
import {
  createAuditoria, submitItem, uploadFoto, finalizarAuditoria,
  salvarAnaliseFoto, getAuditoria,
} from '../api/auditoria.api';
import {
  iniciarRelatorioTecnico, atualizarRelatorioTecnico, uploadRelatorioFoto,
  type AtualizarRelatorioTecnicoPayload,
} from '../api/relatorio-tecnico.api';
import { gerarUUID } from '../utils/uuid';

const auditoriaRepo = new AuditoriaRepo();
const itemRepo = new AuditoriaItemRepo();
const fotoRepo = new FotoRepo();
const relatorioRepo = new RelatorioTecnicoRepo();
const relatorioFotoRepo = new RelatorioFotoRepo();

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
    latitudeInicio: auditoria.latitudeInicio ?? undefined,
    longitudeInicio: auditoria.longitudeInicio ?? undefined,
  });
  console.log(`[pushAuditoria] Criada no servidor — remoteId=${remoteId}, ${remoteItens.length} itens remotos`);

  const remoteItemMap = new Map(remoteItens.map(i => [i.templateItemId, i.id]));

  const itens = itemRepo.findByAuditoria(localId);
  let itensEnviados = 0;
  let fotosSucesso = 0;
  let fotosErro = 0;

  let totalFotosComArquivo = 0;
  for (const item of itens) {
    const fotosItem = fotoRepo.findByItem(item.id);
    totalFotosComArquivo += fotosItem.filter(f => f.filePath).length;
  }

  let fotosEnviadas = 0;
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
      descricaoIa: item.descricaoIa ?? undefined,
      complementoDescricao: item.complementoDescricao ?? undefined,
      planoAcaoFinal: item.planoAcaoFinal ?? undefined,
      referenciaLegal: item.referenciaLegal ?? undefined,
      pontuacao: item.pontuacao,
    });
    itensEnviados++;

    onProgress?.('itens', `${itensEnviados}/${itens.length} respostas`);
    const fotos = fotoRepo.findByItem(item.id);
    for (const foto of fotos) {
      if (!foto.filePath) continue;
      try {
        const { id: fotoRemoteId, url } = await uploadFoto(remoteId, remoteItemId, foto.filePath);
        fotoRepo.markSynced(foto.id, fotoRemoteId, url);
        if (foto.analiseIa) {
          try {
            await salvarAnaliseFoto(remoteId, remoteItemId, fotoRemoteId, foto.analiseIa);
          } catch (eAnalise) {
            console.warn(`[pushAuditoria] Falha ao sincronizar análise da foto ${foto.id}:`, eAnalise);
          }
        }
        fotosSucesso++;
        fotosEnviadas++;
        onProgress?.('fotos', `${fotosEnviadas}/${totalFotosComArquivo} fotos`);
      } catch (e) {
        fotosErro++;
        console.warn(`[pushAuditoria] Falha upload foto ${foto.id}:`, e);
      }
    }
  }
  if (totalFotosComArquivo === 0) {
    onProgress?.('fotos', '0/0 fotos');
  }
  console.log(`[pushAuditoria] Itens: ${itensEnviados}/${itens.length}, Fotos: ${fotosSucesso} ok / ${fotosErro} erro`);

  onProgress?.('finalizando');
  await finalizarAuditoria(remoteId, {
    latitude: auditoria.latitudeFim ?? undefined,
    longitude: auditoria.longitudeFim ?? undefined,
    observacoesGerais: auditoria.observacoesGerais ?? undefined,
  });

  auditoriaRepo.markSynced(localId, remoteId);

  try {
    const oficial = await getAuditoria(remoteId);
    const pontuacaoOficial = oficial.pontuacaoTotal != null ? Number(oficial.pontuacaoTotal) : null;
    if (pontuacaoOficial != null && !Number.isNaN(pontuacaoOficial)) {
      auditoriaRepo.updatePontuacao(localId, pontuacaoOficial);
    }
    if (oficial.pdfUrl) {
      auditoriaRepo.updatePdfUrl(localId, oficial.pdfUrl);
    }
  } catch (e) {
    console.warn(`[pushAuditoria] Não foi possível obter pontuação oficial de ${remoteId}:`, e);
  }

  onProgress?.('concluido');
  console.log(`[pushAuditoria] Concluído em ${Date.now() - inicio}ms — remoteId=${remoteId}`);
}

/**
 * Envia ao servidor um relatório técnico criado/editado offline. Cria o registro
 * remoto via `/iniciar` quando ainda não existe, sobe as evidências fotográficas
 * pendentes (sem IA — RN-REL-006) e persiste os campos via `PUT`, incluindo o
 * status `finalizado` quando aplicável. Apoio analítico (IA) e PDF não são tocados
 * aqui (online-only, sob demanda).
 */
export async function pushRelatorioTecnico(localId: string): Promise<void> {
  const relatorio = relatorioRepo.findById(localId);
  if (!relatorio) throw new Error(`Relatório técnico ${localId} não encontrado.`);
  console.log(`[pushRelatorioTecnico] Iniciando push — local=${localId}, cliente=${relatorio.clienteNome}`);

  let remoteId = relatorio.remoteId;
  if (!remoteId) {
    if (!relatorio.unidadeId) {
      throw new Error('A pré-criação no servidor exige uma unidade selecionada.');
    }
    const criado = await iniciarRelatorioTecnico({
      clienteId: relatorio.clienteId,
      unidadeId: relatorio.unidadeId,
    });
    remoteId = criado.id;
    relatorioRepo.setRemoteId(localId, remoteId);
    console.log(`[pushRelatorioTecnico] Pré-criado no servidor — remoteId=${remoteId}`);
  }

  const fotosPendentes = relatorioFotoRepo.findPendentes(localId);
  for (const foto of fotosPendentes) {
    if (!foto.filePath) continue;
    try {
      const { id: fotoRemoteId, url } = await uploadRelatorioFoto(remoteId, foto.filePath);
      relatorioFotoRepo.markSynced(foto.id, fotoRemoteId, url);
    } catch (e) {
      console.warn(`[pushRelatorioTecnico] Falha upload foto ${foto.id}:`, e);
    }
  }

  const payload: AtualizarRelatorioTecnicoPayload = {
    identificacao: relatorio.identificacao,
    descricaoOcorrenciaHtml: relatorio.descricaoOcorrenciaHtml,
    avaliacaoTecnicaHtml: relatorio.avaliacaoTecnicaHtml,
    acoesExecutadas: relatorio.acoesExecutadas,
    recomendacoesConsultoraHtml: relatorio.recomendacoesConsultoraHtml,
    planoAcaoSugeridoHtml: relatorio.planoAcaoSugeridoHtml,
    assinaturaNomeConsultora: relatorio.assinaturaNomeConsultora ?? '',
    responsavel: relatorio.responsavel ?? '',
  };
  if (relatorio.status === 'finalizado') {
    payload.status = 'finalizado';
  }
  await atualizarRelatorioTecnico(remoteId, payload);

  relatorioRepo.markSynced(localId, remoteId);
  console.log(`[pushRelatorioTecnico] Concluído — remoteId=${remoteId}`);
}

export async function pushPending(): Promise<void> {
  const db = getDatabase();
  const items = db.getAllSync<{ id: string; entity: string; payload: string; retries: number }>(
    `SELECT id, entity, payload, retries FROM sync_queue
     WHERE entity IN ('auditoria', 'relatorio_tecnico') ORDER BY created_at`
  );
  console.log(`[pushPending] ${items.length} item(s) na fila`);

  for (const item of items) {
    try {
      const { localId } = JSON.parse(item.payload) as { localId: string };
      if (item.entity === 'relatorio_tecnico') {
        await pushRelatorioTecnico(localId);
      } else {
        await pushAuditoria(localId);
      }
      db.runSync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
      console.log(`[pushPending] Sucesso (${item.entity}): ${localId}`);
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
    [gerarUUID(), JSON.stringify({ localId })]
  );
  console.log(`[enqueuePush] Auditoria ${localId} adicionada à fila`);
}

/**
 * Retorna a quantidade real de auditorias aguardando envio na fila SQLite `sync_queue`.
 */
export function getPendingCount(): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM sync_queue WHERE entity = 'auditoria'`
  );
  return row?.total ?? 0;
}

/**
 * Enfileira um relatório técnico para envio quando houver conexão (offline-first).
 * Evita duplicar entradas para o mesmo `localId` ainda pendente na fila.
 */
export function enqueueRelatorioPush(localId: string): void {
  const db = getDatabase();
  const jaNaFila = db.getFirstSync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM sync_queue WHERE entity = 'relatorio_tecnico' AND payload = ?`,
    [JSON.stringify({ localId })]
  );
  if ((jaNaFila?.total ?? 0) > 0) {
    return;
  }
  db.runSync(
    `INSERT INTO sync_queue (id, entity, operation, payload, retries, created_at)
     VALUES (?, 'relatorio_tecnico', 'push', ?, 0, datetime('now'))`,
    [gerarUUID(), JSON.stringify({ localId })]
  );
  console.log(`[enqueueRelatorioPush] Relatório técnico ${localId} adicionado à fila`);
}

/**
 * Quantidade de relatórios técnicos aguardando envio na fila SQLite `sync_queue`.
 */
export function getPendingRelatoriosCount(): number {
  const db = getDatabase();
  const row = db.getFirstSync<{ total: number }>(
    `SELECT COUNT(*) AS total FROM sync_queue WHERE entity = 'relatorio_tecnico'`
  );
  return row?.total ?? 0;
}

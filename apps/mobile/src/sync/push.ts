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
import { ApiError } from '../api/client';
import { pullModeloRelatorioTecnico } from './pull';
import { FilaRepo, type EntidadeFila, type ItemFila } from '../db/repositories/fila.repo';
import { useAuthStore } from '../store/auth';
import { pushCheckin } from './push-checkin';
import { ehFalhaDefinitiva, ehSessaoExpirada } from './erros';

const auditoriaRepo = new AuditoriaRepo();
const itemRepo = new AuditoriaItemRepo();
const fotoRepo = new FotoRepo();
const relatorioRepo = new RelatorioTecnicoRepo();
const relatorioFotoRepo = new RelatorioFotoRepo();
const filaRepo = new FilaRepo();

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

  const itens = itemRepo.findByAuditoria(localId);

  onProgress?.('criando');
  const { id: remoteId, itens: remoteItens } = await createAuditoria({
    localId: auditoria.localId,
    clienteId: auditoria.clienteId,
    unidadeId: auditoria.unidadeId,
    templateId: auditoria.templateId!,
    dataInicio: auditoria.dataInicio!,
    templateItemIds: itens.map(i => i.templateItemId),
    latitudeInicio: auditoria.latitudeInicio ?? undefined,
    longitudeInicio: auditoria.longitudeInicio ?? undefined,
  });
  // Grava o vínculo antes de enviar itens: uma nova tentativa reaproveita o mesmo registro
  auditoriaRepo.setRemoteId(localId, remoteId);
  console.log(`[pushAuditoria] Criada no servidor — remoteId=${remoteId}, ${remoteItens.length} itens remotos`);

  const remoteItemMap = new Map(remoteItens.map(i => [i.templateItemId, i.id]));

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
      if (foto.syncStatus === 'synced' || foto.remoteId) {
        fotosEnviadas++;
        continue;
      }
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

  if (fotosErro > 0) {
    throw new Error(`${fotosErro} foto(s) não foram enviadas; a auditoria não foi finalizada.`);
  }

  onProgress?.('finalizando');
  await finalizarAuditoria(remoteId, {
    dataFim: auditoria.dataFim ?? undefined,
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
  try {
    await atualizarRelatorioTecnico(remoteId, payload);
  } catch (e) {
    // RN-REL-013: o modelo mudou desde a finalização offline — volta a rascunho com aviso
    if (!(e instanceof ApiError) || e.status !== 409 || payload.status !== 'finalizado') {
      throw e;
    }
    console.warn(`[pushRelatorioTecnico] Finalização recusada (${e.message}); voltando a rascunho`);
    relatorioRepo.voltarParaRascunho(localId, e.message);
    await pullModeloRelatorioTecnico(); // não lança: mantém o cache em caso de falha
    delete payload.status;
    await atualizarRelatorioTecnico(remoteId, payload);
  }

  relatorioRepo.markSynced(localId, remoteId);
  console.log(`[pushRelatorioTecnico] Concluído — remoteId=${remoteId}`);
}

function usuarioLogadoId(): string | null {
  return useAuthStore.getState().user?.id ?? null;
}

/** Ponto único de despacho por entidade da fila. */
async function enviarItem(entidade: EntidadeFila, localId: string): Promise<boolean> {
  switch (entidade) {
    case 'auditoria':
      await pushAuditoria(localId);
      return true;
    case 'relatorio_tecnico':
      await pushRelatorioTecnico(localId);
      return true;
    case 'checkin':
      await pushCheckin(localId);
      return true;
    default:
      return false;
  }
}

/** Envia um item da fila: sucesso remove; falha é registrada (401 não conta tentativa). Devolve o erro, se houver. */
type ResultadoItem = { erro?: unknown; ignorado?: boolean };

// Envios em andamento por id de item da fila: impede dois envios simultâneos do mesmo item
const emAndamento = new Map<string, Promise<ResultadoItem>>();

function processarItem(item: ItemFila, onProgress?: PushProgressCallback): Promise<ResultadoItem> {
  if (emAndamento.has(item.id)) return Promise.resolve({ ignorado: true });
  const execucao = executarItem(item, onProgress).finally(() => emAndamento.delete(item.id));
  emAndamento.set(item.id, execucao);
  return execucao;
}

async function executarItem(item: ItemFila, onProgress?: PushProgressCallback): Promise<ResultadoItem> {
  try {
    const enviado = item.entidade === 'auditoria'
      ? (await pushAuditoria(item.localId, onProgress), true)
      : await enviarItem(item.entidade, item.localId);
    if (enviado) {
      filaRepo.remover(item.id);
      console.log(`[pushPending] Sucesso (${item.entidade}): ${item.localId}`);
    }
    return {};
  } catch (e) {
    console.error(`[pushPending] Erro ao enviar item ${item.id}:`, e);
    if (!ehSessaoExpirada(e)) {
      const mensagem = e instanceof Error ? e.message : 'Erro desconhecido no envio.';
      filaRepo.registrarFalha(item.id, mensagem, ehFalhaDefinitiva(e));
    }
    return { erro: e };
  }
}

export async function pushPending(): Promise<void> {
  const usuarioId = usuarioLogadoId();
  if (!usuarioId) return;

  const items = filaRepo.listarParaEnvio(usuarioId);
  console.log(`[pushPending] ${items.length} item(s) na fila`);

  for (const item of items) {
    // outro envio pode ter concluído e removido este item depois do instantâneo
    if (!filaRepo.estado(item.entidade, item.localId)) continue;
    const { erro } = await processarItem(item);
    if (ehSessaoExpirada(erro)) break; // sessão expirou: não gasta tentativas dos próximos itens
  }
}

/**
 * Envia agora uma auditoria já enfileirada, pelo mesmo caminho da fila. Em caso de
 * falha o item continua na fila com o erro registrado e o erro é relançado à tela.
 */
export async function enviarAuditoriaAgora(
  localId: string,
  onProgress?: PushProgressCallback,
): Promise<void> {
  const usuarioId = usuarioLogadoId();
  if (!usuarioId) throw new Error('Sessão não encontrada. Entre novamente.');
  const item = filaRepo.listarParaEnvio(usuarioId)
    .find((i) => i.entidade === 'auditoria' && i.localId === localId);
  if (!item) {
    // já enviada por outro envio (sai da fila ao concluir)
    if (!filaRepo.estado('auditoria', localId)) return;
    throw new Error('Auditoria não encontrada na fila de envio.');
  }
  const andamento = emAndamento.get(item.id);
  const { erro } = andamento ? await andamento : await processarItem(item, onProgress);
  if (erro) throw erro;
}

export function enqueuePush(localId: string): void {
  const usuarioId = usuarioLogadoId();
  if (!usuarioId) return;
  filaRepo.enfileirar('auditoria', localId, usuarioId);
  console.log(`[enqueuePush] Auditoria ${localId} adicionada à fila`);
}

/** Quantidade de auditorias aguardando envio (ou com falha) da usuária logada. */
export function getPendingCount(): number {
  const usuarioId = usuarioLogadoId();
  return usuarioId ? filaRepo.contarPendentes(usuarioId, 'auditoria') : 0;
}

/** Enfileira um relatório técnico para envio quando houver conexão (sem duplicar). */
export function enqueueRelatorioPush(localId: string): void {
  const usuarioId = usuarioLogadoId();
  if (!usuarioId) return;
  filaRepo.enfileirar('relatorio_tecnico', localId, usuarioId);
  console.log(`[enqueueRelatorioPush] Relatório técnico ${localId} adicionado à fila`);
}

/** Quantidade de relatórios técnicos aguardando envio (ou com falha) da usuária logada. */
export function getPendingRelatoriosCount(): number {
  const usuarioId = usuarioLogadoId();
  return usuarioId ? filaRepo.contarPendentes(usuarioId, 'relatorio_tecnico') : 0;
}

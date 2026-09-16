import { create } from 'zustand';
import { AuditoriaRepo, type AuditoriaCompleta } from '../db/repositories/auditoria.repo';
import { AuditoriaItemRepo, type AuditoriaItemCompleto, type RespostaInput } from '../db/repositories/auditoria-item.repo';
import { pullAuditoriaDetalhe } from '../sync/pull';
import { SyncService } from '../sync/SyncService';

interface AuditoriaStore {
  auditoria: AuditoriaCompleta | null;
  itens: AuditoriaItemCompleto[];
  isLoading: boolean;
  error: string | null;

  iniciar(auditoriaId: string): void;
  carregar(auditoriaId: string): void;
  hidratarDetalhe(auditoriaId: string): Promise<void>;
  salvarResposta(itemId: string, resposta: RespostaInput): void;
  finalizar(): void;
  recarregar(): void;
  limpar(): void;
}

const auditoriaRepo = new AuditoriaRepo();
const itemRepo = new AuditoriaItemRepo();

export const useAuditoriaStore = create<AuditoriaStore>((set, get) => ({
  auditoria: null,
  itens: [],
  isLoading: false,
  error: null,

  iniciar(auditoriaId) {
    set({ isLoading: true, error: null });
    try {
      const auditoria = auditoriaRepo.findById(auditoriaId);
      if (!auditoria) {
        set({ isLoading: false, error: 'Auditoria não encontrada.' });
        return;
      }
      const itens = itemRepo.findByAuditoria(auditoriaId);
      if (auditoria.status === 'rascunho') {
        auditoriaRepo.updateStatus(auditoriaId, 'em_andamento');
      }
      const status = auditoria.status === 'rascunho' ? 'em_andamento' : auditoria.status;
      set({ auditoria: { ...auditoria, status }, itens, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Erro ao carregar auditoria.' });
    }
  },

  carregar(auditoriaId) {
    set({ isLoading: true, error: null });
    try {
      const auditoria = auditoriaRepo.findById(auditoriaId);
      if (!auditoria) {
        set({ isLoading: false, error: 'Auditoria não encontrada.' });
        return;
      }
      const itens = itemRepo.findByAuditoria(auditoriaId);
      set({ auditoria, itens, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Erro ao carregar auditoria.' });
    }
  },

  async hidratarDetalhe(auditoriaId) {
    const auditoria = auditoriaRepo.findById(auditoriaId);
    if (!auditoria?.remoteId) return;
    const online = await SyncService.isOnline();
    if (!online) return;
    try {
      await pullAuditoriaDetalhe({ localId: auditoria.id, remoteId: auditoria.remoteId });
      if (get().auditoria?.id !== auditoriaId) return;
      const itens = itemRepo.findByAuditoria(auditoriaId);
      set({ itens });
    } catch (e) {
      console.warn('[useAuditoriaStore] Falha ao hidratar detalhe; mantendo dados locais:', e);
    }
  },

  salvarResposta(itemId, resposta) {
    itemRepo.upsertResposta(itemId, resposta);
    set(state => ({
      itens: state.itens.map(i =>
        i.id === itemId
          ? { ...i, resposta: resposta.resposta,
              observacao: resposta.observacao ?? null,
              descricaoNaoConformidade: resposta.descricaoNaoConformidade ?? null,
              planoAcaoFinal: resposta.planoAcaoFinal ?? null,
              pontuacao: resposta.pontuacao ?? 0,
              descricaoIa: resposta.descricaoIa ?? null,
              complementoDescricao: resposta.complementoDescricao ?? null,
              planoAcaoSugerido: resposta.planoAcaoSugerido ?? null,
              referenciaLegal: resposta.referenciaLegal ?? null }
          : i
      ),
    }));
  },

  finalizar() {
    const { auditoria, itens } = get();
    if (!auditoria) return;
    const pontuacao = itens.reduce((sum, i) => sum + i.pontuacao, 0);
    auditoriaRepo.finalizarLocal(auditoria.id, pontuacao);
    const dataFim = new Date().toISOString();
    set(state => ({
      auditoria: state.auditoria
        ? { ...state.auditoria, status: 'concluida', pontuacaoTotal: pontuacao, dataFim }
        : null,
    }));
  },

  recarregar() {
    const { auditoria } = get();
    if (!auditoria) return;
    const updated = auditoriaRepo.findById(auditoria.id);
    if (updated) {
      const itens = itemRepo.findByAuditoria(auditoria.id);
      set({ auditoria: updated, itens });
    }
  },

  limpar() {
    set({ auditoria: null, itens: [], isLoading: false, error: null });
  },
}));

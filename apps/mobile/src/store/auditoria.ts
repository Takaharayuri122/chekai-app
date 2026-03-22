import { create } from 'zustand';
import { AuditoriaRepo, type AuditoriaCompleta } from '../db/repositories/auditoria.repo';
import { AuditoriaItemRepo, type AuditoriaItemCompleto, type RespostaInput } from '../db/repositories/auditoria-item.repo';

interface AuditoriaStore {
  auditoria: AuditoriaCompleta | null;
  itens: AuditoriaItemCompleto[];
  isLoading: boolean;
  error: string | null;

  iniciar(auditoriaId: string): void;
  salvarResposta(itemId: string, resposta: RespostaInput): void;
  finalizar(): void;
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
      auditoriaRepo.updateStatus(auditoriaId, 'em_andamento');
      set({ auditoria: { ...auditoria, status: 'em_andamento' }, itens, isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Erro ao carregar auditoria.' });
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
              planoAcaoSugerido: resposta.planoAcaoSugerido ?? null }
          : i
      ),
    }));
  },

  finalizar() {
    const { auditoria, itens } = get();
    if (!auditoria) return;
    const pontuacao = itens.reduce((sum, i) => sum + i.pontuacao, 0);
    auditoriaRepo.updateStatus(auditoria.id, 'concluida');
    auditoriaRepo.updatePontuacao(auditoria.id, pontuacao);
    set(state => ({
      auditoria: state.auditoria
        ? { ...state.auditoria, status: 'concluida', pontuacaoTotal: pontuacao }
        : null,
    }));
  },

  limpar() {
    set({ auditoria: null, itens: [], isLoading: false, error: null });
  },
}));

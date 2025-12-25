'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Save,
  Scale,
  Building,
  Link as LinkIcon,
  FileText,
  Hash,
  Calendar,
  Plus,
  Trash2,
  Layers,
  ExternalLink,
  Edit3,
  X,
  BookOpen,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import {
  legislacaoService,
  Legislacao,
  LegislacaoChunk,
  TipoLegislacao,
  TIPO_LEGISLACAO_LABELS,
  CriarChunkRequest,
} from '@/lib/api';

/**
 * Página de detalhes e edição de legislação.
 */
export default function LegislacaoDetalhesPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { isAuthenticated } = useAuthStore();
  const [legislacao, setLegislacao] = useState<Legislacao | null>(null);
  const [chunks, setChunks] = useState<LegislacaoChunk[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showChunkModal, setShowChunkModal] = useState(false);
  const [formData, setFormData] = useState<Partial<Legislacao>>({});
  const [novoChunk, setNovoChunk] = useState<CriarChunkRequest>({
    conteudo: '',
    artigo: '',
    inciso: '',
    paragrafo: '',
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [leg, chunkList] = await Promise.all([
        legislacaoService.buscarPorId(id),
        legislacaoService.listarChunks(id),
      ]);
      setLegislacao(leg);
      setChunks(chunkList);
      setFormData(leg);
    } catch {
      alert('Erro ao carregar legislação');
      router.push('/legislacoes');
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadData();
  }, [isAuthenticated, router, loadData]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await legislacaoService.atualizar(id, formData);
      setIsEditing(false);
      loadData();
    } catch {
      alert('Erro ao salvar legislação');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddChunk = async () => {
    if (!novoChunk.conteudo.trim()) {
      alert('Preencha o conteúdo do chunk');
      return;
    }
    try {
      setIsSaving(true);
      await legislacaoService.adicionarChunks(id, [novoChunk]);
      setNovoChunk({ conteudo: '', artigo: '', inciso: '', paragrafo: '' });
      setShowChunkModal(false);
      loadData();
    } catch {
      alert('Erro ao adicionar chunk');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveChunk = async (chunkId: string) => {
    if (!confirm('Tem certeza que deseja remover este chunk?')) return;
    try {
      await legislacaoService.removerChunk(chunkId);
      loadData();
    } catch {
      alert('Erro ao remover chunk');
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (!legislacao) return null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/60 backdrop-blur-xl border-b border-indigo-500/20 px-6 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/legislacoes')}
              className="p-2 hover:bg-slate-700/50 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-indigo-300" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">
                {TIPO_LEGISLACAO_LABELS[legislacao.tipo]} {legislacao.numero}/{legislacao.ano}
              </h1>
              <p className="text-sm text-indigo-300/70 truncate max-w-[200px]">
                {legislacao.orgaoEmissor || 'Legislação'}
              </p>
            </div>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="p-2 bg-indigo-600/20 hover:bg-indigo-600/30 rounded-xl transition-colors"
            >
              <Edit3 className="w-5 h-5 text-indigo-400" />
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </button>
          )}
        </div>
      </header>

      <div className="px-6 py-6 space-y-6 pb-32">
        {/* Informações da Legislação */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/40 rounded-2xl border border-indigo-500/20 p-6 backdrop-blur-sm space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-400" />
              Informações
            </h2>
            {legislacao.linkOficial && (
              <a
                href={legislacao.linkOficial}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Abrir link oficial
              </a>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-2">
                    Tipo
                  </label>
                  <select
                    value={formData.tipo || TipoLegislacao.RDC}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value as TipoLegislacao })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-indigo-500/20 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  >
                    {Object.values(TipoLegislacao).map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {TIPO_LEGISLACAO_LABELS[tipo]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-2">
                    Número
                  </label>
                  <input
                    type="text"
                    value={formData.numero || ''}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-indigo-500/20 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-2">
                    Ano
                  </label>
                  <input
                    type="number"
                    value={formData.ano || ''}
                    onChange={(e) => setFormData({ ...formData, ano: parseInt(e.target.value, 10) })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-indigo-500/20 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-2">
                    Órgão Emissor
                  </label>
                  <input
                    type="text"
                    value={formData.orgaoEmissor || ''}
                    onChange={(e) => setFormData({ ...formData, orgaoEmissor: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-indigo-500/20 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-indigo-200 mb-2">
                  Título
                </label>
                <input
                  type="text"
                  value={formData.titulo || ''}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-indigo-500/20 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indigo-200 mb-2">
                  Ementa
                </label>
                <textarea
                  value={formData.ementa || ''}
                  onChange={(e) => setFormData({ ...formData, ementa: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-indigo-500/20 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-indigo-200 mb-2">
                  Link Oficial
                </label>
                <input
                  type="url"
                  value={formData.linkOficial || ''}
                  onChange={(e) => setFormData({ ...formData, linkOficial: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700/50 border border-indigo-500/20 rounded-xl text-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <h3 className="text-white font-medium">{legislacao.titulo}</h3>
                {legislacao.ementa && (
                  <p className="text-indigo-200/70 text-sm mt-2">{legislacao.ementa}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg">
                  {TIPO_LEGISLACAO_LABELS[legislacao.tipo]}
                </span>
                <span className="flex items-center gap-1 text-indigo-300/70">
                  <Hash className="w-3.5 h-3.5" />
                  {legislacao.numero}
                </span>
                <span className="flex items-center gap-1 text-indigo-300/70">
                  <Calendar className="w-3.5 h-3.5" />
                  {legislacao.ano}
                </span>
                {legislacao.orgaoEmissor && (
                  <span className="flex items-center gap-1 text-indigo-300/70">
                    <Building className="w-3.5 h-3.5" />
                    {legislacao.orgaoEmissor}
                  </span>
                )}
              </div>
            </div>
          )}
        </motion.div>

        {/* Chunks RAG */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/40 rounded-2xl border border-indigo-500/20 p-6 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              Chunks RAG
              <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-xs rounded-lg">
                {chunks.length}
              </span>
            </h2>
            <button
              onClick={() => setShowChunkModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>

          {chunks.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <BookOpen className="w-8 h-8 text-indigo-400" />
              </div>
              <p className="text-indigo-200/70 mb-4">
                Nenhum chunk cadastrado ainda
              </p>
              <button
                onClick={() => setShowChunkModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar primeiro chunk
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {chunks.map((chunk, index) => (
                <motion.div
                  key={chunk.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-slate-700/30 rounded-xl p-4 border border-indigo-500/10 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      {(chunk.artigo || chunk.inciso || chunk.paragrafo) && (
                        <div className="flex flex-wrap gap-2 mb-2">
                          {chunk.artigo && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-xs rounded">
                              {chunk.artigo}
                            </span>
                          )}
                          {chunk.inciso && (
                            <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-xs rounded">
                              {chunk.inciso}
                            </span>
                          )}
                          {chunk.paragrafo && (
                            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-xs rounded">
                              {chunk.paragrafo}
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-indigo-100/90 text-sm leading-relaxed line-clamp-4">
                        {chunk.conteudo}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveChunk(chunk.id)}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Modal Adicionar Chunk */}
      <AnimatePresence>
        {showChunkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-4"
            onClick={() => setShowChunkModal(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-800 rounded-t-3xl rounded-b-xl border border-indigo-500/20 p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">Adicionar Chunk</h3>
                <button
                  onClick={() => setShowChunkModal(false)}
                  className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-indigo-300" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-indigo-200 mb-2">
                      Artigo
                    </label>
                    <input
                      type="text"
                      value={novoChunk.artigo || ''}
                      onChange={(e) => setNovoChunk({ ...novoChunk, artigo: e.target.value })}
                      placeholder="Art. 5º"
                      className="w-full px-3 py-2 bg-slate-700/50 border border-indigo-500/20 rounded-lg text-white text-sm placeholder-indigo-300/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-200 mb-2">
                      Inciso
                    </label>
                    <input
                      type="text"
                      value={novoChunk.inciso || ''}
                      onChange={(e) => setNovoChunk({ ...novoChunk, inciso: e.target.value })}
                      placeholder="I"
                      className="w-full px-3 py-2 bg-slate-700/50 border border-indigo-500/20 rounded-lg text-white text-sm placeholder-indigo-300/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-indigo-200 mb-2">
                      Parágrafo
                    </label>
                    <input
                      type="text"
                      value={novoChunk.paragrafo || ''}
                      onChange={(e) => setNovoChunk({ ...novoChunk, paragrafo: e.target.value })}
                      placeholder="§1º"
                      className="w-full px-3 py-2 bg-slate-700/50 border border-indigo-500/20 rounded-lg text-white text-sm placeholder-indigo-300/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-indigo-200 mb-2">
                    Conteúdo *
                  </label>
                  <textarea
                    value={novoChunk.conteudo}
                    onChange={(e) => setNovoChunk({ ...novoChunk, conteudo: e.target.value })}
                    placeholder="Cole aqui o trecho da legislação que será usado para consultas RAG..."
                    rows={6}
                    className="w-full px-4 py-3 bg-slate-700/50 border border-indigo-500/20 rounded-xl text-white placeholder-indigo-300/50 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                  />
                </div>

                <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-xl p-3">
                  <p className="text-xs text-indigo-200/70">
                    💡 Divida o texto em chunks menores (até ~500 palavras) para melhor precisão nas buscas.
                  </p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowChunkModal(false)}
                    className="flex-1 px-4 py-3 bg-slate-700/50 text-indigo-200 rounded-xl font-medium hover:bg-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAddChunk}
                    disabled={isSaving || !novoChunk.conteudo.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-medium disabled:opacity-50"
                  >
                    <Plus className="w-5 h-5" />
                    {isSaving ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}


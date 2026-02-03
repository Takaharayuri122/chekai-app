'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  Scale,
  Plus,
  Search,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  Building2,
  ClipboardCheck,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import {
  legislacaoService,
  Legislacao,
  TIPO_LEGISLACAO_LABELS,
} from '@/lib/api';
import { toastService } from '@/lib/toast';

/**
 * Página de listagem de legislações.
 */
export default function LegislacoesPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [legislacoes, setLegislacoes] = useState<Legislacao[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuAberto, setMenuAberto] = useState<string | null>(null);

  const loadLegislacoes = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await legislacaoService.listar();
      setLegislacoes(data);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadLegislacoes();
  }, [isAuthenticated, router, loadLegislacoes]);

  const handleRemover = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta legislação?')) return;
    try {
      await legislacaoService.remover(id);
      toastService.success('Legislação removida com sucesso!');
      loadLegislacoes();
    } catch (error) {
      // Erro já é tratado pelo interceptor
    }
    setMenuAberto(null);
  };

  const legislacoesFiltradas = legislacoes.filter(
    (leg) =>
      leg.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      leg.numero.includes(searchTerm) ||
      leg.orgaoEmissor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/60 backdrop-blur-xl border-b border-primary/20 px-6 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="p-2 hover:bg-slate-700/50 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-primary" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white font-display">Legislações</h1>
              <p className="text-sm text-primary/70">
                {legislacoes.length} cadastradas • Base RAG
              </p>
            </div>
          </div>
          <Link
            href="/admin/legislacoes/nova"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-primary/80 text-white rounded-xl font-medium shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
          >
            <Plus className="w-4 h-4" />
            Nova
          </Link>
        </div>
      </header>

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary-400" />
          <input
            type="text"
            placeholder="Buscar por título, número, órgão..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-800/50 backdrop-blur-sm border border-primary-500/20 rounded-xl text-white placeholder-indigo-300/50 focus:border-primary-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-r from-primary-600/20 to-primary-600/20 border border-primary-500/30 rounded-2xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <Layers className="w-5 h-5 text-primary-400" />
            </div>
            <div>
              <h3 className="font-medium text-white mb-1">Base de Conhecimento RAG</h3>
              <p className="text-sm text-primary-200/70">
                As legislações cadastradas aqui alimentam o sistema de IA para gerar 
                recomendações e textos técnicos baseados nas normas vigentes.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Lista de Legislações */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : legislacoesFiltradas.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-800/40 rounded-2xl border border-primary-500/20 p-12 text-center backdrop-blur-sm"
          >
            <div className="w-20 h-20 bg-primary-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Scale className="w-10 h-10 text-primary-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Nenhuma legislação encontrada
            </h3>
            <p className="text-primary-300/70 mb-6">
              {searchTerm
                ? 'Tente buscar com outros termos'
                : 'Adicione legislações para alimentar a base de conhecimento'}
            </p>
            <Link
              href="/admin/legislacoes/nova"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-600 text-white rounded-xl font-medium"
            >
              <Plus className="w-4 h-4" />
              Adicionar Legislação
            </Link>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {legislacoesFiltradas.map((leg, index) => (
              <motion.div
                key={leg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-slate-800/40 rounded-2xl border border-primary-500/20 p-5 backdrop-blur-sm hover:border-primary-500/40 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500/20 to-primary-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Scale className="w-6 h-6 text-primary-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white truncate">
                          {TIPO_LEGISLACAO_LABELS[leg.tipo]} {leg.numero}/{leg.ano}
                        </h3>
                        <p className="text-sm text-primary-200/70 line-clamp-2">
                          {leg.titulo}
                        </p>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setMenuAberto(menuAberto === leg.id ? null : leg.id)}
                          className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-primary-300" />
                        </button>
                        {menuAberto === leg.id && (
                          <div className="absolute right-0 top-full mt-1 bg-slate-800 rounded-xl border border-primary-500/20 shadow-xl py-2 min-w-[160px] z-50">
                            <Link
                              href={`/admin/legislacoes/${leg.id}`}
                              className="flex items-center gap-3 px-4 py-2 hover:bg-slate-700/50 text-primary-200"
                            >
                              <Edit className="w-4 h-4" />
                              Editar
                            </Link>
                            {leg.linkOficial && (
                              <a
                                href={leg.linkOficial}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 px-4 py-2 hover:bg-slate-700/50 text-primary-200"
                              >
                                <ExternalLink className="w-4 h-4" />
                                Abrir Link
                              </a>
                            )}
                            <button
                              onClick={() => handleRemover(leg.id)}
                              className="flex items-center gap-3 px-4 py-2 hover:bg-red-500/10 text-red-400 w-full"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remover
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-3 text-sm">
                      <span className="px-2 py-1 bg-primary-500/20 text-primary-300 text-xs font-medium rounded-lg">
                        {TIPO_LEGISLACAO_LABELS[leg.tipo]}
                      </span>
                      {leg.orgaoEmissor && (
                        <span className="text-primary-300/60">
                          {leg.orgaoEmissor}
                        </span>
                      )}
                      {leg.chunks && leg.chunks.length > 0 && (
                        <span className="flex items-center gap-1 text-primary">
                          <Layers className="w-3.5 h-3.5" />
                          {leg.chunks.length} chunks
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/admin/legislacoes/${leg.id}`}
                    className="p-2 hover:bg-primary-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight className="w-5 h-5 text-primary-400" />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-xl border-t border-primary-500/20 px-6 py-3 z-50">
        <div className="flex items-center justify-around max-w-md mx-auto">
          <Link
            href="/admin/dashboard"
            className="flex flex-col items-center gap-1 text-primary-300/60 hover:text-primary-300 transition-colors"
          >
            <ClipboardCheck className="w-6 h-6" />
            <span className="text-xs">Início</span>
          </Link>
          <Link
            href="/admin/clientes"
            className="flex flex-col items-center gap-1 text-primary-300/60 hover:text-primary-300 transition-colors"
          >
            <Building2 className="w-6 h-6" />
            <span className="text-xs">Clientes</span>
          </Link>
          <Link
            href="/admin/legislacoes"
            className="flex flex-col items-center gap-1 text-primary-400"
          >
            <Scale className="w-6 h-6" />
            <span className="text-xs font-medium">Legislações</span>
          </Link>
          <Link
            href="/admin/templates"
            className="flex flex-col items-center gap-1 text-primary-300/60 hover:text-primary-300 transition-colors"
          >
            <FileText className="w-6 h-6" />
            <span className="text-xs">Templates</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}


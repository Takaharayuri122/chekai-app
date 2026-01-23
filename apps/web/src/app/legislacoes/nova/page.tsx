'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  Save,
  Scale,
  Building,
  Link as LinkIcon,
  FileText,
  Hash,
  Calendar,
} from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import {
  legislacaoService,
  TipoLegislacao,
  TIPO_LEGISLACAO_LABELS,
  CriarLegislacaoRequest,
} from '@/lib/api';
import { toastService } from '@/lib/toast';

/**
 * Página de criação de nova legislação.
 */
export default function NovaLegislacaoPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<CriarLegislacaoRequest>({
    tipo: TipoLegislacao.RDC,
    numero: '',
    ano: new Date().getFullYear(),
    titulo: '',
    ementa: '',
    orgaoEmissor: '',
    linkOficial: '',
  });

  if (!isAuthenticated) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.numero || !formData.titulo) {
      toastService.warning('Preencha os campos obrigatórios');
      return;
    }
    try {
      setIsLoading(true);
      const legislacao = await legislacaoService.criar(formData);
      toastService.success('Legislação criada com sucesso!');
      router.push(`/legislacoes/${legislacao.id}`);
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof CriarLegislacaoRequest, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/60 backdrop-blur-xl border-b border-primary/20 px-6 py-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-slate-700/50 rounded-xl transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-primary" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white font-display">Nova Legislação</h1>
              <p className="text-sm text-primary/70">
                Adicionar à base de conhecimento RAG
              </p>
            </div>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="px-4 py-4 lg:px-8 space-y-4 pb-32">
        {/* Tipo e Número */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-800/40 rounded-2xl border border-primary/20 p-6 backdrop-blur-sm space-y-4"
        >
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 font-display">
            <Scale className="w-5 h-5 text-primary" />
            Identificação
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary/80 mb-2">
                Tipo *
              </label>
              <select
                value={formData.tipo}
                onChange={(e) => handleChange('tipo', e.target.value as TipoLegislacao)}
                className="w-full px-4 py-3 bg-slate-700/50 border border-primary/20 rounded-xl text-white focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              >
                {Object.values(TipoLegislacao).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPO_LEGISLACAO_LABELS[tipo]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-200 mb-2">
                <Hash className="w-4 h-4 inline mr-1" />
                Número *
              </label>
              <input
                type="text"
                value={formData.numero}
                onChange={(e) => handleChange('numero', e.target.value)}
                placeholder="216"
                className="w-full px-4 py-3 bg-slate-700/50 border border-primary-500/20 rounded-xl text-white placeholder-indigo-300/50 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary-200 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Ano *
              </label>
              <input
                type="number"
                value={formData.ano}
                onChange={(e) => handleChange('ano', parseInt(e.target.value, 10))}
                min={1900}
                max={2100}
                className="w-full px-4 py-3 bg-slate-700/50 border border-primary-500/20 rounded-xl text-white placeholder-indigo-300/50 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-200 mb-2">
                <Building className="w-4 h-4 inline mr-1" />
                Órgão Emissor
              </label>
              <input
                type="text"
                value={formData.orgaoEmissor || ''}
                onChange={(e) => handleChange('orgaoEmissor', e.target.value)}
                placeholder="ANVISA"
                className="w-full px-4 py-3 bg-slate-700/50 border border-primary-500/20 rounded-xl text-white placeholder-indigo-300/50 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
              />
            </div>
          </div>
        </motion.div>

        {/* Título e Ementa */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-800/40 rounded-2xl border border-primary-500/20 p-6 backdrop-blur-sm space-y-4"
        >
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-400" />
            Conteúdo
          </h2>

          <div>
            <label className="block text-sm font-medium text-primary-200 mb-2">
              Título *
            </label>
            <input
              type="text"
              value={formData.titulo}
              onChange={(e) => handleChange('titulo', e.target.value)}
              placeholder="Regulamento Técnico de Boas Práticas..."
              className="w-full px-4 py-3 bg-slate-700/50 border border-primary-500/20 rounded-xl text-white placeholder-indigo-300/50 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-200 mb-2">
              Ementa
            </label>
            <textarea
              value={formData.ementa || ''}
              onChange={(e) => handleChange('ementa', e.target.value)}
              placeholder="Dispõe sobre o Regulamento Técnico de Boas Práticas para Serviços de Alimentação..."
              rows={4}
              className="w-full px-4 py-3 bg-slate-700/50 border border-primary-500/20 rounded-xl text-white placeholder-indigo-300/50 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-primary-200 mb-2">
              <LinkIcon className="w-4 h-4 inline mr-1" />
              Link Oficial
            </label>
            <input
              type="url"
              value={formData.linkOficial || ''}
              onChange={(e) => handleChange('linkOficial', e.target.value)}
              placeholder="https://www.gov.br/anvisa/..."
              className="w-full px-4 py-3 bg-slate-700/50 border border-primary-500/20 rounded-xl text-white placeholder-indigo-300/50 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            />
          </div>
        </motion.div>

        {/* Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-primary-600/10 border border-primary-500/20 rounded-2xl p-4"
        >
          <p className="text-sm text-primary-200/70">
            💡 Após criar a legislação, você poderá adicionar os <strong>chunks</strong> (trechos de texto) 
            que serão usados pelo sistema de IA para gerar recomendações baseadas nas normas.
          </p>
        </motion.div>
      </form>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-800/90 backdrop-blur-xl border-t border-primary-500/20 px-6 py-4 z-50">
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-4 py-3 bg-slate-700/50 text-primary-200 rounded-xl font-medium hover:bg-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-primary to-primary/80 text-white rounded-xl font-medium shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 transition-all disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {isLoading ? 'Salvando...' : 'Criar Legislação'}
          </button>
        </div>
      </div>
    </main>
  );
}


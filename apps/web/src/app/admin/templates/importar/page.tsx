'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileSpreadsheet,
  ChevronLeft,
  Check,
  AlertTriangle,
  FolderOpen,
  Loader2,
  X,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { AppLayout } from '@/components';
import {
  checklistService,
  ImportacaoPreview,
  ImportacaoResultado,
  TipoAtividade,
  TIPO_ATIVIDADE_LABELS,
} from '@/lib/api';
import { toastService } from '@/lib/toast';

type Step = 'upload' | 'preview' | 'config' | 'result';

/**
 * Página de importação de checklists.
 */
export default function ImportarChecklistPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportacaoPreview | null>(null);
  const [resultado, setResultado] = useState<ImportacaoResultado | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const [formData, setFormData] = useState({
    nomeTemplate: '',
    descricao: '',
    tipoAtividade: TipoAtividade.OUTRO,
    versao: '1.0',
  });

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    const isCsv = selectedFile.name.toLowerCase().endsWith('.csv');
    const isXlsx = selectedFile.name.toLowerCase().endsWith('.xlsx');
    if (!isCsv && !isXlsx) {
      setErro('Por favor, selecione um arquivo CSV ou XLSX válido.');
      return;
    }

    setFile(selectedFile);
    setErro('');
    setLoading(true);

    try {
      const previewData = await checklistService.previewImportacao(selectedFile);
      setPreview(previewData);
      setFormData((prev) => ({
        ...prev,
        nomeTemplate: previewData.nomeOriginal || 'Checklist Importado',
      }));
      setStep('preview');
    } catch {
      setErro('Erro ao processar o arquivo. Verifique se é um CSV ou XLSX válido.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleImportar = async () => {
    if (!file || !formData.nomeTemplate.trim()) return;

    setLoading(true);
    setErro('');

    try {
      const result = await checklistService.importarChecklist(file, {
        nomeTemplate: formData.nomeTemplate,
        descricao: formData.descricao,
        tipoAtividade: formData.tipoAtividade,
        versao: formData.versao,
      });
      toastService.success(`Checklist importado com sucesso! ${result.itensCriados} itens criados.`);
      setResultado(result);
      setStep('result');
    } catch (error) {
      // Erro já é tratado pelo interceptor
    } finally {
      setLoading(false);
    }
  };

  const handleNovaImportacao = () => {
    setStep('upload');
    setFile(null);
    setPreview(null);
    setResultado(null);
    setFormData({
      nomeTemplate: '',
      descricao: '',
      tipoAtividade: TipoAtividade.OUTRO,
      versao: '1.0',
    });
  };

  return (
    <AppLayout>
      {/* Header */}
      <div className="bg-base-100 border-b border-base-300 px-4 lg:px-8 py-4 sticky top-16 z-30">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <Link href="/admin/templates" className="btn btn-ghost btn-sm btn-circle">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-base-content">Importar Checklist</h1>
            <p className="text-sm text-base-content/60">Importe checklists a partir de arquivos CSV ou XLSX</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {/* Steps Indicator */}
        <div className="mb-8">
          <ul className="steps steps-horizontal w-full">
            <li className={`step ${step !== 'upload' ? 'step-primary' : 'step-primary'}`}>Upload</li>
            <li className={`step ${step === 'preview' || step === 'config' || step === 'result' ? 'step-primary' : ''}`}>
              Preview
            </li>
            <li className={`step ${step === 'config' || step === 'result' ? 'step-primary' : ''}`}>Configurar</li>
            <li className={`step ${step === 'result' ? 'step-primary' : ''}`}>Concluído</li>
          </ul>
        </div>

        {/* Erro */}
        {erro && (
          <div className="alert alert-error mb-6">
            <AlertTriangle className="w-5 h-5" />
            <span>{erro}</span>
            <button onClick={() => setErro('')} className="btn btn-ghost btn-sm btn-circle">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="card bg-base-100 shadow-sm border border-base-300"
            >
              <div className="card-body items-center text-center py-12">
                <div
                  className={`w-full max-w-md p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer ${
                    dragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-base-300 hover:border-primary/50 hover:bg-base-200/50'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  {loading ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 text-primary animate-spin" />
                      <p className="text-base-content/60">Processando arquivo...</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <FileSpreadsheet className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        Arraste o arquivo CSV ou XLSX aqui
                      </h3>
                      <p className="text-base-content/60 text-sm mb-4">
                        ou clique para selecionar
                      </p>
                      <div className="badge badge-ghost">Formato: CSV ou XLSX</div>
                    </>
                  )}
                </div>
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />

                <div className="divider max-w-md">Formato do arquivo</div>
                <ol className="text-left text-sm text-base-content/70 max-w-md space-y-2">
                  <li className="flex gap-2">
                    <span className="badge badge-sm badge-ghost">1</span>
                    O arquivo deve conter colunas para grupo, seção e pergunta
                  </li>
                  <li className="flex gap-2">
                    <span className="badge badge-sm badge-ghost">2</span>
                    Formatos suportados: CSV (separado por vírgulas) ou XLSX (Excel)
                  </li>
                  <li className="flex gap-2">
                    <span className="badge badge-sm badge-ghost">3</span>
                    Faça o upload do arquivo acima para iniciar a importação
                  </li>
                </ol>
              </div>
            </motion.div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && preview && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Info Card */}
              <div className="card bg-base-100 shadow-sm border border-base-300">
                <div className="card-body">
                  <h2 className="card-title text-base flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                    Arquivo Detectado
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-base-content/60">Nome Original</p>
                      <p className="font-medium">{preview.nomeOriginal}</p>
                    </div>
                    <div>
                      <p className="text-sm text-base-content/60">Data de Exportação</p>
                      <p className="font-medium">{preview.dataExportacao || 'Não informada'}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-4">
                    <div className="stat bg-base-200 rounded-lg p-4">
                      <div className="stat-value text-2xl text-primary">{preview.totalGrupos}</div>
                      <div className="stat-desc">Grupos</div>
                    </div>
                    <div className="stat bg-base-200 rounded-lg p-4">
                      <div className="stat-value text-2xl text-secondary">{preview.totalPerguntas}</div>
                      <div className="stat-desc">Perguntas</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grupos Preview */}
              <div className="card bg-base-100 shadow-sm border border-base-300">
                <div className="card-body">
                  <h2 className="card-title text-base">Grupos Detectados</h2>
                  <div className="space-y-3 mt-4 max-h-80 overflow-y-auto">
                    {preview.grupos.map((grupo, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-base-200 rounded-lg">
                        <FolderOpen className="w-5 h-5 text-secondary mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{grupo.nome}</p>
                          {grupo.secoes.length > 0 && (
                            <p className="text-xs text-base-content/60 mt-1">
                              Seções: {grupo.secoes.join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="badge badge-ghost">{grupo.perguntas} perguntas</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button onClick={handleNovaImportacao} className="btn btn-ghost">
                  Cancelar
                </button>
                <button onClick={() => setStep('config')} className="btn btn-primary gap-2">
                  Continuar
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Config */}
          {step === 'config' && (
            <motion.div
              key="config"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="card bg-base-100 shadow-sm border border-base-300"
            >
              <div className="card-body">
                <h2 className="card-title text-base">Configurar Importação</h2>
                <div className="space-y-4 mt-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Nome do Checklist *</span>
                    </label>
                    <input
                      type="text"
                      className="input input-bordered"
                      value={formData.nomeTemplate}
                      onChange={(e) => setFormData({ ...formData, nomeTemplate: e.target.value })}
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Descrição</span>
                    </label>
                    <textarea
                      className="textarea textarea-bordered"
                      rows={2}
                      placeholder="Descrição opcional do checklist"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Tipo de Atividade</span>
                      </label>
                      <select
                        className="select select-bordered"
                        value={formData.tipoAtividade}
                        onChange={(e) =>
                          setFormData({ ...formData, tipoAtividade: e.target.value as TipoAtividade })
                        }
                      >
                        {Object.entries(TIPO_ATIVIDADE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Versão</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered"
                        value={formData.versao}
                        onChange={(e) => setFormData({ ...formData, versao: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="alert mt-6">
                    <Check className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Pronto para importar</p>
                      <p className="text-sm text-base-content/70">
                        Serão criados {preview?.totalGrupos} grupos e {preview?.totalPerguntas} perguntas no checklist.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="card-actions justify-end mt-6">
                  <button onClick={() => setStep('preview')} className="btn btn-ghost">
                    Voltar
                  </button>
                  <button
                    onClick={handleImportar}
                    disabled={loading || !formData.nomeTemplate.trim()}
                    className="btn btn-primary gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Importar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Step 4: Result */}
          {step === 'result' && resultado && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="card bg-base-100 shadow-sm border border-base-300"
            >
              <div className="card-body items-center text-center py-12">
                <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-success" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Importação Concluída!</h2>
                <p className="text-base-content/60 mb-6">
                  O checklist foi importado com sucesso.
                </p>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="stat bg-base-200 rounded-lg p-4">
                    <div className="stat-value text-2xl text-primary">{resultado.gruposCriados}</div>
                    <div className="stat-desc">Grupos Criados</div>
                  </div>
                  <div className="stat bg-base-200 rounded-lg p-4">
                    <div className="stat-value text-2xl text-secondary">{resultado.itensCriados}</div>
                    <div className="stat-desc">Perguntas Criadas</div>
                  </div>
                </div>

                {resultado.avisos.length > 0 && (
                  <div className="alert alert-warning mb-6 text-left">
                    <AlertTriangle className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Avisos durante a importação:</p>
                      <ul className="text-sm mt-1">
                        {resultado.avisos.map((aviso, idx) => (
                          <li key={idx}>• {aviso}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={handleNovaImportacao} className="btn btn-ghost">
                    Nova Importação
                  </button>
                  <Link
                    href={`/admin/templates/${resultado.templateId}`}
                    className="btn btn-primary gap-2"
                  >
                    Ver Checklist
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}


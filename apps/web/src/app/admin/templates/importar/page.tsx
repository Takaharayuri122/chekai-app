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
      <div className="bg-card border-b border-border px-4 lg:px-8 py-4 sticky top-14 z-30">
        <div className="flex items-center gap-3 max-w-3xl mx-auto">
          <Link href="/admin/templates" className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 w-9 px-0 rounded-full hover:bg-muted">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-foreground">Importar Checklist</h1>
            <p className="text-sm text-muted-foreground">Importe checklists a partir de arquivos CSV ou XLSX</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 lg:px-8 space-y-4">
        {/* Steps Indicator */}
        <div className="mb-8">
          <ul className="flex w-full gap-2 steps-horizontal">
            <li className={`flex-1 text-center text-xs text-muted-foreground ${step !== 'upload' ? '!font-semibold !text-primary' : '!font-semibold !text-primary'}`}>Upload</li>
            <li className={`flex-1 text-center text-xs text-muted-foreground ${step === 'preview' || step === 'config' || step === 'result' ? '!font-semibold !text-primary' : ''}`}>
              Preview
            </li>
            <li className={`flex-1 text-center text-xs text-muted-foreground ${step === 'config' || step === 'result' ? '!font-semibold !text-primary' : ''}`}>Configurar</li>
            <li className={`flex-1 text-center text-xs text-muted-foreground ${step === 'result' ? '!font-semibold !text-primary' : ''}`}>Concluído</li>
          </ul>
        </div>

        {/* Erro */}
        {erro && (
          <div className="flex w-full items-start gap-3 rounded-md border p-4 text-sm border-destructive/30 bg-destructive/10 text-destructive mb-6">
            <AlertTriangle className="w-5 h-5" />
            <span>{erro}</span>
            <button onClick={() => setErro('')} className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 w-9 px-0 rounded-full hover:bg-muted">
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
              className="relative flex flex-col rounded-lg border border-border bg-card shadow-sm"
            >
              <div className="flex flex-1 flex-col gap-2 items-center text-center py-12">
                <div
                  className={`w-full max-w-md p-8 border-2 border-dashed rounded-xl transition-all cursor-pointer ${
                    dragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => document.getElementById('file-input')?.click()}
                >
                  {loading ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 text-primary animate-spin" />
                      <p className="text-muted-foreground">Processando arquivo...</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                        <FileSpreadsheet className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        Arraste o arquivo CSV ou XLSX aqui
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        ou clique para selecionar
                      </p>
                      <div className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2.5 py-0.5 text-xs bg-muted text-muted-foreground">Formato: CSV ou XLSX</div>
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

                <div className="my-4 flex items-center gap-4 text-xs text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border max-w-md mx-auto justify-center text-center">Formato do arquivo</div>
                <ol className="text-left text-sm text-muted-foreground max-w-md space-y-2">
                  <li className="flex gap-2">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 py-0.5 text-[11px] bg-muted text-muted-foreground">1</span>
                    O arquivo deve conter colunas para grupo, seção e pergunta
                  </li>
                  <li className="flex gap-2">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 py-0.5 text-[11px] bg-muted text-muted-foreground">2</span>
                    Formatos suportados: CSV (separado por vírgulas) ou XLSX (Excel)
                  </li>
                  <li className="flex gap-2">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2 py-0.5 text-[11px] bg-muted text-muted-foreground">3</span>
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
              <div className="relative flex flex-col rounded-lg border border-border bg-card shadow-sm">
                <div className="flex flex-1 flex-col gap-2 p-6">
                  <h2 className="flex items-center gap-2 font-display font-semibold text-base">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                    Arquivo Detectado
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Nome Original</p>
                      <p className="font-medium">{preview.nomeOriginal}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Data de Exportação</p>
                      <p className="font-medium">{preview.dataExportacao || 'Não informada'}</p>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-4">
                    <div className="flex flex-col gap-1 p-4 bg-muted rounded-lg">
                      <div className="font-display font-semibold text-2xl text-primary">{preview.totalGrupos}</div>
                      <div className="text-xs text-muted-foreground">Grupos</div>
                    </div>
                    <div className="flex flex-col gap-1 p-4 bg-muted rounded-lg">
                      <div className="font-display font-semibold text-2xl text-info">{preview.totalPerguntas}</div>
                      <div className="text-xs text-muted-foreground">Perguntas</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grupos Preview */}
              <div className="relative flex flex-col rounded-lg border border-border bg-card shadow-sm">
                <div className="flex flex-1 flex-col gap-2 p-6">
                  <h2 className="flex items-center gap-2 font-display font-semibold text-base">Grupos Detectados</h2>
                  <div className="space-y-3 mt-4 max-h-80 overflow-y-auto">
                    {preview.grupos.map((grupo, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                        <FolderOpen className="w-5 h-5 text-info mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{grupo.nome}</p>
                          {grupo.secoes.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Seções: {grupo.secoes.join(', ')}
                            </p>
                          )}
                        </div>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold px-2.5 py-0.5 text-xs bg-muted text-muted-foreground">{grupo.perguntas} perguntas</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button onClick={handleNovaImportacao} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 hover:bg-muted">
                  Cancelar
                </button>
                <button onClick={() => setStep('config')} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90">
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
              className="relative flex flex-col rounded-lg border border-border bg-card shadow-sm"
            >
              <div className="flex flex-1 flex-col gap-2 p-6">
                <h2 className="flex items-center gap-2 font-display font-semibold text-base">Configurar Importação</h2>
                <div className="space-y-4 mt-4">
                  <div className="flex flex-col">
                    <label className="flex items-center justify-between gap-2 py-1">
                      <span className="text-sm font-medium text-foreground">Nome do Checklist *</span>
                    </label>
                    <input
                      type="text"
                      className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
                      value={formData.nomeTemplate}
                      onChange={(e) => setFormData({ ...formData, nomeTemplate: e.target.value })}
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="flex items-center justify-between gap-2 py-1">
                      <span className="text-sm font-medium text-foreground">Descrição</span>
                    </label>
                    <textarea
                      className="min-h-[80px] px-3 py-2 rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                      rows={2}
                      placeholder="Descrição opcional do checklist"
                      value={formData.descricao}
                      onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <label className="flex items-center justify-between gap-2 py-1">
                        <span className="text-sm font-medium text-foreground">Tipo de Atividade</span>
                      </label>
                      <select
                        className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
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

                    <div className="flex flex-col">
                      <label className="flex items-center justify-between gap-2 py-1">
                        <span className="text-sm font-medium text-foreground">Versão</span>
                      </label>
                      <input
                        type="text"
                        className="rounded-md border border-input bg-card text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 h-10 px-3"
                        value={formData.versao}
                        onChange={(e) => setFormData({ ...formData, versao: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="flex w-full items-start gap-3 rounded-md border p-4 text-sm border-border bg-muted mt-6">
                    <Check className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Pronto para importar</p>
                      <p className="text-sm text-muted-foreground">
                        Serão criados {preview?.totalGrupos} grupos e {preview?.totalPerguntas} perguntas no checklist.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-start justify-end gap-2 mt-6">
                  <button onClick={() => setStep('preview')} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 hover:bg-muted">
                    Voltar
                  </button>
                  <button
                    onClick={handleImportar}
                    disabled={loading || !formData.nomeTemplate.trim()}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
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
              className="relative flex flex-col rounded-lg border border-border bg-card shadow-sm"
            >
              <div className="flex flex-1 flex-col gap-2 items-center text-center py-12">
                <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mb-4">
                  <CheckCircle className="w-10 h-10 text-success" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Importação Concluída!</h2>
                <p className="text-muted-foreground mb-6">
                  O checklist foi importado com sucesso.
                </p>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="flex flex-col gap-1 p-4 bg-muted rounded-lg">
                    <div className="font-display font-semibold text-2xl text-primary">{resultado.gruposCriados}</div>
                    <div className="text-xs text-muted-foreground">Grupos Criados</div>
                  </div>
                  <div className="flex flex-col gap-1 p-4 bg-muted rounded-lg">
                    <div className="font-display font-semibold text-2xl text-info">{resultado.itensCriados}</div>
                    <div className="text-xs text-muted-foreground">Perguntas Criadas</div>
                  </div>
                </div>

                {resultado.avisos.length > 0 && (
                  <div className="flex w-full items-start gap-3 rounded-md border p-4 text-sm border-warning/40 bg-warning/15 mb-6 text-left">
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
                  <button onClick={handleNovaImportacao} className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 hover:bg-muted">
                    Nova Importação
                  </button>
                  <Link
                    href={`/admin/templates/${resultado.templateId}`}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90"
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


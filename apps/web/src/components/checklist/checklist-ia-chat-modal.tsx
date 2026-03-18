'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Send, User, Loader2, CheckCircle, FileText, Search, Database, Wand2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { checklistService, MensagemChatIa, EtapaConversaIa } from '@/lib/api';
import { toastService } from '@/lib/toast';
import { ConfirmDialog } from '@/components';

interface MensagemChat {
  id: string;
  role: 'user' | 'assistant';
  conteudo: string;
  timestamp: Date;
}

interface ChecklistIaChatModalProps {
  open: boolean;
  onClose: () => void;
  onChecklistGerado: (templateId: string) => void;
}

const PASSOS_GERACAO = [
  { icone: Search, label: 'Analisando requisitos da conversa...' },
  { icone: Database, label: 'Consultando legislação e referências...' },
  { icone: Wand2, label: 'Gerando perguntas e estrutura...' },
  { icone: FileText, label: 'Salvando checklist no sistema...' },
];

/**
 * Modal de chat para geração de checklists via IA.
 */
export function ChecklistIaChatModal({ open, onClose, onChecklistGerado }: ChecklistIaChatModalProps) {
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [input, setInput] = useState('');
  const [isEnviando, setIsEnviando] = useState(false);
  const [etapa, setEtapa] = useState<EtapaConversaIa>('coletando_informacoes');
  const [etapaIndex, setEtapaIndex] = useState(0);
  const [isConfirmacaoAberta, setIsConfirmacaoAberta] = useState(false);
  const [isGerando, setIsGerando] = useState(false);
  const [passoGeracaoAtual, setPassoGeracaoAtual] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerGeracaoRef = useRef<NodeJS.Timeout | null>(null);

  const scrollParaFinal = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 100);
  }, []);

  const iniciarAnimacaoGeracao = useCallback(() => {
    setIsGerando(true);
    setPassoGeracaoAtual(0);
    let passo = 0;
    timerGeracaoRef.current = setInterval(() => {
      passo += 1;
      if (passo < PASSOS_GERACAO.length) {
        setPassoGeracaoAtual(passo);
      }
    }, 3000);
  }, []);

  const pararAnimacaoGeracao = useCallback(() => {
    if (timerGeracaoRef.current) {
      clearInterval(timerGeracaoRef.current);
      timerGeracaoRef.current = null;
    }
    setPassoGeracaoAtual(PASSOS_GERACAO.length - 1);
  }, []);

  useEffect(() => {
    return () => {
      if (timerGeracaoRef.current) {
        clearInterval(timerGeracaoRef.current);
      }
    };
  }, []);

  const iniciarConversa = useCallback(async () => {
    setIsEnviando(true);
    try {
      const resposta = await checklistService.conversarIa([
        { role: 'user', conteudo: 'Oi! Preciso de ajuda para montar um checklist de auditoria.' },
      ]);
      const msgAssistant: MensagemChat = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        conteudo: resposta.resposta,
        timestamp: new Date(),
      };
      setMensagens([msgAssistant]);
      setEtapa(resposta.etapa);
      setEtapaIndex(1);
    } catch {
      toastService.error('Erro ao iniciar conversa com IA. Tente novamente.');
      const msgErro: MensagemChat = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        conteudo: 'Desculpe, ocorreu um erro ao iniciar. Por favor, feche e tente novamente.',
        timestamp: new Date(),
      };
      setMensagens([msgErro]);
    } finally {
      setIsEnviando(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setMensagens([]);
      setInput('');
      setEtapa('coletando_informacoes');
      setEtapaIndex(0);
      setIsGerando(false);
      setPassoGeracaoAtual(0);
      iniciarConversa();
    }
  }, [open, iniciarConversa]);

  useEffect(() => {
    scrollParaFinal();
  }, [mensagens, isGerando, passoGeracaoAtual, scrollParaFinal]);

  useEffect(() => {
    if (open && !isEnviando && !isGerando) {
      inputRef.current?.focus();
    }
  }, [open, isEnviando, isGerando, mensagens]);

  const enviarMensagem = async () => {
    const textoTrimmed = input.trim();
    if (!textoTrimmed || isEnviando || isGerando) return;
    const msgUsuario: MensagemChat = {
      id: `user-${Date.now()}`,
      role: 'user',
      conteudo: textoTrimmed,
      timestamp: new Date(),
    };
    const novasMensagens = [...mensagens, msgUsuario];
    setMensagens(novasMensagens);
    setInput('');
    setIsEnviando(true);
    try {
      const historicoParaApi: MensagemChatIa[] = novasMensagens.map((m) => ({
        role: m.role,
        conteudo: m.conteudo,
      }));
      const resposta = await checklistService.conversarIa(historicoParaApi);
      if (resposta.etapa === 'gerando') {
        setIsEnviando(false);
        iniciarAnimacaoGeracao();
        const respostaFinal = await checklistService.conversarIa(historicoParaApi);
        pararAnimacaoGeracao();
        setIsGerando(false);
        const msgFinal: MensagemChat = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          conteudo: respostaFinal.resposta,
          timestamp: new Date(),
        };
        setMensagens((prev) => [...prev, msgFinal]);
        setEtapa(respostaFinal.etapa);
        if (respostaFinal.etapa === 'finalizado' && respostaFinal.checklistGerado) {
          setEtapaIndex(6);
          toastService.success('Checklist gerado com sucesso!');
          setTimeout(() => {
            onChecklistGerado(respostaFinal.checklistGerado!.templateId);
          }, 2000);
        }
      } else if (resposta.etapa === 'finalizado' && resposta.checklistGerado) {
        const msgAssistant: MensagemChat = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          conteudo: resposta.resposta,
          timestamp: new Date(),
        };
        setMensagens((prev) => [...prev, msgAssistant]);
        setEtapa('finalizado');
        setEtapaIndex(6);
        toastService.success('Checklist gerado com sucesso!');
        setTimeout(() => {
          onChecklistGerado(resposta.checklistGerado!.templateId);
        }, 2000);
      } else {
        const msgAssistant: MensagemChat = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          conteudo: resposta.resposta,
          timestamp: new Date(),
        };
        setMensagens((prev) => [...prev, msgAssistant]);
        setEtapa(resposta.etapa);
        if (resposta.etapa === 'coletando_informacoes') {
          setEtapaIndex((prev) => Math.min(prev + 1, 5));
        }
      }
    } catch {
      pararAnimacaoGeracao();
      setIsGerando(false);
      toastService.error('Erro ao processar mensagem. Tente novamente.');
      const msgErro: MensagemChat = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        conteudo: 'Desculpe, ocorreu um erro ao processar sua mensagem. Pode tentar enviar novamente?',
        timestamp: new Date(),
      };
      setMensagens((prev) => [...prev, msgErro]);
    } finally {
      setIsEnviando(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviarMensagem();
    }
  };

  const solicitarFechamento = () => {
    if (isGerando) return;
    if (mensagens.length > 1) {
      setIsConfirmacaoAberta(true);
      return;
    }
    onClose();
  };

  const confirmarFechamento = () => {
    setIsConfirmacaoAberta(false);
    onClose();
  };

  const etapas = ['Tipo', 'Objetivo', 'Categorias', 'Detalhes', 'Requisitos', 'Gerar'];
  const isInputDesabilitado = isEnviando || isGerando || etapa === 'finalizado';

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={solicitarFechamento}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative flex flex-col bg-base-100 rounded-xl shadow-2xl border border-base-300 w-full max-w-3xl h-[85vh] overflow-hidden"
            >
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-base-300 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary/10">
                    <Sparkles className="w-5 h-5 text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-base-content">Criar Checklist com IA</h3>
                    <p className="text-xs text-base-content/60">
                      {isGerando ? 'Gerando seu checklist...' : 'Responda as perguntas para gerar seu checklist'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={solicitarFechamento}
                  disabled={isGerando}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-base-200 hover:bg-error/10 hover:text-error text-base-content/70 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>

              <div className="px-6 py-3 border-b border-base-300 shrink-0">
                <ul className="steps steps-horizontal w-full text-xs">
                  {etapas.map((label, idx) => (
                    <li
                      key={label}
                      className={`step ${idx <= etapaIndex ? 'step-primary' : ''}`}
                    >
                      <span className="hidden sm:inline">{label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
              >
                <AnimatePresence initial={false}>
                  {mensagens.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="flex items-start shrink-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary/10">
                            <Sparkles className="w-4 h-4 text-secondary" />
                          </div>
                        </div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-primary text-primary-content rounded-br-md'
                            : 'bg-base-200 text-base-content rounded-bl-md'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-base-content prose-strong:text-base-content prose-a:text-secondary">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.conteudo}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{msg.conteudo}</p>
                        )}
                        <span className={`text-[10px] mt-1 block ${
                          msg.role === 'user' ? 'text-primary-content/60' : 'text-base-content/40'
                        }`}>
                          {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {msg.role === 'user' && (
                        <div className="flex items-start shrink-0">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                            <User className="w-4 h-4 text-primary" />
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {isEnviando && !isGerando && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 justify-start"
                  >
                    <div className="flex items-start shrink-0">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-secondary/10">
                        <Sparkles className="w-4 h-4 text-secondary" />
                      </div>
                    </div>
                    <div className="bg-base-200 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-base-content/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 rounded-full bg-base-content/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 rounded-full bg-base-content/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </motion.div>
                )}

                {isGerando && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center py-4"
                  >
                    <div className="bg-base-200 rounded-2xl p-6 w-full max-w-md border border-base-300">
                      <div className="flex items-center gap-2 mb-4">
                        <Loader2 className="w-5 h-5 text-secondary animate-spin" />
                        <span className="text-sm font-semibold text-base-content">Gerando checklist...</span>
                      </div>
                      <div className="space-y-3">
                        {PASSOS_GERACAO.map((passo, idx) => {
                          const Icone = passo.icone;
                          const isConcluido = idx < passoGeracaoAtual;
                          const isAtual = idx === passoGeracaoAtual;
                          return (
                            <motion.div
                              key={passo.label}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: idx <= passoGeracaoAtual ? 1 : 0.3, x: 0 }}
                              transition={{ delay: idx * 0.1, duration: 0.3 }}
                              className="flex items-center gap-3"
                            >
                              <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-colors duration-300 ${
                                isConcluido ? 'bg-success/20' : isAtual ? 'bg-secondary/20' : 'bg-base-300'
                              }`}>
                                {isConcluido ? (
                                  <CheckCircle className="w-4 h-4 text-success" />
                                ) : isAtual ? (
                                  <Icone className="w-4 h-4 text-secondary animate-pulse" />
                                ) : (
                                  <Icone className="w-4 h-4 text-base-content/30" />
                                )}
                              </div>
                              <span className={`text-sm transition-colors duration-300 ${
                                isConcluido ? 'text-success font-medium' : isAtual ? 'text-base-content font-medium' : 'text-base-content/30'
                              }`}>
                                {passo.label}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                      <div className="mt-4">
                        <progress className="progress progress-secondary w-full" />
                      </div>
                    </div>
                  </motion.div>
                )}

                {etapa === 'finalizado' && !isGerando && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex justify-center py-4"
                  >
                    <div className="flex items-center gap-2 text-success bg-success/10 px-4 py-2 rounded-full">
                      <CheckCircle className="w-5 h-5" />
                      <span className="text-sm font-medium">Redirecionando para edição...</span>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="px-6 py-4 border-t border-base-300 shrink-0">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      isGerando
                        ? 'Aguarde a geração do checklist...'
                        : etapa === 'finalizado'
                          ? 'Checklist gerado!'
                          : 'Digite sua resposta...'
                    }
                    disabled={isInputDesabilitado}
                    className="input input-bordered flex-1 text-sm"
                  />
                  <button
                    onClick={enviarMensagem}
                    disabled={!input.trim() || isInputDesabilitado}
                    className="btn btn-primary btn-square"
                  >
                    {isEnviando || isGerando ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        open={isConfirmacaoAberta}
        onClose={() => setIsConfirmacaoAberta(false)}
        onConfirm={confirmarFechamento}
        title="Encerrar conversa?"
        message="Se fechar agora, o progresso da conversa será perdido e o checklist não será gerado."
        confirmLabel="Encerrar"
        cancelLabel="Continuar"
        variant="warning"
      />
    </>
  );
}

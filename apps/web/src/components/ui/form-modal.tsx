'use client';

import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { ConfirmDialog } from './confirm-dialog';

type MaxWidth = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';

interface FormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: MaxWidth;
  isDirty?: boolean;
  closeOnBackdrop?: boolean;
}

const MAX_WIDTH_MAP: Record<MaxWidth, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

const TRANSICAO_MODAL = { duration: 0.12, ease: 'easeOut' as const };

/**
 * Modal reutilizável com header fixo, footer fixo, scroll vertical no conteúdo
 * e proteção contra perda de dados (isDirty).
 *
 * Overlay sem backdrop-filter e sem scale: blur+scale animados no compositor
 * do macOS/Chrome geram uma piscada ao montar/desmontar a camada.
 */
export function FormModal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = '2xl',
  isDirty = false,
  closeOnBackdrop = true,
}: FormModalProps) {
  const [isConfirmacaoAberta, setIsConfirmacaoAberta] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  const isEfetivamenteSujo = isDirty && hasInteracted;

  const solicitarFechamento = useCallback(() => {
    if (isEfetivamenteSujo) {
      setIsConfirmacaoAberta(true);
      return;
    }
    onClose();
  }, [isEfetivamenteSujo, onClose]);

  const confirmarFechamento = useCallback(() => {
    setIsConfirmacaoAberta(false);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        solicitarFechamento();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, solicitarFechamento]);

  useEffect(() => {
    if (!open) {
      setIsConfirmacaoAberta(false);
      setHasInteracted(false);
    }
  }, [open]);

  const handleBackdropClick = (): void => {
    if (!closeOnBackdrop) return;
    solicitarFechamento();
  };

  return (
    <>
      {montado &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="form-modal"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={TRANSICAO_MODAL}
                className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="form-modal-titulo"
              >
                <div className="absolute inset-0 bg-foreground/50" onClick={handleBackdropClick} />

                <div
                  onClick={(e) => e.stopPropagation()}
                  className={`relative flex w-full ${MAX_WIDTH_MAP[maxWidth]} max-h-[92vh] flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-lg sm:max-h-[90vh] sm:rounded-lg`}
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6 sm:py-4">
                    <h3 id="form-modal-titulo" className="truncate font-display text-lg font-semibold">
                      {title}
                    </h3>
                    <button
                      type="button"
                      onClick={solicitarFechamento}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:h-9 sm:w-9"
                      aria-label="Fechar"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div
                    className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 sm:px-6 sm:py-5"
                    onChangeCapture={() => setHasInteracted(true)}
                    onInputCapture={() => setHasInteracted(true)}
                  >
                    {children}
                  </div>

                  {footer && (
                    <div className="flex shrink-0 justify-end gap-3 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
                      {footer}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}

      <ConfirmDialog
        open={isConfirmacaoAberta}
        onClose={() => setIsConfirmacaoAberta(false)}
        onConfirm={confirmarFechamento}
        title="Descartar alterações?"
        message="Você possui alterações não salvas. Se fechar agora, todas as modificações serão perdidas."
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        variant="warning"
      />
    </>
  );
}

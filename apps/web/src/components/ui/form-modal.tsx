'use client';

import { useEffect, useState, useCallback } from 'react';
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

/**
 * Modal reutilizável com header fixo, footer fixo, scroll vertical no conteúdo
 * e proteção contra perda de dados (isDirty).
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

  const solicitarFechamento = useCallback(() => {
    if (isDirty) {
      setIsConfirmacaoAberta(true);
      return;
    }
    onClose();
  }, [isDirty, onClose]);

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
    }
  }, [open]);

  const handleBackdropClick = (): void => {
    if (!closeOnBackdrop) return;
    solicitarFechamento();
  };

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
            aria-labelledby="form-modal-titulo"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={handleBackdropClick}
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative flex flex-col bg-base-100 rounded-xl shadow-2xl border border-base-300 w-full ${MAX_WIDTH_MAP[maxWidth]} max-h-[90vh] overflow-hidden`}
            >
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-base-300 shrink-0">
                <h3 id="form-modal-titulo" className="text-lg font-bold text-base-content truncate">
                  {title}
                </h3>
                <button
                  type="button"
                  onClick={solicitarFechamento}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-base-200 hover:bg-error/10 hover:text-error text-base-content/70 transition-colors shrink-0"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" strokeWidth={2.5} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
                {children}
              </div>

              {footer && (
                <div className="flex gap-3 px-6 py-4 border-t border-base-300 justify-end shrink-0">
                  {footer}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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

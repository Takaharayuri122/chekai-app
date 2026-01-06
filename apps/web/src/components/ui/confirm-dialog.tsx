'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

/**
 * Componente de diálogo de confirmação estilizado.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  const variantStyles = {
    danger: {
      icon: 'text-error',
      button: 'btn-error',
      border: 'border-error/20',
      bg: 'bg-error/10',
    },
    warning: {
      icon: 'text-warning',
      button: 'btn-warning',
      border: 'border-warning/20',
      bg: 'bg-warning/10',
    },
    info: {
      icon: 'text-info',
      button: 'btn-info',
      border: 'border-info/20',
      bg: 'bg-info/10',
    },
  };

  const styles = variantStyles[variant];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Não fecha ao clicar fora
            e.stopPropagation();
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={(e) => {
              // Não fecha ao clicar no backdrop
              e.stopPropagation();
            }}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-base-100 rounded-xl shadow-2xl border border-base-300 w-full max-w-md"
          >
            {/* Header */}
            <div className={`flex items-center gap-3 p-6 border-b ${styles.border}`}>
              <div className={`p-2 rounded-lg ${styles.bg}`}>
                <AlertTriangle className={`w-6 h-6 ${styles.icon}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-base-content">{title}</h3>
              </div>
              <button
                onClick={onClose}
                disabled={loading}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6">
              <p className="text-base-content/80">{message}</p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 p-6 border-t border-base-200 justify-end">
              <button
                onClick={onClose}
                disabled={loading}
                className="btn btn-ghost"
              >
                {cancelLabel}
              </button>
              <button
                onClick={handleConfirm}
                disabled={loading}
                className={`btn ${styles.button} gap-2`}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  confirmLabel
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}


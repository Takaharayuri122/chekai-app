'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';

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
  const [montado, setMontado] = useState(false);

  useEffect(() => {
    setMontado(true);
  }, []);

  const handleConfirm = async () => {
    await onConfirm();
  };

  const variantStyles = {
    danger: { icon: 'text-destructive', bg: 'bg-destructive/10', button: 'bg-destructive text-destructive-foreground hover:bg-destructive/90' },
    warning: { icon: 'text-warning', bg: 'bg-warning/15', button: 'bg-warning text-white hover:bg-warning/90' },
    info: { icon: 'text-info', bg: 'bg-info/10', button: 'bg-info text-white hover:bg-info/90' },
  };

  const styles = variantStyles[variant];

  if (!montado) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="absolute inset-0 bg-foreground/50" onClick={(e) => e.stopPropagation()} />

          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-md rounded-lg border border-border bg-card shadow-lg">
            <div className="flex items-center gap-3 border-b border-border p-5">
              <div className={`rounded-md p-2 ${styles.bg}`}>
                <AlertTriangle className={`h-5 w-5 ${styles.icon}`} />
              </div>
              <h3 className="flex-1 font-display text-lg font-semibold">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="p-5 text-sm text-muted-foreground">{message}</p>

            <div className="flex justify-end gap-2 border-t border-border p-4">
              <Button variant="ghost" onClick={onClose} disabled={loading}>
                {cancelLabel}
              </Button>
              <Button className={styles.button} onClick={handleConfirm} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processando…
                  </>
                ) : (
                  confirmLabel
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

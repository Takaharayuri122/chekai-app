'use client';

import { useEffect, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export interface PageLoadingOverlayProps {
  /** Quando true, exibe overlay em tela cheia. */
  open: boolean;
  /** Título principal (ex.: ação em andamento). */
  title: string;
  /** Texto auxiliar opcional abaixo do título. */
  subtitle?: string;
}

/**
 * Overlay de carregamento em tela cheia, alinhado ao backdrop dos modais padrão
 * (`bg-black/60 backdrop-blur-sm`) e painel central com borda arredondada.
 */
export function PageLoadingOverlay({ open, title, subtitle }: PageLoadingOverlayProps): ReactElement {
  useEffect(() => {
    if (!open) {
      return;
    }
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-busy="true"
          aria-live="polite"
          aria-labelledby="page-loading-overlay-titulo"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-xl border border-base-300 bg-base-100 px-8 py-10 shadow-2xl"
          >
            <div className="flex flex-col items-center gap-5 text-center">
              <Loader2 className="h-12 w-12 shrink-0 animate-spin text-primary" aria-hidden />
              <div className="space-y-2">
                <p id="page-loading-overlay-titulo" className="text-lg font-bold text-base-content">
                  {title}
                </p>
                {subtitle ? (
                  <p className="text-sm leading-relaxed text-base-content/70">{subtitle}</p>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

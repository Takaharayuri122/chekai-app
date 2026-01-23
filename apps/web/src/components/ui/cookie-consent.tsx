'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cookie } from 'lucide-react';
import Link from 'next/link';

const COOKIE_CONSENT_KEY = 'chekai-cookie-consent';
const COOKIE_EXPIRY_DAYS = 365;

function setCookie(name: string, value: string, days: number): void {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = getCookie(COOKIE_CONSENT_KEY);
    if (!consent) {
      setTimeout(() => {
        setIsVisible(true);
      }, 1000);
    }
  }, []);

  const handleAccept = (): void => {
    setCookie(COOKIE_CONSENT_KEY, 'accepted', COOKIE_EXPIRY_DAYS);
    setIsVisible(false);
  };

  const handleReject = (): void => {
    setCookie(COOKIE_CONSENT_KEY, 'rejected', COOKIE_EXPIRY_DAYS);
    setIsVisible(false);
  };

  const handleClose = (): void => {
    setCookie(COOKIE_CONSENT_KEY, 'dismissed', COOKIE_EXPIRY_DAYS);
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={handleClose}
          />
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 pointer-events-none"
          >
            <div className="max-w-7xl mx-auto pointer-events-auto">
              <div className="card bg-base-100 border border-base-300 shadow-2xl relative">
                <button
                  onClick={handleClose}
                  className="absolute top-4 right-4 md:top-4 md:right-4 btn btn-ghost btn-sm btn-circle z-10"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="card-body p-5 md:p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Cookie className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-semibold text-base-content mb-1.5">
                          Utilizamos cookies
                        </h3>
                        <p className="text-sm text-base-content/70 leading-relaxed">
                          Utilizamos cookies para melhorar sua experiência, analisar o desempenho do site e personalizar conteúdo.
                          Ao continuar navegando, você concorda com nossa{' '}
                          <Link
                            href="/politica-privacidade"
                            className="text-primary hover:underline font-medium inline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Política de Privacidade
                          </Link>
                          {' '}e{' '}
                          <Link
                            href="/termos-uso"
                            className="text-primary hover:underline font-medium inline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Termos de Uso
                          </Link>
                          .
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-row gap-3 w-full md:w-auto flex-shrink-0">
                      <button
                        onClick={handleReject}
                        className="btn btn-ghost btn-sm text-base-content/70 hover:text-base-content whitespace-nowrap"
                      >
                        Recusar
                      </button>
                      <button
                        onClick={handleAccept}
                        className="btn btn-primary btn-sm whitespace-nowrap"
                      >
                        Aceitar todos
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

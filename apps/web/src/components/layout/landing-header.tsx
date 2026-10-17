'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface LandingHeaderProps {
  onAbrirListaEspera?: () => void;
}

export function LandingHeader({ onAbrirListaEspera }: LandingHeaderProps) {
  return (
    <header className="sticky top-0 z-40 w-full bg-card/80 backdrop-blur-md border-b border-border">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between h-16 md:h-20">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-shrink-0"
            >
              <Link href="/" className="flex items-center">
                <Image
                  src="/images/logo-large.png"
                  alt="ChekAI"
                  width={140}
                  height={37}
                  className="h-8 w-auto md:h-10 md:w-auto"
                  priority
                />
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="flex items-center gap-2 sm:gap-3"
            >
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 hover:bg-muted text-foreground hover:text-primary hidden sm:inline-flex"
              >
                Entrar
              </Link>
              <button
                type="button"
                onClick={onAbrirListaEspera}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 h-9 px-3 bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 sm:gap-2 text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">Conhecer agora</span>
                <span className="sm:hidden">Conhecer</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </header>
  );
}

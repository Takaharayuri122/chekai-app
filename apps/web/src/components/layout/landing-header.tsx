'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 w-full bg-base-100/80 backdrop-blur-md border-b border-base-300">
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
                className="btn btn-ghost btn-sm text-base-content hover:text-primary hidden sm:inline-flex"
              >
                Entrar
              </Link>
              <Link
                href="/cadastro"
                className="btn btn-primary btn-sm gap-1.5 sm:gap-2 text-xs sm:text-sm"
              >
                <span className="hidden sm:inline">Começar Grátis</span>
                <span className="sm:hidden">Grátis</span>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </header>
  );
}

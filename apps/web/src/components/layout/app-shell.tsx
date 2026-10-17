'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { CheckinFab } from '@/components/checkin/checkin-fab';
import { TutorialInstalacaoModal } from '@/components/ui/tutorial-instalacao-modal';
import { BottomBar } from './bottom-bar';
import { BuscaGlobal } from './busca-global';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

const CHAVE_RECOLHIDA = 'chekai:sidebar-recolhida';

function lerPreferencia(): boolean {
  try {
    const salvo = window.localStorage.getItem(CHAVE_RECOLHIDA);
    if (salvo === 'true' || salvo === 'false') return salvo === 'true';
  } catch {
    // localStorage indisponível (modo privado): usa padrão por largura
  }
  return window.innerWidth < 1024;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [recolhida, setRecolhida] = useState(false);
  const [buscaAberta, setBuscaAberta] = useState(false);

  useEffect(() => {
    setRecolhida(lerPreferencia());
  }, []);

  useEffect(() => {
    const atalho = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setBuscaAberta((aberta) => !aberta);
      }
    };
    window.addEventListener('keydown', atalho);
    return () => window.removeEventListener('keydown', atalho);
  }, []);

  const alternar = useCallback(() => {
    setRecolhida((atual) => {
      const novo = !atual;
      try {
        window.localStorage.setItem(CHAVE_RECOLHIDA, String(novo));
      } catch {
        // preferência não persistida
      }
      return novo;
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar recolhida={recolhida} onAlternar={alternar} />
      <div className={cn('flex min-h-screen flex-col transition-[padding] duration-200', recolhida ? 'md:pl-16' : 'md:pl-60')}>
        <Topbar onAbrirBusca={() => setBuscaAberta(true)} />
        <motion.main
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          className="flex-1 pb-24 md:pb-8"
        >
          {children}
        </motion.main>
      </div>
      <BottomBar />
      <BuscaGlobal open={buscaAberta} onOpenChange={setBuscaAberta} />
      <div className="print:hidden">
        <CheckinFab />
        <TutorialInstalacaoModal />
      </div>
    </div>
  );
}

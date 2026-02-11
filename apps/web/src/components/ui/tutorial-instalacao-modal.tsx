'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share2, Plus, Smartphone } from 'lucide-react';
import { detectarDispositivo, TipoDispositivo } from '@/lib/detectar-dispositivo';

export const TUTORIAL_INSTALACAO_KEY = 'chekai-tutorial-instalacao-concluido';

interface PassoTutorial {
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
}

const PASSOS_IOS: PassoTutorial[] = [
  {
    titulo: 'Abra o menu de compartilhar',
    descricao: 'Toque no ícone de compartilhar (quadrado com seta para cima) na barra inferior do Safari.',
    icone: <Share2 className="w-8 h-8 text-primary" />,
  },
  {
    titulo: 'Adicionar à Tela de Início',
    descricao: 'Role a lista de opções e toque em "Adicionar à Tela de Início".',
    icone: <Plus className="w-8 h-8 text-primary" />,
  },
  {
    titulo: 'Confirme e adicione',
    descricao: 'O nome "ChekAI" já aparecerá. Toque em "Adicionar" no canto superior direito para instalar o app na sua tela inicial.',
    icone: <Smartphone className="w-8 h-8 text-primary" />,
  },
  {
    titulo: 'Uso offline no iPhone',
    descricao: 'Para o app abrir pelo ícone quando estiver sem internet, abra o ChekAI pelo menos uma vez com conexão. Depois ele funcionará offline.',
    icone: <Smartphone className="w-8 h-8 text-primary" />,
  },
];

const PASSOS_ANDROID: PassoTutorial[] = [
  {
    titulo: 'Abra o menu do navegador',
    descricao: 'Toque nos três pontos (⋮) no canto superior direito do Chrome ou do seu navegador.',
    icone: <Share2 className="w-8 h-8 text-primary" />,
  },
  {
    titulo: 'Instalar o app',
    descricao: 'Toque em "Instalar app" ou "Adicionar à tela inicial". O ChekAI será instalado como um aplicativo no seu celular.',
    icone: <Smartphone className="w-8 h-8 text-primary" />,
  },
];

function getPassos(dispositivo: TipoDispositivo): PassoTutorial[] {
  if (dispositivo === 'ios') return PASSOS_IOS;
  if (dispositivo === 'android') return PASSOS_ANDROID;
  return [];
}

export function TutorialInstalacaoModal() {
  const [dispositivo, setDispositivo] = useState<TipoDispositivo | null>(null);
  const [deveExibir, setDeveExibir] = useState(false);
  const [passoAtual, setPassoAtual] = useState(0);

  const verificarExibicao = useCallback(() => {
    if (typeof window === 'undefined') return;
    const concluido = localStorage.getItem(TUTORIAL_INSTALACAO_KEY);
    if (concluido) {
      setDeveExibir(false);
      return;
    }
    const tipo = detectarDispositivo();
    setDispositivo(tipo);
    if (tipo === 'ios' || tipo === 'android') {
      setDeveExibir(true);
      setPassoAtual(0);
    }
  }, []);

  useEffect(() => {
    verificarExibicao();
  }, [verificarExibicao]);

  const passos = dispositivo ? getPassos(dispositivo) : [];
  const ehUltimoPasso = passos.length > 0 && passoAtual === passos.length - 1;

  const handleProximo = () => {
    if (ehUltimoPasso) {
      localStorage.setItem(TUTORIAL_INSTALACAO_KEY, 'true');
      setDeveExibir(false);
    } else {
      setPassoAtual((p) => Math.min(p + 1, passos.length - 1));
    }
  };

  const handleFechar = () => {
    localStorage.setItem(TUTORIAL_INSTALACAO_KEY, 'true');
    setDeveExibir(false);
  };

  const passo = passos[passoAtual];
  const exibirModal = deveExibir && (dispositivo === 'ios' || dispositivo === 'android') && passos.length > 0 && passo;

  return (
    <AnimatePresence>
      {exibirModal && (
        <motion.div
          key="tutorial-instalacao"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleFechar}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="tutorial-titulo"
            className="relative bg-base-100 rounded-xl shadow-2xl border border-base-300 w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-base-200">
              <h2 id="tutorial-titulo" className="text-lg font-bold text-base-content">
                Instalar o ChekAI no celular
              </h2>
              <button
                type="button"
                onClick={handleFechar}
                className="btn btn-ghost btn-sm btn-circle"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  {passo.icone}
                </div>
                <div>
                  <p className="text-sm text-base-content/70 mb-1">
                    Passo {passoAtual + 1} de {passos.length}
                  </p>
                  <h3 className="font-semibold text-base-content mb-2">{passo.titulo}</h3>
                  <p className="text-sm text-base-content/80 leading-relaxed">{passo.descricao}</p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-base-200 flex justify-end">
              <button
                type="button"
                onClick={handleProximo}
                className="btn btn-primary"
                autoFocus
              >
                {ehUltimoPasso ? 'Entendi' : 'Próximo'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

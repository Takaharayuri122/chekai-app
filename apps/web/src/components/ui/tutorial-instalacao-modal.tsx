'use client';

import { useEffect, useState, useCallback } from 'react';
import { Share2, Plus, Smartphone } from 'lucide-react';
import { detectarDispositivo, TipoDispositivo } from '@/lib/detectar-dispositivo';
import { FormModal } from './form-modal';

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

  const footerContent = (
    <button
      type="button"
      onClick={handleProximo}
      className="btn btn-primary"
      autoFocus
    >
      {ehUltimoPasso ? 'Entendi' : 'Próximo'}
    </button>
  );

  if (!exibirModal) return null;

  return (
    <FormModal
      open
      onClose={handleFechar}
      title="Instalar o ChekAI no celular"
      maxWidth="md"
      footer={footerContent}
    >
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
    </FormModal>
  );
}

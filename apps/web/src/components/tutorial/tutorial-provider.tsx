'use client';

import { useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Joyride, { CallBackProps, STATUS, EVENTS, ACTIONS, Step } from 'react-joyride';
import { useTutorialStore } from '@/lib/store';
import { tutorialSteps } from '@/lib/tutorial.config';
import { PerfilUsuario } from '@/lib/store';

const JoyrideComponent = dynamic(() => Promise.resolve(Joyride), {
  ssr: false,
});

interface TutorialProviderProps {
  perfil: PerfilUsuario;
  children: React.ReactNode;
}

export function TutorialProvider({ perfil, children }: TutorialProviderProps) {
  const { tourAtivo, finalizarTour } = useTutorialStore();

  const steps: Step[] = tutorialSteps[perfil] || [];

  const handleJoyrideCallback = useCallback(
    (data: CallBackProps) => {
      const { status, type, action } = data;

      if (
        ([STATUS.FINISHED, STATUS.SKIPPED] as string[]).includes(status) ||
        (type === EVENTS.STEP_AFTER && action === ACTIONS.CLOSE)
      ) {
        finalizarTour(perfil);
      } else if (type === EVENTS.TARGET_NOT_FOUND) {
        console.warn('Elemento do tutorial não encontrado:', data.step?.target);
      }
    },
    [perfil, finalizarTour]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (tourAtivo && steps.length > 0) {
        const firstStepTarget = steps[0]?.target;
        if (firstStepTarget && typeof window !== 'undefined') {
          if (firstStepTarget === 'body') {
            return;
          }
          const element = document.querySelector(firstStepTarget as string);
          if (!element && firstStepTarget !== 'body') {
            console.warn('Elemento do primeiro passo não encontrado:', firstStepTarget);
          }
        }
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [tourAtivo, steps]);

  // Substituir "Next" por "Próximo" nos botões do tutorial
  useEffect(() => {
    if (!tourAtivo) return;

    const replaceNextText = () => {
      const buttons = document.querySelectorAll(
        'button[class*="react-joyride__button--primary"]'
      );
      buttons.forEach((button) => {
        const text = button.textContent || '';
        if (text.includes('Next')) {
          button.textContent = text.replace(/Next/gi, 'Próximo');
        }
      });
    };

    // Executar imediatamente e observar mudanças
    replaceNextText();
    const interval = setInterval(replaceNextText, 100);

    return () => clearInterval(interval);
  }, [tourAtivo]);

  return (
    <>
      {children}
      {tourAtivo && (
        <JoyrideComponent
          steps={steps}
          continuous
          showProgress
          showSkipButton
          callback={handleJoyrideCallback}
          disableOverlay
          disableScrolling={false}
          styles={{
            options: {
              primaryColor: 'hsl(var(--p))',
              textColor: '#1f2937',
              overlayColor: 'rgba(0, 0, 0, 0.75)',
              arrowColor: '#ffffff',
              backgroundColor: '#ffffff',
              beaconSize: 36,
              zIndex: 10000,
            },
            tooltip: {
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: 'none',
              border: 'none',
              backgroundColor: '#ffffff',
              maxWidth: '400px',
              opacity: 1,
            },
            tooltipWrapper: {
              backgroundColor: '#ffffff',
              opacity: 1,
            },
            tooltipContainer: {
              textAlign: 'left',
              backgroundColor: 'transparent',
            },
            tooltipTitle: {
              fontSize: '1.25rem',
              fontWeight: 700,
              marginBottom: '0.75rem',
              color: '#1f2937',
              backgroundColor: 'transparent',
            },
            tooltipContent: {
              padding: '0.75rem 0',
              fontSize: '0.9375rem',
              lineHeight: '1.6',
              color: '#1f2937',
              backgroundColor: 'transparent',
            },
            tooltipFooter: {
              marginTop: '1rem',
              paddingTop: '1rem',
              borderTop: '1px solid hsl(var(--bc) / 0.1)',
            },
            buttonNext: {
              backgroundColor: 'hsl(var(--p)) !important',
              color: 'hsl(var(--pc)) !important',
              borderRadius: '0.5rem',
              padding: '0.625rem 1.25rem',
              fontSize: '0.9375rem',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minWidth: '100px',
              opacity: '1 !important',
            },
            buttonBack: {
              color: 'hsl(var(--bc)) !important',
              marginRight: '0.75rem',
              fontSize: '0.9375rem',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              border: 'none',
              padding: '0.625rem 1rem',
              opacity: '1 !important',
            },
            buttonSkip: {
              color: 'hsl(var(--bc) / 0.7) !important',
              fontSize: '0.875rem',
              cursor: 'pointer',
              backgroundColor: 'transparent',
              border: 'none',
              padding: '0.5rem 1rem',
              opacity: '1 !important',
            },
            overlay: {
              mixBlendMode: 'normal',
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              opacity: 1,
            },
            spotlight: {
              borderRadius: '0.5rem',
              border: '2px solid hsl(var(--p))',
              boxShadow: '0 0 20px rgba(0, 184, 169, 0.5)',
              backgroundColor: 'transparent',
              background: 'transparent',
              mixBlendMode: 'normal',
            },
            spotlightLegacy: {
              borderRadius: '0.5rem',
              border: '2px solid hsl(var(--p))',
              backgroundColor: 'transparent',
              background: 'transparent',
              mixBlendMode: 'normal',
            },
            beacon: {
              zIndex: 10001,
            },
            beaconInner: {
              backgroundColor: 'hsl(var(--p))',
            },
            beaconOuter: {
              borderColor: 'hsl(var(--p))',
            },
          }}
          locale={{
            back: 'Voltar',
            close: 'Fechar',
            last: 'Finalizar',
            next: 'Próximo',
            open: 'Abrir',
            skip: 'Pular tutorial',
          }}
          disableOverlayClose
          disableScrolling
        />
      )}
    </>
  );
}

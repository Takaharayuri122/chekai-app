'use client';

import React from 'react';
import type { Step } from 'react-joyride';
import { PerfilUsuario } from './store';
import { tutorialStepsData } from './tutorial.config.data';

const isClient = typeof window !== 'undefined' && typeof document !== 'undefined';

const createContent = (title: string, text: string, titleSize: 'lg' | 'base' = 'base'): React.ReactNode => {
  if (!isClient) {
    return null;
  }
  
  const titleClass = titleSize === 'lg' ? 'font-bold text-lg mb-2' : 'font-bold text-base mb-2';
  
  return React.createElement(
    'div',
    null,
    React.createElement(
      'h3',
      { className: titleClass },
      title
    ),
    React.createElement(
      'p',
      { className: 'text-sm' },
      text
    )
  );
};

export const getTutorialSteps = (perfil: PerfilUsuario): Step[] => {
  if (!isClient || typeof window === 'undefined' || typeof document === 'undefined') {
    return [];
  }
  
  if (typeof process !== 'undefined' && process.env?.NEXT_PHASE === 'phase-production-build') {
    return [];
  }
  
  try {
    const stepsData = tutorialStepsData[perfil] || [];
    
    return stepsData.map((stepData): Step => ({
      target: stepData.target,
      content: createContent(stepData.title, stepData.text, stepData.titleSize),
      placement: stepData.placement || 'bottom',
      disableBeacon: stepData.disableBeacon || false,
    }));
  } catch (error) {
    if (isClient && typeof console !== 'undefined') {
      console.error('Erro ao obter steps do tutorial:', error);
    }
    return [];
  }
};

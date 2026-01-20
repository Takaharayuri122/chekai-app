'use client';

import React from 'react';
import type { Step } from 'react-joyride';
import { PerfilUsuario } from './store';

type TutorialSteps = Record<PerfilUsuario, Step[]>;

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

const getTutorialStepsData = (): TutorialSteps => {
  if (!isClient) {
    return {
      [PerfilUsuario.MASTER]: [],
      [PerfilUsuario.GESTOR]: [],
      [PerfilUsuario.AUDITOR]: [],
    };
  }

  return {
    [PerfilUsuario.MASTER]: [
      {
        target: 'body',
        content: createContent(
          'Bem-vindo ao ChekAI! 👋',
          'Este tutorial vai te ajudar a entender as principais funcionalidades do sistema. Vamos começar!',
          'lg'
        ),
        placement: 'center',
        disableBeacon: true,
      },
      {
        target: '[data-tutorial-id="navbar"]',
        content: createContent(
          'Menu de Navegação',
          'Aqui você encontra acesso rápido a todas as seções principais do sistema: Início, Clientes, Checklists, Auditorias, Usuários e configurações administrativas.'
        ),
        placement: 'bottom',
      },
      {
        target: '[data-tutorial-id="dashboard-welcome"]',
        content: createContent(
          'Página Inicial',
          'Esta é a sua página inicial. Aqui você tem uma visão geral de todas as suas auditorias, estatísticas importantes e acesso rápido às funcionalidades mais usadas.'
        ),
        placement: 'bottom',
      },
      {
        target: '[data-tutorial-id="quick-actions"]',
        content: createContent(
          'Ações Rápidas',
          'Use este botão para iniciar uma nova auditoria. Você pode criar auditorias para seus clientes e unidades cadastradas.'
        ),
        placement: 'bottom',
      },
      {
        target: '[data-tutorial-id="stats-cards"]',
        content: createContent(
          'Estatísticas',
          'Estes cards mostram métricas importantes: auditorias em andamento, finalizadas, quantidade deste mês e total de clientes.'
        ),
        placement: 'top',
      },
      {
        target: '[data-tutorial-id="navbar-avatar"]',
        content: createContent(
          'Menu do Usuário',
          'Clique aqui para acessar seu perfil, configurações e outras opções. Você também pode ver este tutorial novamente a qualquer momento.'
        ),
        placement: 'left',
      },
    ],

    [PerfilUsuario.GESTOR]: [
      {
        target: 'body',
        content: createContent(
          'Bem-vindo ao ChekAI! 👋',
          'Este tutorial vai te ajudar a entender as principais funcionalidades do sistema. Vamos começar!',
          'lg'
        ),
        placement: 'center',
        disableBeacon: true,
      },
      {
        target: '[data-tutorial-id="navbar"]',
        content: createContent(
          'Menu de Navegação',
          'Aqui você encontra acesso rápido a todas as seções principais do sistema: Início, Clientes, Checklists, Auditorias e Usuários.'
        ),
        placement: 'bottom',
      },
      {
        target: '[data-tutorial-id="dashboard-welcome"]',
        content: createContent(
          'Página Inicial',
          'Esta é a sua página inicial. Aqui você tem uma visão geral de todas as auditorias, estatísticas importantes e acesso rápido às funcionalidades mais usadas.'
        ),
        placement: 'bottom',
      },
      {
        target: '[data-tutorial-id="quick-actions"]',
        content: createContent(
          'Ações Rápidas',
          'Use este botão para iniciar uma nova auditoria. Você pode criar auditorias para seus clientes e unidades cadastradas.'
        ),
        placement: 'bottom',
      },
      {
        target: '[data-tutorial-id="stats-cards"]',
        content: createContent(
          'Estatísticas',
          'Estes cards mostram métricas importantes: auditorias em andamento, finalizadas, quantidade deste mês e total de clientes.'
        ),
        placement: 'top',
      },
      {
        target: '[data-tutorial-id="navbar-avatar"]',
        content: createContent(
          'Menu do Usuário',
          'Clique aqui para acessar seu perfil, seus limites e créditos, e outras opções. Você também pode ver este tutorial novamente a qualquer momento.'
        ),
        placement: 'left',
      },
    ],

    [PerfilUsuario.AUDITOR]: [
      {
        target: 'body',
        content: createContent(
          'Bem-vindo ao ChekAI! 👋',
          'Este tutorial vai te ajudar a entender como realizar auditorias no sistema. Vamos começar!',
          'lg'
        ),
        placement: 'center',
        disableBeacon: true,
      },
      {
        target: '[data-tutorial-id="navbar"]',
        content: createContent(
          'Menu de Navegação',
          'Como auditor, você tem acesso simplificado ao menu. Use "Nova" para iniciar uma auditoria e "Auditorias" para ver todas as suas auditorias.'
        ),
        placement: 'bottom',
      },
      {
        target: '[data-tutorial-id="navbar-nova"]',
        content: createContent(
          'Nova Auditoria',
          'Este é o botão principal para você! Use-o para iniciar uma nova auditoria. Você será guiado através do processo passo a passo.'
        ),
        placement: 'bottom',
      },
      {
        target: '[data-tutorial-id="dashboard-welcome"]',
        content: createContent(
          'Página Inicial',
          'Aqui você visualiza suas auditorias em andamento, finalizadas e pode acessar rapidamente para continuar seu trabalho.'
        ),
        placement: 'bottom',
      },
      {
        target: '[data-tutorial-id="quick-actions"]',
        content: createContent(
          'Iniciar Nova Auditoria',
          'Use este botão para começar uma nova auditoria. Você escolherá o cliente, a unidade e o checklist a ser utilizado.'
        ),
        placement: 'bottom',
      },
      {
        target: '[data-tutorial-id="navbar-avatar"]',
        content: createContent(
          'Menu do Usuário',
          'Clique aqui para acessar seu perfil e outras opções. Você também pode ver este tutorial novamente a qualquer momento.'
        ),
        placement: 'left',
      },
    ],
  };
};

export const getTutorialSteps = (perfil: PerfilUsuario): Step[] => {
  if (!isClient) {
    return [];
  }
  try {
    const steps = getTutorialStepsData();
    return steps[perfil] || [];
  } catch (error) {
    if (isClient) {
      console.error('Erro ao obter steps do tutorial:', error);
    }
    return [];
  }
};

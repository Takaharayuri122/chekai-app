import type { Step } from 'react-joyride';
import { PerfilUsuario } from './store';

type TutorialStepData = {
  target: string;
  title: string;
  text: string;
  titleSize?: 'lg' | 'base';
  placement?: Step['placement'];
  disableBeacon?: boolean;
};

type TutorialStepsData = Record<PerfilUsuario, TutorialStepData[]>;

export const tutorialStepsData: TutorialStepsData = {
  [PerfilUsuario.MASTER]: [
    {
      target: 'body',
      title: 'Bem-vindo ao ChekAI! 👋',
      text: 'Este tutorial vai te ajudar a entender as principais funcionalidades do sistema. Vamos começar!',
      titleSize: 'lg',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tutorial-id="navbar"]',
      title: 'Menu de Navegação',
      text: 'Aqui você encontra acesso rápido a todas as seções principais do sistema: Início, Clientes, Checklists, Auditorias, Usuários e configurações administrativas.',
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="dashboard-welcome"]',
      title: 'Página Inicial',
      text: 'Esta é a sua página inicial. Aqui você tem uma visão geral de todas as suas auditorias, estatísticas importantes e acesso rápido às funcionalidades mais usadas.',
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="quick-actions"]',
      title: 'Ações Rápidas',
      text: 'Use este botão para iniciar uma nova auditoria. Você pode criar auditorias para seus clientes e unidades cadastradas.',
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="stats-cards"]',
      title: 'Estatísticas',
      text: 'Estes cards mostram métricas importantes: auditorias em andamento, finalizadas, quantidade deste mês e total de clientes.',
      placement: 'top',
    },
    {
      target: '[data-tutorial-id="navbar-avatar"]',
      title: 'Menu do Usuário',
      text: 'Clique aqui para acessar seu perfil, configurações e outras opções. Você também pode ver este tutorial novamente a qualquer momento.',
      placement: 'left',
    },
  ],

  [PerfilUsuario.GESTOR]: [
    {
      target: 'body',
      title: 'Bem-vindo ao ChekAI! 👋',
      text: 'Este tutorial vai te ajudar a entender as principais funcionalidades do sistema. Vamos começar!',
      titleSize: 'lg',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tutorial-id="navbar"]',
      title: 'Menu de Navegação',
      text: 'Aqui você encontra acesso rápido a todas as seções principais do sistema: Início, Clientes, Checklists, Auditorias e Usuários.',
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="dashboard-welcome"]',
      title: 'Página Inicial',
      text: 'Esta é a sua página inicial. Aqui você tem uma visão geral de todas as auditorias, estatísticas importantes e acesso rápido às funcionalidades mais usadas.',
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="quick-actions"]',
      title: 'Ações Rápidas',
      text: 'Use este botão para iniciar uma nova auditoria. Você pode criar auditorias para seus clientes e unidades cadastradas.',
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="stats-cards"]',
      title: 'Estatísticas',
      text: 'Estes cards mostram métricas importantes: auditorias em andamento, finalizadas, quantidade deste mês e total de clientes.',
      placement: 'top',
    },
    {
      target: '[data-tutorial-id="navbar-avatar"]',
      title: 'Menu do Usuário',
      text: 'Clique aqui para acessar seu perfil, seus limites e créditos, e outras opções. Você também pode ver este tutorial novamente a qualquer momento.',
      placement: 'left',
    },
  ],

  [PerfilUsuario.AUDITOR]: [
    {
      target: 'body',
      title: 'Bem-vindo ao ChekAI! 👋',
      text: 'Este tutorial vai te ajudar a entender como realizar auditorias no sistema. Vamos começar!',
      titleSize: 'lg',
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tutorial-id="navbar"]',
      title: 'Menu de Navegação',
      text: 'Como auditor, você tem acesso simplificado ao menu. Use "Nova" para iniciar uma auditoria e "Auditorias" para ver todas as suas auditorias.',
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="navbar-nova"]',
      title: 'Nova Auditoria',
      text: 'Este é o botão principal para você! Use-o para iniciar uma nova auditoria. Você será guiado através do processo passo a passo.',
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="dashboard-welcome"]',
      title: 'Página Inicial',
      text: 'Aqui você visualiza suas auditorias em andamento, finalizadas e pode acessar rapidamente para continuar seu trabalho.',
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="quick-actions"]',
      title: 'Iniciar Nova Auditoria',
      text: 'Use este botão para começar uma nova auditoria. Você escolherá o cliente, a unidade e o checklist a ser utilizado.',
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="navbar-avatar"]',
      title: 'Menu do Usuário',
      text: 'Clique aqui para acessar seu perfil e outras opções. Você também pode ver este tutorial novamente a qualquer momento.',
      placement: 'left',
    },
  ],
};

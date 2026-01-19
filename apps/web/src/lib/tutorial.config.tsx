'use client';

import React from 'react';
import { Step } from 'react-joyride';
import { PerfilUsuario } from './store';

type TutorialSteps = Record<PerfilUsuario, Step[]>;

const getTutorialStepsData = (): TutorialSteps => ({
  [PerfilUsuario.MASTER]: [
    {
      target: 'body',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">Bem-vindo ao ChekAI! 👋</h3>
          <p className="text-sm">
            Este tutorial vai te ajudar a entender as principais funcionalidades do sistema.
            Vamos começar!
          </p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tutorial-id="navbar"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Menu de Navegação</h3>
          <p className="text-sm">
            Aqui você encontra acesso rápido a todas as seções principais do sistema:
            Início, Clientes, Checklists, Auditorias, Usuários e configurações administrativas.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="dashboard-welcome"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Página Inicial</h3>
          <p className="text-sm">
            Esta é a sua página inicial. Aqui você tem uma visão geral de todas as suas auditorias,
            estatísticas importantes e acesso rápido às funcionalidades mais usadas.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="quick-actions"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Ações Rápidas</h3>
          <p className="text-sm">
            Use este botão para iniciar uma nova auditoria. Você pode criar auditorias para seus clientes
            e unidades cadastradas.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="stats-cards"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Estatísticas</h3>
          <p className="text-sm">
            Estes cards mostram métricas importantes: auditorias em andamento, finalizadas,
            quantidade deste mês e total de clientes.
          </p>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tutorial-id="navbar-avatar"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Menu do Usuário</h3>
          <p className="text-sm">
            Clique aqui para acessar seu perfil, configurações e outras opções.
            Você também pode ver este tutorial novamente a qualquer momento.
          </p>
        </div>
      ),
      placement: 'left',
    },
  ],

  [PerfilUsuario.GESTOR]: [
    {
      target: 'body',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">Bem-vindo ao ChekAI! 👋</h3>
          <p className="text-sm">
            Este tutorial vai te ajudar a entender as principais funcionalidades do sistema.
            Vamos começar!
          </p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tutorial-id="navbar"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Menu de Navegação</h3>
          <p className="text-sm">
            Aqui você encontra acesso rápido a todas as seções principais do sistema:
            Início, Clientes, Checklists, Auditorias e Usuários.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="dashboard-welcome"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Página Inicial</h3>
          <p className="text-sm">
            Esta é a sua página inicial. Aqui você tem uma visão geral de todas as auditorias,
            estatísticas importantes e acesso rápido às funcionalidades mais usadas.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="quick-actions"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Ações Rápidas</h3>
          <p className="text-sm">
            Use este botão para iniciar uma nova auditoria. Você pode criar auditorias para seus clientes
            e unidades cadastradas.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="stats-cards"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Estatísticas</h3>
          <p className="text-sm">
            Estes cards mostram métricas importantes: auditorias em andamento, finalizadas,
            quantidade deste mês e total de clientes.
          </p>
        </div>
      ),
      placement: 'top',
    },
    {
      target: '[data-tutorial-id="navbar-avatar"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Menu do Usuário</h3>
          <p className="text-sm">
            Clique aqui para acessar seu perfil, seus limites e créditos, e outras opções.
            Você também pode ver este tutorial novamente a qualquer momento.
          </p>
        </div>
      ),
      placement: 'left',
    },
  ],

  [PerfilUsuario.AUDITOR]: [
    {
      target: 'body',
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">Bem-vindo ao ChekAI! 👋</h3>
          <p className="text-sm">
            Este tutorial vai te ajudar a entender como realizar auditorias no sistema.
            Vamos começar!
          </p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '[data-tutorial-id="navbar"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Menu de Navegação</h3>
          <p className="text-sm">
            Como auditor, você tem acesso simplificado ao menu. Use "Nova" para iniciar
            uma auditoria e "Auditorias" para ver todas as suas auditorias.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="navbar-nova"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Nova Auditoria</h3>
          <p className="text-sm">
            Este é o botão principal para você! Use-o para iniciar uma nova auditoria.
            Você será guiado através do processo passo a passo.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="dashboard-welcome"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Página Inicial</h3>
          <p className="text-sm">
            Aqui você visualiza suas auditorias em andamento, finalizadas e pode acessar
            rapidamente para continuar seu trabalho.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="quick-actions"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Iniciar Nova Auditoria</h3>
          <p className="text-sm">
            Use este botão para começar uma nova auditoria. Você escolherá o cliente,
            a unidade e o checklist a ser utilizado.
          </p>
        </div>
      ),
      placement: 'bottom',
    },
    {
      target: '[data-tutorial-id="navbar-avatar"]',
      content: (
        <div>
          <h3 className="font-bold text-base mb-2">Menu do Usuário</h3>
          <p className="text-sm">
            Clique aqui para acessar seu perfil e outras opções.
            Você também pode ver este tutorial novamente a qualquer momento.
          </p>
        </div>
      ),
      placement: 'left',
    },
  ],
});

export const getTutorialSteps = (perfil: PerfilUsuario): Step[] => {
  if (typeof window === 'undefined') {
    return [];
  }
  const steps = getTutorialStepsData();
  return steps[perfil] || [];
};

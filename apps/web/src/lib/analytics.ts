/**
 * Utilitários para rastreamento de eventos com Google Analytics.
 */

declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set',
      targetId: string,
      config?: Record<string, unknown>,
    ) => void;
  }
}

/**
 * Rastreia um evento customizado no Google Analytics.
 * @param eventName Nome do evento (ex: 'login', 'create_audit', 'upload_photo')
 * @param eventParams Parâmetros adicionais do evento
 */
export function trackEvent(
  eventName: string,
  eventParams?: {
    category?: string;
    label?: string;
    value?: number;
    [key: string]: unknown;
  },
): void {
  if (typeof window === 'undefined' || !window.gtag) {
    return;
  }

  window.gtag('event', eventName, {
    event_category: eventParams?.category || 'general',
    event_label: eventParams?.label,
    value: eventParams?.value,
    ...eventParams,
  });
}

/**
 * Rastreia visualização de página customizada.
 * @param pagePath Caminho da página
 * @param pageTitle Título da página
 */
export function trackPageView(pagePath: string, pageTitle?: string): void {
  if (typeof window === 'undefined' || !window.gtag) {
    return;
  }

  window.gtag('config', process.env.NEXT_PUBLIC_GA_ID || '', {
    page_path: pagePath,
    page_title: pageTitle,
  });
}

/**
 * Eventos pré-definidos para facilitar o uso.
 */
export const analyticsEvents = {
  // Autenticação
  login: (method: string) => trackEvent('login', { category: 'auth', label: method }),
  logout: () => trackEvent('logout', { category: 'auth' }),
  register: () => trackEvent('register', { category: 'auth' }),

  // Auditorias
  createAudit: (clientId: string) =>
    trackEvent('create_audit', { category: 'audit', label: clientId }),
  viewAudit: (auditId: string) =>
    trackEvent('view_audit', { category: 'audit', label: auditId }),
  completeAudit: (auditId: string) =>
    trackEvent('complete_audit', { category: 'audit', label: auditId }),

  // Fotos e IA
  uploadPhoto: (auditId: string) =>
    trackEvent('upload_photo', { category: 'photo', label: auditId }),
  analyzeWithAI: (auditId: string, success: boolean) =>
    trackEvent('analyze_ai', {
      category: 'ai',
      label: auditId,
      success,
    }),

  // Clientes
  createClient: () => trackEvent('create_client', { category: 'client' }),
  viewClient: (clientId: string) =>
    trackEvent('view_client', { category: 'client', label: clientId }),

  // Templates
  createTemplate: () => trackEvent('create_template', { category: 'template' }),
  useTemplate: (templateId: string) =>
    trackEvent('use_template', { category: 'template', label: templateId }),

  // Legislações
  viewLegislation: (legislationId: string) =>
    trackEvent('view_legislation', { category: 'legislation', label: legislationId }),

  // Erros
  error: (errorType: string, errorMessage?: string) =>
    trackEvent('error', {
      category: 'error',
      label: errorType,
      error_message: errorMessage,
    }),
};


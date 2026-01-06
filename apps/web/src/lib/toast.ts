import toast from 'react-hot-toast';

/**
 * Utilitários para exibir notificações toast alinhadas ao design system
 */
export const toastService = {
  /**
   * Exibe uma mensagem de sucesso
   */
  success: (message: string) => {
    toast.success(message, {
      duration: 4000,
      style: {
        background: '#00B8A9',
        color: '#ffffff',
        borderRadius: '0.5rem',
        padding: '1rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
      iconTheme: {
        primary: '#ffffff',
        secondary: '#00B8A9',
      },
    });
  },

  /**
   * Exibe uma mensagem de erro
   */
  error: (message: string) => {
    toast.error(message, {
      duration: 5000,
      style: {
        background: '#ef4444',
        color: '#ffffff',
        borderRadius: '0.5rem',
        padding: '1rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      },
      iconTheme: {
        primary: '#ffffff',
        secondary: '#ef4444',
      },
    });
  },

  /**
   * Exibe uma mensagem de aviso
   */
  warning: (message: string) => {
    toast(message, {
      duration: 4000,
      icon: '⚠️',
      style: {
        background: 'hsl(var(--wa))',
        color: 'hsl(var(--wac))',
        borderRadius: '0.5rem',
        padding: '1rem',
      },
    });
  },

  /**
   * Exibe uma mensagem informativa
   */
  info: (message: string) => {
    toast(message, {
      duration: 4000,
      icon: 'ℹ️',
      style: {
        background: 'hsl(var(--in))',
        color: 'hsl(var(--inc))',
        borderRadius: '0.5rem',
        padding: '1rem',
      },
    });
  },

  /**
   * Exibe uma mensagem de loading
   */
  loading: (message: string) => {
    return toast.loading(message, {
      style: {
        background: 'hsl(var(--b2))',
        color: 'hsl(var(--bc))',
        borderRadius: '0.5rem',
        padding: '1rem',
      },
    });
  },
};


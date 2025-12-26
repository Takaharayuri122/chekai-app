import type { Config } from 'tailwindcss';
import daisyui from 'daisyui';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-montserrat)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        light: {
          'primary': '#00B8A9',          // Teal Inovação
          'primary-content': '#ffffff',
          'secondary': '#0891b2',         // Cyan 600
          'secondary-content': '#ffffff',
          'accent': '#f59e0b',            // Amber 500
          'accent-content': '#ffffff',
          'neutral': '#1B2A4A',           // Navy Confiança
          'neutral-content': '#ffffff',
          'base-100': '#FFFFFF',          // Branco Puro
          'base-200': '#F4F7FA',            // Cinza Suporte
          'base-300': '#E5E9F0',          // Cinza mais escuro para bordas
          'base-content': '#1B2A4A',      // Navy Confiança para textos
          'info': '#3b82f6',              // Blue 500
          'info-content': '#ffffff',
          'success': '#10b981',           // Emerald 500
          'success-content': '#ffffff',
          'warning': '#f59e0b',           // Amber 500
          'warning-content': '#ffffff',
          'error': '#ef4444',             // Red 500
          'error-content': '#ffffff',
        },
      },
    ],
    darkTheme: false,
    base: true,
    styled: true,
    utils: true,
    logs: false,
  },
};

export default config;

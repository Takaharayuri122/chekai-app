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
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        light: {
          'primary': '#059669',          // Emerald 600
          'primary-content': '#ffffff',
          'secondary': '#0891b2',         // Cyan 600
          'secondary-content': '#ffffff',
          'accent': '#f59e0b',            // Amber 500
          'accent-content': '#ffffff',
          'neutral': '#1f2937',           // Gray 800
          'neutral-content': '#f9fafb',
          'base-100': '#ffffff',
          'base-200': '#f9fafb',          // Gray 50
          'base-300': '#f3f4f6',          // Gray 100
          'base-content': '#1f2937',
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

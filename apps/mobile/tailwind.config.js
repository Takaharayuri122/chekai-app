/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#00B8A9',
        secondary: '#0891b2',
        accent: '#f59e0b',
        neutral: '#1B2A4A',
        'base-100': '#FFFFFF',
        'base-200': '#F4F7FA',
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
      },
      fontFamily: {
        sans: ['Inter_400Regular', 'System'],
        'sans-medium': ['Inter_500Medium', 'System'],
        'sans-semibold': ['Inter_600SemiBold', 'System'],
        display: ['Montserrat_700Bold', 'System'],
      },
    },
  },
  plugins: [],
};

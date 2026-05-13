/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      colors: {
        primary: {
          100: '#e0f5fd',
          200: '#bfe7f6',
          300: '#96d4ea',
          400: '#6ec0db',
          500: '#51abcd',
          600: '#3375c8',
          700: '#2560aa',
        },
        accent: '#ffa62b',
        bg: { main: '#f0f8fd', card: '#ffffff', elevated: '#eaf4fb', sidebar: '#3375c8' },
        ink: { primary: '#1e293b', secondary: '#475569', muted: '#94a3b8' },
      },
      boxShadow: {
        soft: '0 1px 3px rgba(51,117,200,0.12)',
        md2: '0 4px 16px rgba(51,117,200,0.15)',
      },
      borderRadius: { lg2: '16px' },
    },
  },
  plugins: [],
};

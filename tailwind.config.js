/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        sand: { 50: '#fdfaf5', 100: '#faf3e7', 200: '#f3e3c4' },
        ocean: {
          50: '#f0f9ff', 100: '#e0f2fe',
          400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1',
        },
        coral: {
          50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3',
          400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c',
        },
      },
    },
  },
  plugins: [],
};



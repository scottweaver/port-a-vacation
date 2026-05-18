/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Caveat"', 'cursive'],
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
        // Gulf-sunset palette (sampled from public/beach-bg.webp). Used in
        // the TopBar gradient and any future "atmospheric" surfaces.
        dusk: {
          600: '#4a2b6e', 700: '#3a2362', 800: '#2d1b4e', 900: '#1f1240',
        },
        sunset: {
          300: '#f4b56b', // golden horizon
          400: '#e87a5d', // peach
          500: '#c2566e', // rose
          600: '#9b4264', // deeper rose
        },
        // Muted-tone accents for category stripes where the saturated
        // jewel-tones (emerald/violet) overpowered the rest of the row.
        sage: { 400: '#9caf88' },     // grey-green, herb-garden
        lavender: { 400: '#c0a8d8' }, // soft purple, not electric
      },
    },
  },
  plugins: [],
};



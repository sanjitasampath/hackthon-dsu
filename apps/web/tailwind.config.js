/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070b14',
          900: '#0B0F19',
          850: '#0f172a',
          800: '#151e36',
          700: '#1e294b',
          600: '#2d3b63'
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2'
        },
        teal: {
          400: '#2dd4bf',
          500: '#14b8a6'
        },
        purple: {
          400: '#c084fc',
          500: '#a855f7'
        },
        emerald: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669'
        }
      }
    },
  },
  plugins: [],
}

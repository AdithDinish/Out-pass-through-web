/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: '#EAF3FB',
          100: '#D6E7F7',
          200: '#ACCEF0',
          300: '#80B2E7',
          400: '#5395DC',
          500: '#175DAA',
          600: '#145293',
          700: '#103C6A',
          800: '#0B2A4B',
          900: '#071A2F',
        },
        amber: {
          50: '#FEEFE6',
          100: '#FCDCC3',
          200: '#F9B98B',
          300: '#F69653',
          400: '#F47C31',
          500: '#F3772A',
          600: '#DA6822',
          700: '#B9551A',
          800: '#8D4012',
          900: '#5E280B',
        },
      },
    },
  },
  plugins: [],
}



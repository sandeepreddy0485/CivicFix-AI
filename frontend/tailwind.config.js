/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff8f1',
          100: '#d7eedd',
          500: '#1f8a4c',
          600: '#1a7340',
          700: '#155c33',
        },
      },
    },
  },
  plugins: [],
}
